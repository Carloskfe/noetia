/**
 * NEM-021 shared provider contract v1 — the single source of capability, usage, pricing,
 * unit-weight, and outcome definitions. Import from here; never redefine these elsewhere.
 */
export * from './version';
export * from './contract-error';
export * from './money';
export * from './outcomes';
export * from './capability';
export * from './usage';
export * from './rates';
export * from './pricing';
export * from './unit-weights';
export type { ValidationResult } from './validation';
export { isValidated, requireValidated } from './validated';
export type { Validated } from './validated';
