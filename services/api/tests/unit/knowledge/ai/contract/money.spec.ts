import {
  applyFactorBps, assertCount, assertRate, ContractError, fromPicoSum, guardColumn, MAX_BIGINT_COLUMN, MAX_RATE,
  roundCeiling, roundHalfUp,
} from '../../../../../src/knowledge/ai/contract';

describe('contract v1 money arithmetic (§9.2)', () => {
  const micro = (pico: bigint) => fromPicoSum(pico);

  it('ceiling rounds any fraction up (reservation)', () => {
    expect(roundCeiling(micro(0n))).toBe(0n);
    expect(roundCeiling(micro(1n))).toBe(1n);              // 0.000001 µUSD → 1
    expect(roundCeiling(micro(1_000_000n))).toBe(1n);      // exactly 1 µUSD
    expect(roundCeiling(micro(1_000_001n))).toBe(2n);
  });

  it('half up rounds .5 up and below .5 down (settlement)', () => {
    expect(roundHalfUp(micro(499_999n))).toBe(0n);
    expect(roundHalfUp(micro(500_000n))).toBe(1n);
    expect(roundHalfUp(micro(1_499_999n))).toBe(1n);
    expect(roundHalfUp(micro(1_500_000n))).toBe(2n);
  });

  it('ceiling is never below half up for the same amount', () => {
    for (let pico = 0n; pico < 3_000_000n; pico += 37_811n) {
      expect(roundCeiling(micro(pico)) >= roundHalfUp(micro(pico))).toBe(true);
    }
  });

  it('applies factor basis points exactly, without rounding', () => {
    const a = applyFactorBps(micro(111_000_000_000n), 5_000n); // ×0.5
    expect(a).toEqual({ numerator: 555_000_000_000_000n, denominator: 10_000_000_000n });
    expect(roundHalfUp(a)).toBe(55_500n);
  });

  it('rejects negative amounts and invalid counts or rates', () => {
    expect(() => roundCeiling({ numerator: -1n, denominator: 1n })).toThrow(ContractError);
    expect(() => roundHalfUp({ numerator: 1n, denominator: 0n })).toThrow(ContractError);
    for (const bad of [-1, 1.5, Number.MAX_SAFE_INTEGER + 2, '3', NaN]) expect(() => assertCount(bad, 'x')).toThrow(ContractError);
    for (const bad of [-1, 0.25, MAX_RATE + 1]) expect(() => assertRate(bad, 'x')).toThrow(ContractError);
    expect(assertRate(MAX_RATE, 'x')).toBe(BigInt(MAX_RATE));
  });

  it('fails closed above the bigint column range', () => {
    expect(guardColumn(MAX_BIGINT_COLUMN)).toBe(MAX_BIGINT_COLUMN);
    expect(() => guardColumn(MAX_BIGINT_COLUMN + 1n)).toThrow(expect.objectContaining({ code: 'overflow' }));
  });
});
