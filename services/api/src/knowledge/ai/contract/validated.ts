import { validateCapabilityDescriptor } from './capability';
import { ContractError, ContractErrorCode } from './contract-error';
import { validatePricingSchema } from './pricing';
import { validateUnitWeightSchema } from './unit-weights';
import { ValidationResult } from './validation';

/**
 * The single runtime validation boundary for configuration (checkpoint finding F-6).
 *
 * Pricing schemas, unit-weight schemas, and capability descriptors are validated exactly once,
 * by their `assert*` function, which returns a **deep-frozen copy registered here**. Every monetary
 * function accepts only registered objects:
 * - no revalidation per calculation (a constant-time membership check);
 * - a raw object, a spread copy, or a hand-built object is not registered and is rejected;
 * - registered objects are frozen, so they cannot be changed after validation.
 *
 * Sealing cannot be reached without validation (checkpoint finding F-7): the registry and the
 * sealing step are module-private, and the only exported way to register an object,
 * `validateAndSeal`, runs the designated validator for that kind itself. A caller cannot supply
 * its own validator, a kind outside the closed list, or an already-"validated" value.
 */

declare const VALIDATED: unique symbol;
export type Validated<T> = DeepReadonly<T> & { readonly [VALIDATED]: true };

type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

export type ConfigKind = 'pricing schema' | 'unit-weight schema' | 'capability descriptor';

const registry = new WeakMap<object, ConfigKind>();

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

/**
 * The designated validator for each kind, and its failure code. Called lazily: `capability.ts`,
 * `pricing.ts`, and `unit-weights.ts` import this module, so their validators are resolved at call
 * time, never at module load.
 */
const VALIDATORS: Record<ConfigKind, { validate: (v: unknown) => ValidationResult<unknown>; code: ContractErrorCode }> = {
  'pricing schema': { validate: (v) => validatePricingSchema(v), code: 'invalid_schema' },
  'unit-weight schema': { validate: (v) => validateUnitWeightSchema(v), code: 'invalid_schema' },
  'capability descriptor': { validate: (v) => validateCapabilityDescriptor(v), code: 'invalid_descriptor' },
};

/**
 * Validate `value` with the designated validator for `kind` and return a registered, deep-frozen
 * copy. This is the only path into the registry; the `assert*` functions are thin wrappers over it.
 */
export function validateAndSeal(kind: ConfigKind, value: unknown): Validated<unknown> {
  if (!Object.prototype.hasOwnProperty.call(VALIDATORS, kind)) throw new ContractError('unvalidated_config', 'unknown configuration kind');
  const { validate, code } = VALIDATORS[kind];
  const r = validate(value);
  if (!r.ok) throw new ContractError(code, r.errors.join('; '));
  return seal(r.value, kind);
}

/** Module-private: never exported, so nothing outside `validateAndSeal` can register an object. */
function seal<T>(value: T, kind: ConfigKind): Validated<T> {
  const copy = deepFreeze(JSON.parse(JSON.stringify(value)) as T);
  registry.set(copy as unknown as object, kind);
  return copy as Validated<T>;
}

/** Fail closed unless `value` came from the matching validator. */
export function requireValidated(value: unknown, kind: ConfigKind): void {
  if (value === null || typeof value !== 'object' || registry.get(value) !== kind) {
    throw new ContractError('unvalidated_config', `${kind} must come from its validator (assert*)`);
  }
}

export function isValidated(value: unknown, kind: ConfigKind): boolean {
  return value !== null && typeof value === 'object' && registry.get(value) === kind;
}
