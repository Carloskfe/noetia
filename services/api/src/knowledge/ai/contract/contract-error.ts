/** Codes for contract violations. Callers fail closed on any of them. */
export type ContractErrorCode =
  | 'invalid_schema'
  | 'invalid_usage'
  | 'invalid_descriptor'
  | 'invalid_request'
  | 'schema_mismatch'
  | 'context_too_large'
  | 'output_bound_exceeded'
  | 'unknown_cache_lifetime'
  | 'unknown_modifier'
  | 'unpriced_unit'
  | 'overflow'
  | 'invalid_outcome_combination';

export class ContractError extends Error {
  constructor(readonly code: ContractErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'ContractError';
  }
}
