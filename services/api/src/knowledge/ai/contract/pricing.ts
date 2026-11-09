import { ValidatedCapabilityDescriptor } from './capability';
import { requireValidated, sealValidated, Validated } from './validated';
import { ContractError } from './contract-error';
import {
  applyFactorBps, ExactAmount, fromPicoSum, MAX_COUNT, MAX_MODIFIER_BPS, roundCeiling, roundHalfUp,
} from './money';
import { AttemptBounds, checkRateTable, exactUsageSum, exactWorstCaseSum, RateTable, rateTableDominates } from './rates';
import { assertNormalizedUsage, NormalizedUsage, totalInputTokens } from './usage';
import { Checker, KEY_PATTERN, ValidationResult } from './validation';
import { SCHEMA_VERSION } from './version';

/**
 * Versioned, provider-neutral pricing schema (NEM-021 §5.3, §9.2).
 * Rates are integer micro-USD per 1,000,000 tokens or units.
 */
export interface PricingSchema {
  contract: 'noetia.ai.pricing';
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  version: number;
  providerKey: string;
  modelKey: string;
  currency: 'micro-usd-per-million';
  effectiveFrom: string;
  /** When the rates were last verified against the provider's published prices; null for fixtures. */
  verifiedAt: string | null;
  sourceNote: string;
  /** Fixtures are never seeded and never presented as real prices. */
  isTestFixture: boolean;
  base: RateTable;
  /**
   * Whole-request repricing: when TOTAL input tokens are strictly greater than `aboveInputTokens`,
   * the tier's table prices every class. Thresholds strictly increase; each tier dominates the previous.
   */
  tiers: Array<{ aboveInputTokens: number; rates: RateTable }>;
  /** Integer factor basis points by key (10,000 = ×1.0), e.g. `{ "batch": 5000, "region_us": 11000 }`. */
  modifiers: Record<string, number>;
}

export type ValidatedPricingSchema = Validated<PricingSchema>;

export interface PriceResult {
  /** Rounded amount: ceiling for worst case, half up for settlement. */
  microUsd: bigint;
  /** Exact rational amount before rounding, for audit. */
  exact: ExactAmount;
  /** −1 for the base table, otherwise the tier index. */
  tierIndex: number;
}

const TOP_KEYS = ['contract', 'schemaVersion', 'id', 'version', 'providerKey', 'modelKey', 'currency', 'effectiveFrom',
  'verifiedAt', 'sourceNote', 'isTestFixture', 'base', 'tiers', 'modifiers'] as const;

export function validatePricingSchema(v: unknown): ValidationResult<PricingSchema> {
  const c = new Checker();
  if (!c.isObject(v, 'pricing')) return c.result(v);
  c.onlyKeys(v, TOP_KEYS, 'pricing');
  if (v.contract !== 'noetia.ai.pricing') c.fail('pricing.contract', 'must be "noetia.ai.pricing"');
  if (v.schemaVersion !== SCHEMA_VERSION) c.fail('pricing.schemaVersion', `must be ${SCHEMA_VERSION}`);
  if (v.currency !== 'micro-usd-per-million') c.fail('pricing.currency', 'must be "micro-usd-per-million"');
  for (const k of ['id', 'providerKey', 'modelKey', 'sourceNote'] as const) c.string(v[k], `pricing.${k}`);
  c.int(v.version, 'pricing.version', 1, MAX_COUNT);
  c.isoDate(v.effectiveFrom, 'pricing.effectiveFrom');
  c.isoDate(v.verifiedAt, 'pricing.verifiedAt', { nullable: true });
  c.bool(v.isTestFixture, 'pricing.isTestFixture');
  const baseOk = checkRateTable(c, v.base, 'pricing.base');

  if (!Array.isArray(v.tiers)) c.fail('pricing.tiers', 'must be an array');
  else {
    let prev: RateTable | null = baseOk ? (v.base as RateTable) : null;
    let prevThreshold = -1;
    v.tiers.forEach((t, i) => {
      const p = `pricing.tiers[${i}]`;
      if (!c.isObject(t, p)) return;
      c.onlyKeys(t, ['aboveInputTokens', 'rates'], p);
      if (c.int(t.aboveInputTokens, `${p}.aboveInputTokens`, 0, MAX_COUNT)) {
        if (t.aboveInputTokens <= prevThreshold) c.fail(`${p}.aboveInputTokens`, 'thresholds must strictly increase');
        prevThreshold = t.aboveInputTokens;
      }
      if (checkRateTable(c, t.rates, `${p}.rates`) && prev) {
        // Monotonicity keeps worst-case reservations conservative (§9 worst-case correctness).
        if (!rateTableDominates(t.rates as RateTable, prev)) c.fail(`${p}.rates`, 'must be ≥ the previous table for every class, with the same lifetimes and units');
        prev = t.rates as RateTable;
      }
    });
  }

  if (c.isObject(v.modifiers, 'pricing.modifiers')) {
    for (const [k, bps] of Object.entries(v.modifiers)) {
      if (!KEY_PATTERN.test(k)) c.fail(`pricing.modifiers.${k}`, 'invalid modifier key');
      c.int(bps, `pricing.modifiers.${k}`, 1, MAX_MODIFIER_BPS);
    }
  }
  return c.result(v);
}

/** The validation boundary for pricing (F-6): validate once, return a sealed, frozen copy. */
export function assertPricingSchema(v: unknown): ValidatedPricingSchema {
  const r = validatePricingSchema(v);
  if (!r.ok) throw new ContractError('invalid_schema', r.errors.join('; '));
  return sealValidated(r.value, 'pricing schema');
}

/** Units the schema prices in any table (all tables carry the same keys after validation). */
function pricedUnits(schema: ValidatedPricingSchema): string[] {
  return Object.keys(schema.base.nonTokenUnits ?? {}).sort();
}

/** Index of the tier for a total input count (strictly greater than the threshold); −1 = base. */
export function selectTier(schema: ValidatedPricingSchema, totalInput: bigint): number {
  let index = -1;
  schema.tiers.forEach((t, i) => { if (totalInput > BigInt(t.aboveInputTokens)) index = i; });
  return index;
}

const tableFor = (schema: ValidatedPricingSchema, i: number) => (i < 0 ? schema.base : schema.tiers[i].rates) as RateTable;

/** Canonical modifier order: batch, then region*, then the rest by key (§9.2). Exact math makes it order-independent. */
export function canonicalModifierOrder(keys: readonly string[]): string[] {
  const rank = (k: string) => (k === 'batch' ? 0 : k.startsWith('region') ? 1 : 2);
  return [...keys].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

function applyModifiers(schema: ValidatedPricingSchema, amount: ExactAmount, keys: readonly string[]): ExactAmount {
  if (new Set(keys).size !== keys.length) throw new ContractError('unknown_modifier', 'duplicate modifier');
  let out = amount;
  for (const k of canonicalModifierOrder(keys)) {
    const bps = schema.modifiers[k];
    if (bps === undefined) throw new ContractError('unknown_modifier', `modifier "${k}" is not defined in ${schema.id}`);
    out = applyFactorBps(out, BigInt(bps));
  }
  return out;
}

function assertSameModel(schema: ValidatedPricingSchema, providerKey: string, modelKey: string) {
  if (schema.providerKey !== providerKey || schema.modelKey !== modelKey) {
    throw new ContractError('schema_mismatch', `pricing schema ${schema.id} does not cover ${providerKey}/${modelKey}`);
  }
}

/** Settlement price of normalized usage: exact, rounded half up once (§9.2). */
export function priceUsage(usage: NormalizedUsage, schema: ValidatedPricingSchema, modifiers: readonly string[] = []): PriceResult {
  requireValidated(schema, 'pricing schema');
  const u = assertNormalizedUsage(usage);
  assertSameModel(schema, u.providerKey, u.modelKey);
  const tierIndex = selectTier(schema, totalInputTokens(u.tokens));
  const exact = applyModifiers(schema, fromPicoSum(exactUsageSum(tableFor(schema, tierIndex), u.tokens, u.nonTokenUnits)), modifiers);
  return { microUsd: roundHalfUp(exact), exact, tierIndex };
}

/** Reservation price: the worst case within the declared bounds, rounded up once (§9.2). */
export function worstCaseCost(
  descriptor: ValidatedCapabilityDescriptor, schema: ValidatedPricingSchema, bounds: AttemptBounds, modifiers: readonly string[] = [],
): PriceResult {
  requireValidated(descriptor, 'capability descriptor');
  requireValidated(schema, 'pricing schema');
  assertSameModel(schema, descriptor.providerKey, descriptor.modelKey);
  // F-5: the schema must price exactly the non-token units the descriptor declares.
  if (pricedUnits(schema).join() !== [...descriptor.nonTokenUnits].sort().join()) {
    throw new ContractError('unit_declaration_mismatch', `${schema.id} prices [${pricedUnits(schema)}] but the descriptor declares [${descriptor.nonTokenUnits}]`);
  }
  const tierIndex = selectTier(schema, BigInt(bounds.inputTokens));
  const exact = applyModifiers(schema, fromPicoSum(exactWorstCaseSum(tableFor(schema, tierIndex), descriptor, bounds)), modifiers);
  return { microUsd: roundCeiling(exact), exact, tierIndex };
}
