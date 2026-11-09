import { CapabilityDescriptor } from './capability';
import { ContractError } from './contract-error';
import { fromPicoSum, MAX_COUNT, roundCeiling, roundHalfUp } from './money';
import { AttemptBounds, checkRateTable, exactUsageSum, exactWorstCaseSum, RateTable } from './rates';
import { assertNormalizedUsage, NormalizedUsage } from './usage';
import { Checker, ValidationResult } from './validation';
import { SCHEMA_VERSION } from './version';

/**
 * Versioned internal-unit weights (ADR-005): how usage maps to per-user allowance units,
 * independent of provider prices. Weights are integer units per 1,000,000 tokens or units.
 * No tiers and no modifiers: price changes never silently change customer capacity.
 */
export interface UnitWeightSchema {
  contract: 'noetia.ai.unit-weights';
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  version: number;
  effectiveFrom: string;
  isTestFixture: boolean;
  weights: RateTable;
}

const TOP_KEYS = ['contract', 'schemaVersion', 'id', 'version', 'effectiveFrom', 'isTestFixture', 'weights'] as const;

export function validateUnitWeightSchema(v: unknown): ValidationResult<UnitWeightSchema> {
  const c = new Checker();
  if (!c.isObject(v, 'weights')) return c.result(v);
  c.onlyKeys(v, TOP_KEYS, 'weights');
  if (v.contract !== 'noetia.ai.unit-weights') c.fail('weights.contract', 'must be "noetia.ai.unit-weights"');
  if (v.schemaVersion !== SCHEMA_VERSION) c.fail('weights.schemaVersion', `must be ${SCHEMA_VERSION}`);
  c.string(v.id, 'weights.id');
  c.int(v.version, 'weights.version', 1, MAX_COUNT);
  c.isoDate(v.effectiveFrom, 'weights.effectiveFrom');
  c.bool(v.isTestFixture, 'weights.isTestFixture');
  checkRateTable(c, v.weights, 'weights.weights');
  return c.result(v);
}

export function assertUnitWeightSchema(v: unknown): UnitWeightSchema {
  const r = validateUnitWeightSchema(v);
  if (!r.ok) throw new ContractError('invalid_schema', r.errors.join('; '));
  return r.value;
}

/** Allowance units consumed by settled usage (half up, once). */
export function unitsForUsage(usage: NormalizedUsage, schema: UnitWeightSchema): bigint {
  const u = assertNormalizedUsage(usage);
  return roundHalfUp(fromPicoSum(exactUsageSum(schema.weights, u.tokens, u.nonTokenUnits)));
}

/** Allowance units to reserve for an attempt (ceiling, once). */
export function worstCaseUnits(descriptor: CapabilityDescriptor, schema: UnitWeightSchema, bounds: AttemptBounds): bigint {
  return roundCeiling(fromPicoSum(exactWorstCaseSum(schema.weights, descriptor, bounds)));
}
