import { ContractError } from './contract-error';

/**
 * The single runtime validation boundary for configuration (checkpoint finding F-6).
 *
 * Pricing schemas, unit-weight schemas, and capability descriptors are validated exactly once,
 * by their `assert*` function, which returns a **deep-frozen copy registered here**. Every monetary
 * function accepts only registered objects:
 * - no revalidation per calculation (a constant-time membership check);
 * - a raw object, a spread copy, or a hand-built object is not registered and is rejected;
 * - registered objects are frozen, so they cannot be changed after validation.
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

/** Called only by the `assert*` validators after successful validation. */
export function sealValidated<T>(value: T, kind: ConfigKind): Validated<T> {
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
