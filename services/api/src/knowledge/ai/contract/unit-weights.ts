import { ValidatedCapabilityDescriptor } from './capability';
import { requireValidated, validateAndSeal, Validated } from './validated';
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

export type ValidatedUnitWeightSchema = Validated<UnitWeightSchema>;

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

/** The validation boundary for unit weights (F-6): validate once, return a sealed, frozen copy. */
export function assertUnitWeightSchema(v: unknown): ValidatedUnitWeightSchema {
  return validateAndSeal('unit-weight schema', v) as ValidatedUnitWeightSchema;
}

/** Allowance units consumed by settled usage (half up, once). */
export function unitsForUsage(usage: NormalizedUsage, schema: ValidatedUnitWeightSchema): bigint {
  requireValidated(schema, 'unit-weight schema');
  const u = assertNormalizedUsage(usage);
  return roundHalfUp(fromPicoSum(exactUsageSum(schema.weights as RateTable, u.tokens, u.nonTokenUnits)));
}

/** Allowance units to reserve for an attempt (ceiling, once). */
export function worstCaseUnits(descriptor: ValidatedCapabilityDescriptor, schema: ValidatedUnitWeightSchema, bounds: AttemptBounds): bigint {
  requireValidated(descriptor, 'capability descriptor');
  requireValidated(schema, 'unit-weight schema');
  return roundCeiling(fromPicoSum(exactWorstCaseSum(schema.weights as RateTable, descriptor, bounds)));
}
