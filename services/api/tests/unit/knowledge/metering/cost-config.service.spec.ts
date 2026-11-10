import { isValidated, MAX_RATE } from '../../../../src/knowledge/ai/contract';
import { RAW_FIXTURE_PRICING_A, RAW_FIXTURE_UNIT_WEIGHTS } from '../../../../src/knowledge/ai/contract/fixtures';
import { CostConfigError, CostConfigService } from '../../../../src/knowledge/metering/cost-config.service';
import { GLOBAL_ADMISSION_LOCK } from '../../../../src/knowledge/metering/budget-ledger.service';
import { FakeDb } from '../support/fixtures';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const setup = () => {
  const db = new FakeDb();
  return { db, svc: new CostConfigService(db as any) };
};

describe('CostConfigService — pricing schemas', () => {
  it('validates through the contract boundary before insert and stores the canonical JSON', async () => {
    const { db, svc } = setup();
    db.on(/INSERT INTO ai_pricing_schemas/, () => [{ id: 'ps-1' }]);
    expect(await svc.addPricingSchema(clone(RAW_FIXTURE_PRICING_A), { expiresAt: new Date('2030-01-01T00:00:00Z') })).toBe('ps-1');
    const p = db.ran(/INSERT INTO ai_pricing_schemas/)[0].params;
    expect(p.slice(0, 4)).toEqual(['fixture-pricing-a-v1', 'fixture-a', 'fixture-a-mid', 1]);
    expect(JSON.parse(p[4])).toEqual(RAW_FIXTURE_PRICING_A);
    expect(p[5]).toBe(true);
    // Cached as a sealed object: a pinned lookup needs no query and no revalidation.
    const sealed = await svc.pricingSchemaById('ps-1');
    expect(isValidated(sealed, 'pricing schema')).toBe(true);
    expect(db.ran(/SELECT schema FROM ai_pricing_schemas/)).toHaveLength(0);
  });

  it('a malformed schema is rejected before any write', async () => {
    const { db, svc } = setup();
    const bad = clone(RAW_FIXTURE_PRICING_A) as any;
    bad.base.output = MAX_RATE + 1;
    await expect(svc.addPricingSchema(bad)).rejects.toMatchObject({ code: 'invalid_schema' });
    expect(db.calls).toHaveLength(0);
  });

  it('activePricingSchema: ok (sealed), missing, expired, or invalid stored JSON', async () => {
    const { db, svc } = setup();
    let row: object | null = { id: 'ps-1', schema: clone(RAW_FIXTURE_PRICING_A), expired: false };
    db.on(/FROM ai_pricing_schemas WHERE provider = \$1/, () => (row ? [row] : []));
    const ok = await svc.activePricingSchema('fixture-a', 'fixture-a-mid');
    expect(ok.status).toBe('ok');
    expect(isValidated((ok as any).schema, 'pricing schema')).toBe(true);
    row = null;
    expect(await svc.activePricingSchema('x', 'y')).toEqual({ status: 'missing' });
    row = { id: 'ps-2', schema: clone(RAW_FIXTURE_PRICING_A), expired: true };
    expect(await svc.activePricingSchema('x', 'y')).toEqual({ status: 'expired' });
    row = { id: 'ps-3', schema: { tampered: true }, expired: false };
    expect(await svc.activePricingSchema('x', 'y')).toEqual({ status: 'invalid' });
  });

  it('pricingSchemaById: loads and seals once; null id or missing row → null; invalid stored JSON → null', async () => {
    const { db, svc } = setup();
    db.on(/SELECT schema FROM ai_pricing_schemas WHERE id/, (p) => (p[0] === 'ps-1' ? [{ schema: clone(RAW_FIXTURE_PRICING_A) }] : p[0] === 'bad' ? [{ schema: {} }] : []));
    const a = await svc.pricingSchemaById('ps-1');
    expect(await svc.pricingSchemaById('ps-1')).toBe(a);
    expect(db.ran(/SELECT schema FROM ai_pricing_schemas/)).toHaveLength(1);
    expect(await svc.pricingSchemaById(null)).toBeNull();
    expect(await svc.pricingSchemaById('none')).toBeNull();
    expect(await svc.pricingSchemaById('bad')).toBeNull();
  });

  describe('activatePricingSchema (breaker review gate, §9.1 rule 3)', () => {
    const activation = (open: string[]) => {
      const ctx = setup();
      ctx.db.on(/^SELECT provider, "modelKey" FROM ai_pricing_schemas WHERE id/, (p) => (p[0] === 'unknown' ? [] : [{ provider: 'fixture-a', modelKey: 'fixture-a-mid' }]));
      ctx.db.on(/pg_advisory_xact_lock/, () => [{}]);
      ctx.db.on(/FROM ai_overrun_breakers b JOIN/, () => open.map((id) => ({ pricingSchemaId: id })));
      ctx.db.on(/UPDATE ai_pricing_schemas SET active = false/, () => []);
      ctx.db.on(/UPDATE ai_pricing_schemas SET active = true/, () => []);
      // The closure runs as `WITH closed AS (UPDATE … RETURNING) SELECT count(*)`, so the driver returns one count row
      // (a bare UPDATE … RETURNING returns `[rows, rowCount]` through TypeORM on PostgreSQL).
      ctx.db.on(/WITH closed AS \(\s*UPDATE ai_overrun_breakers SET state = 'closed'/, (p) => [{ n: p[2].length }]);
      return ctx;
    };

    it('with no open breaker: deactivates the old version and activates the new one, serialized per model', async () => {
      const { db, svc } = activation([]);
      expect(await svc.activatePricingSchema('ps-2')).toEqual({ closedBreakers: 0 });
      expect(db.ran(/pg_advisory_xact_lock/)[0].params).toEqual(['intelligence:pricing-activation:v1:fixture-a:fixture-a-mid']);
      expect(db.ran(/SET active = true/)[0].params).toEqual(['ps-2', null]);
      expect(db.ran(/UPDATE ai_overrun_breakers/)).toHaveLength(0);
    });

    it('with an open breaker: requires a review reference, then closes it and records the reference and replacement', async () => {
      await expect(activation(['ps-1']).svc.activatePricingSchema('ps-2')).rejects.toThrow('review reference is required');
      const { db, svc } = activation(['ps-1']);
      expect(await svc.activatePricingSchema('ps-2', 'PA-review-2026-11-09')).toEqual({ closedBreakers: 1 });
      expect(db.ran(/UPDATE ai_overrun_breakers/)[0].params).toEqual(['ps-2', 'PA-review-2026-11-09', ['ps-1']]);
      expect(db.ran(/SET active = true/)[0].params).toEqual(['ps-2', 'PA-review-2026-11-09']);
    });

    it('the schema with the open breaker cannot be re-activated, even with a reference', async () => {
      await expect(activation(['ps-1']).svc.activatePricingSchema('ps-1', 'ref')).rejects.toThrow('reviewed replacement');
    });

    it('rejects unknown schemas and malformed references', async () => {
      await expect(activation([]).svc.activatePricingSchema('unknown')).rejects.toBeInstanceOf(CostConfigError);
      for (const ref of ['', '   ', 'x'.repeat(257), 7 as any]) {
        await expect(activation([]).svc.activatePricingSchema('ps-2', ref)).rejects.toThrow('review reference');
      }
    });
  });
});

describe('CostConfigService — unit-weight schemas', () => {
  it('validates before insert, caches the sealed schema, and activates exactly one', async () => {
    const { db, svc } = setup();
    db.on(/INSERT INTO ai_unit_weight_schemas/, () => [{ id: 'uw-1' }]);
    db.on(/pg_advisory_xact_lock/, () => [{}]);
    db.on(/SELECT 1 AS ok FROM ai_unit_weight_schemas/, () => [{ ok: 1 }]);
    db.on(/UPDATE ai_unit_weight_schemas SET active/, () => []);
    expect(await svc.addUnitWeightSchema(clone(RAW_FIXTURE_UNIT_WEIGHTS))).toBe('uw-1');
    await svc.activateUnitWeightSchema('uw-1');
    expect(db.ran(/UPDATE ai_unit_weight_schemas SET active = false WHERE active AND id <> \$1/)[0].params).toEqual(['uw-1']);
    expect(db.ran(/SET active = true, "activatedAt" = now\(\)/)).toHaveLength(1);
    expect(isValidated(await svc.unitWeightSchemaById('uw-1'), 'unit-weight schema')).toBe(true);
  });

  it('rejects malformed weights; unknown ids cannot be activated', async () => {
    const { db, svc } = setup();
    const bad = clone(RAW_FIXTURE_UNIT_WEIGHTS) as any;
    bad.weights.output = -1;
    await expect(svc.addUnitWeightSchema(bad)).rejects.toMatchObject({ code: 'invalid_schema' });
    db.on(/pg_advisory_xact_lock/, () => [{}]);
    db.on(/SELECT 1 AS ok FROM ai_unit_weight_schemas/, () => []);
    await expect(svc.activateUnitWeightSchema('nope')).rejects.toThrow('unknown configuration row');
  });

  it('activeUnitWeightSchema / unitWeightSchemaById: sealed, null when absent or invalid', async () => {
    const { db, svc } = setup();
    let active: object[] = [{ id: 'uw-1', schema: clone(RAW_FIXTURE_UNIT_WEIGHTS) }];
    db.on(/FROM ai_unit_weight_schemas WHERE active/, () => active);
    db.on(/SELECT schema FROM ai_unit_weight_schemas WHERE id/, (p) => (p[0] === 'uw-bad' ? [{ schema: { x: 1 } }] : []));
    expect(isValidated((await svc.activeUnitWeightSchema())!.schema, 'unit-weight schema')).toBe(true);
    active = [];
    expect(await svc.activeUnitWeightSchema()).toBeNull();
    active = [{ id: 'uw-2', schema: { x: 1 } }];
    expect(await svc.activeUnitWeightSchema()).toBeNull();
    expect(await svc.unitWeightSchemaById(null)).toBeNull();
    expect(await svc.unitWeightSchemaById('missing')).toBeNull();
    expect(await svc.unitWeightSchemaById('uw-bad')).toBeNull();
  });
});

describe('CostConfigService — global budget policies (D14)', () => {
  const input = { periodDays: 30, allowanceMicroUsd: 5_000_000n, maxUnresolvedMicroUsd: 2_000_000n, isTestFixture: true };

  it('stores integer micro-USD as text (no float), next version, inactive until activated', async () => {
    const { db, svc } = setup();
    db.on(/INSERT INTO ai_global_budget_policies/, () => [{ id: 'g-1' }]);
    expect(await svc.addGlobalPolicy(input)).toBe('g-1');
    expect(db.ran(/INSERT INTO ai_global_budget_policies/)[0].params).toEqual([30, '5000000', '2000000', true]);
  });

  it.each([
    ['periodDays 0', { periodDays: 0 }],
    ['fractional periodDays', { periodDays: 1.5 }],
    ['negative allowance', { allowanceMicroUsd: -1n }],
    ['number instead of bigint', { allowanceMicroUsd: 5 as any }],
    ['above the bigint column', { maxUnresolvedMicroUsd: 2n ** 63n }],
    ['undeclared fixture marker', { isTestFixture: undefined as any }],
  ])('rejects %s', async (_l, over) => {
    const { db, svc } = setup();
    await expect(svc.addGlobalPolicy({ ...input, ...over })).rejects.toBeInstanceOf(CostConfigError);
    expect(db.calls).toHaveLength(0);
  });

  it('activeGlobalPolicy parses bigint columns exactly; null when unset (admission then denies)', async () => {
    const { db, svc } = setup();
    let rows: object[] = [{ id: 'g-1', version: 2, periodDays: 30, allowanceMicroUsd: '9223372036854775807', maxUnresolvedMicroUsd: '1' }];
    db.on(/FROM ai_global_budget_policies WHERE active/, () => rows);
    expect(await svc.activeGlobalPolicy()).toEqual({ id: 'g-1', version: 2, periodDays: 30, allowanceMicroUsd: 9223372036854775807n, maxUnresolvedMicroUsd: 1n });
    rows = [];
    expect(await svc.activeGlobalPolicy()).toBeNull();
  });

  it('activateGlobalPolicy takes the B-6 global admission lock FIRST (F-9), then its own lock, in one transaction', async () => {
    const { db, svc } = setup();
    db.on(/pg_advisory_xact_lock/, () => [{}]);
    db.on(/SELECT 1 AS ok FROM ai_global_budget_policies/, () => [{ ok: 1 }]);
    db.on(/UPDATE ai_global_budget_policies SET active/, () => []);
    await svc.activateGlobalPolicy('g-2');
    expect(db.ran(/pg_advisory_xact_lock/).map((c) => c.params[0]))
      .toEqual([GLOBAL_ADMISSION_LOCK, 'intelligence:ai_global_budget_policies-activation:v1']);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    const sqls = db.calls.map((c) => c.sql);
    expect(sqls.findIndex((q) => /pg_advisory_xact_lock/.test(q))).toBeLessThan(sqls.findIndex((q) => /UPDATE ai_global_budget_policies/.test(q)));
    expect(db.ran(/SET active = true WHERE id = \$1/)[0].params).toEqual(['g-2']);
  });

  it('unit-weight activation does not take the global admission lock (weights are pinned per reservation, not part of D14)', async () => {
    const { db, svc } = setup();
    db.on(/pg_advisory_xact_lock/, () => [{}]);
    db.on(/SELECT 1 AS ok FROM ai_unit_weight_schemas/, () => [{ ok: 1 }]);
    db.on(/UPDATE ai_unit_weight_schemas SET active/, () => []);
    await svc.activateUnitWeightSchema('uw-1');
    expect(db.ran(/pg_advisory_xact_lock/).map((c) => c.params[0])).toEqual(['intelligence:ai_unit_weight_schemas-activation:v1']);
  });
});
