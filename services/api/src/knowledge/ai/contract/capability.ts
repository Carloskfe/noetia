import { ContractError } from './contract-error';
import { MAX_COUNT, MAX_MODIFIER_BPS } from './money';
import { ERROR_CATEGORIES, ErrorCategory, NoChargeDeclaration } from './outcomes';
import { Checker, KEY_PATTERN, LIFETIME_PATTERN, ValidationResult } from './validation';
import { requireValidated, sealValidated, Validated } from './validated';
import { SCHEMA_VERSION } from './version';

/** What a provider model can do, as declared by its adapter (or the simulator). */
export interface CapabilityDescriptor {
  contract: 'noetia.ai.capability';
  schemaVersion: typeof SCHEMA_VERSION;
  providerKey: string;
  modelKey: string;
  /** Only simulated descriptors may be registered until the launch-readiness gate. */
  simulated: boolean;
  /** Capability keys served, e.g. `research_session`. */
  capabilities: string[];
  /** Model-path ids served (see `model-paths.ts`). */
  modelPaths: string[];
  maxContextTokens: number;
  maxOutputTokens: number;
  features: {
    citations: boolean;
    structuredOutput: boolean;
    streaming: boolean;
    tokenCounting: boolean;
    embeddings: boolean;
    cacheHints: {
      /** Supported cache lifetimes, e.g. `["5m", "1h"]`. */
      lifetimes: string[];
      /** True when the provider may write to cache without an explicit hint (billed as a cache write). */
      automaticWrites: boolean;
    };
  };
  /** `estimated` counts are multiplied by a conservative factor (≥ 10,000 bps) before reservation. */
  tokenCountingMethod: { mode: 'exact' } | { mode: 'estimated'; conservativeFactorBps: number };
  /** Reasoning tokens either count within `maxOutputTokens` or have their own bound. */
  reasoning: { mode: 'within_output' } | { mode: 'separate_bound'; maxReasoningTokens: number };
  /** Error classes the provider documents as never billed (F-4 evidence `documented_no_charge`). */
  noChargeErrorClasses: NoChargeDeclaration[];
  /**
   * Every potentially billable non-token operation this model can consume (F-5), e.g. `["tool_call"]`.
   * An empty array is the validated declaration that no non-token operation is available.
   * Each declared unit needs an explicit bound in every attempt's worst case (0 disables it).
   */
  nonTokenUnits: string[];
}

export type ValidatedCapabilityDescriptor = Validated<CapabilityDescriptor>;

const TOP_KEYS = ['contract', 'schemaVersion', 'providerKey', 'modelKey', 'simulated', 'capabilities', 'modelPaths',
  'maxContextTokens', 'maxOutputTokens', 'features', 'tokenCountingMethod', 'reasoning', 'noChargeErrorClasses', 'nonTokenUnits'] as const;

export function validateCapabilityDescriptor(v: unknown): ValidationResult<CapabilityDescriptor> {
  const c = new Checker();
  if (!c.isObject(v, 'descriptor')) return c.result(v);
  c.onlyKeys(v, TOP_KEYS, 'descriptor');
  if (v.contract !== 'noetia.ai.capability') c.fail('descriptor.contract', 'must be "noetia.ai.capability"');
  if (v.schemaVersion !== SCHEMA_VERSION) c.fail('descriptor.schemaVersion', `must be ${SCHEMA_VERSION}`);
  c.string(v.providerKey, 'descriptor.providerKey');
  c.string(v.modelKey, 'descriptor.modelKey');
  c.bool(v.simulated, 'descriptor.simulated');
  for (const key of ['capabilities', 'modelPaths'] as const) {
    const arr = v[key];
    if (!Array.isArray(arr) || arr.length === 0) c.fail(`descriptor.${key}`, 'must be a non-empty array');
    else arr.forEach((x, i) => c.string(x, `descriptor.${key}[${i}]`));
  }
  c.int(v.maxContextTokens, 'descriptor.maxContextTokens', 1, MAX_COUNT);
  c.int(v.maxOutputTokens, 'descriptor.maxOutputTokens', 1, MAX_COUNT);

  if (c.isObject(v.features, 'descriptor.features')) {
    const f = v.features;
    c.onlyKeys(f, ['citations', 'structuredOutput', 'streaming', 'tokenCounting', 'embeddings', 'cacheHints'], 'descriptor.features');
    for (const k of ['citations', 'structuredOutput', 'streaming', 'tokenCounting', 'embeddings']) c.bool(f[k], `descriptor.features.${k}`);
    if (c.isObject(f.cacheHints, 'descriptor.features.cacheHints')) {
      const h = f.cacheHints;
      c.onlyKeys(h, ['lifetimes', 'automaticWrites'], 'descriptor.features.cacheHints');
      if (!Array.isArray(h.lifetimes)) c.fail('descriptor.features.cacheHints.lifetimes', 'must be an array');
      else h.lifetimes.forEach((l, i) => {
        if (typeof l !== 'string' || !LIFETIME_PATTERN.test(l)) c.fail(`descriptor.features.cacheHints.lifetimes[${i}]`, 'must look like "5m" or "1h"');
      });
      c.bool(h.automaticWrites, 'descriptor.features.cacheHints.automaticWrites');
      if (h.automaticWrites === true && Array.isArray(h.lifetimes) && h.lifetimes.length === 0) {
        c.fail('descriptor.features.cacheHints', 'automaticWrites requires at least one lifetime');
      }
    }
  }

  if (c.isObject(v.tokenCountingMethod, 'descriptor.tokenCountingMethod')) {
    const t = v.tokenCountingMethod;
    if (t.mode === 'exact') c.onlyKeys(t, ['mode'], 'descriptor.tokenCountingMethod');
    else if (t.mode === 'estimated') {
      c.onlyKeys(t, ['mode', 'conservativeFactorBps'], 'descriptor.tokenCountingMethod');
      c.int(t.conservativeFactorBps, 'descriptor.tokenCountingMethod.conservativeFactorBps', 10_000, MAX_MODIFIER_BPS);
    } else c.fail('descriptor.tokenCountingMethod.mode', 'must be "exact" or "estimated"');
  }

  if (c.isObject(v.reasoning, 'descriptor.reasoning')) {
    const r = v.reasoning;
    if (r.mode === 'within_output') c.onlyKeys(r, ['mode'], 'descriptor.reasoning');
    else if (r.mode === 'separate_bound') {
      c.onlyKeys(r, ['mode', 'maxReasoningTokens'], 'descriptor.reasoning');
      c.int(r.maxReasoningTokens, 'descriptor.reasoning.maxReasoningTokens', 0, MAX_COUNT);
    } else c.fail('descriptor.reasoning.mode', 'must be "within_output" or "separate_bound"');
  }

  if (!Array.isArray(v.noChargeErrorClasses)) c.fail('descriptor.noChargeErrorClasses', 'must be an array');
  else v.noChargeErrorClasses.forEach((d, i) => {
    const p = `descriptor.noChargeErrorClasses[${i}]`;
    if (!c.isObject(d, p)) return;
    c.onlyKeys(d, ['error', 'documentationRef'], p);
    c.oneOf(d.error, ERROR_CATEGORIES, `${p}.error`);
    c.string(d.documentationRef, `${p}.documentationRef`);
  });
  if (!Array.isArray(v.nonTokenUnits)) c.fail('descriptor.nonTokenUnits', 'must be an array (empty = no non-token operations)');
  else {
    v.nonTokenUnits.forEach((k, i) => {
      if (typeof k !== 'string' || !KEY_PATTERN.test(k)) c.fail(`descriptor.nonTokenUnits[${i}]`, 'invalid unit key');
    });
    if (new Set(v.nonTokenUnits).size !== v.nonTokenUnits.length) c.fail('descriptor.nonTokenUnits', 'duplicate unit');
  }
  return c.result(v);
}

/** The validation boundary for descriptors (F-6): validate once, return a sealed, frozen copy. */
export function assertCapabilityDescriptor(v: unknown): ValidatedCapabilityDescriptor {
  const r = validateCapabilityDescriptor(v);
  if (!r.ok) throw new ContractError('invalid_descriptor', r.errors.join('; '));
  return sealValidated(r.value, 'capability descriptor');
}

/**
 * Input tokens to reserve for: exact counts as given; estimated counts multiplied by the
 * descriptor's conservative factor and rounded up.
 */
export function conservativeInputTokens(d: ValidatedCapabilityDescriptor, counted: number): number {
  requireValidated(d, 'capability descriptor');
  if (!Number.isSafeInteger(counted) || counted < 0) throw new ContractError('invalid_request', 'counted tokens must be a non-negative safe integer');
  if (d.tokenCountingMethod.mode === 'exact') return counted;
  const factor = BigInt(d.tokenCountingMethod.conservativeFactorBps);
  const scaled = (BigInt(counted) * factor + 9_999n) / 10_000n;
  if (scaled > BigInt(MAX_COUNT)) throw new ContractError('overflow', 'conservative token estimate exceeds the safe range');
  return Number(scaled);
}

export function declaresNoCharge(d: ValidatedCapabilityDescriptor, error: ErrorCategory): boolean {
  requireValidated(d, 'capability descriptor');
  return d.noChargeErrorClasses.some((x) => x.error === error);
}
