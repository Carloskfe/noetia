/**
 * Per-attempt idempotency keys (NEM-021 D15). Each provider attempt of a turn has its own key, derived
 * from the server-side turn key and the attempt number, so retries reserve and resolve independently.
 * Turn-level aggregation (by `turnKey`) is for reporting only.
 */
export const MAX_ATTEMPTS_PER_TURN = 99;

/** Fits ai_budget_ledger."idempotencyKey" varchar(128) together with the `:aNN` suffix. */
const MAX_TURN_KEY_LENGTH = 120;

export function attemptIdempotencyKey(turnKey: string, attemptNumber: number): string {
  if (typeof turnKey !== 'string' || turnKey.length === 0 || turnKey.length > MAX_TURN_KEY_LENGTH || /\s/.test(turnKey)) {
    throw new Error('invalid turn key');
  }
  if (!Number.isSafeInteger(attemptNumber) || attemptNumber < 1 || attemptNumber > MAX_ATTEMPTS_PER_TURN) {
    throw new Error(`attempt number must be an integer in [1, ${MAX_ATTEMPTS_PER_TURN}]`);
  }
  return `${turnKey}:a${attemptNumber}`;
}
