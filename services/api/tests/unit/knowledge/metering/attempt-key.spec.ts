import { attemptIdempotencyKey, MAX_ATTEMPTS_PER_TURN } from '../../../../src/knowledge/metering/attempt-key';

describe('attemptIdempotencyKey (D15)', () => {
  it('derives a distinct, deterministic key per attempt of a turn', () => {
    expect(attemptIdempotencyKey('turn:abc', 1)).toBe('turn:abc:a1');
    expect(attemptIdempotencyKey('turn:abc', 2)).not.toBe(attemptIdempotencyKey('turn:abc', 1));
    expect(attemptIdempotencyKey('turn:abc', 3)).toBe(attemptIdempotencyKey('turn:abc', 3));
  });

  it('fits the 128-character key column for the longest turn key and attempt number', () => {
    expect(attemptIdempotencyKey('t'.repeat(120), MAX_ATTEMPTS_PER_TURN).length).toBeLessThanOrEqual(128);
  });

  it.each([0, -1, 1.5, NaN, MAX_ATTEMPTS_PER_TURN + 1])('rejects attempt number %p', (n) => {
    expect(() => attemptIdempotencyKey('turn:abc', n)).toThrow('attempt number');
  });

  it.each(['', 'has space', 't'.repeat(121), 42 as unknown as string])('rejects turn key %p', (k) => {
    expect(() => attemptIdempotencyKey(k, 1)).toThrow('invalid turn key');
  });
});
