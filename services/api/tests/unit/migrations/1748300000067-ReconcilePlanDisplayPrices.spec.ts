import { QueryRunner } from 'typeorm';
import {
  PLAN_PRICE_CORRECTIONS,
  ReconcilePlanDisplayPrices1748300000067,
} from '../../../src/migrations/1748300000067-ReconcilePlanDisplayPrices';

type PlanRow = {
  id: string;
  name: string;
  interval: string;
  amountCents: number;
  stripePriceId: string;
  tokensPerCycle: number;
  maxProfiles: number;
  createdAt: string;
};


// Mirrors the production plan state verified on 2026-10-31 (Q1): four legacy rows + two Family rows.
function productionPlans(): PlanRow[] {
  return [
    { id: 'p-ind-m', name: 'Individual Monthly', interval: 'month', amountCents: 999, stripePriceId: 'price_live_ind_m', tokensPerCycle: 1, maxProfiles: 1, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'p-ind-y', name: 'Individual Annual', interval: 'year', amountCents: 8900, stripePriceId: 'price_live_ind_y', tokensPerCycle: 1, maxProfiles: 1, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'p-dual-m', name: 'Dual Reader Monthly', interval: 'month', amountCents: 1499, stripePriceId: 'price_live_duo_m', tokensPerCycle: 2, maxProfiles: 2, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'p-dual-y', name: 'Dual Reader Annual', interval: 'year', amountCents: 13500, stripePriceId: 'price_live_duo_y', tokensPerCycle: 2, maxProfiles: 2, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'p-fam-m', name: 'Family', interval: 'month', amountCents: 1899, stripePriceId: 'price_live_fam_m', tokensPerCycle: 4, maxProfiles: 5, createdAt: '2026-06-01T00:00:00Z' },
    { id: 'p-fam-y', name: 'Family', interval: 'year', amountCents: 17999, stripePriceId: 'price_live_fam_y', tokensPerCycle: 4, maxProfiles: 5, createdAt: '2026-06-01T00:00:00Z' },
  ];
}

/** Minimal in-memory stand-in for the two statements the migration issues. */
function fakeQueryRunner(plans: PlanRow[]) {
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (/^SELECT "id", "amountCents" FROM "plans" WHERE "name" = \$1 AND "interval" = \$2 FOR UPDATE$/.test(sql)) {
      const [name, interval] = params;
      return plans
        .filter((p) => p.name === name && p.interval === interval)
        .map((p) => ({ id: p.id, amountCents: p.amountCents }));
    }
    if (/^UPDATE "plans" SET "amountCents" = \$1 WHERE "id" = \$2 AND "amountCents" = \$3$/.test(sql)) {
      const [to, id, from] = params as [number, string, number];
      const row = plans.find((p) => p.id === id && p.amountCents === from);
      if (row) row.amountCents = to;
      return [[], row ? 1 : 0];
    }
    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
  return { runner: { query } as unknown as QueryRunner, query };
}

const updateCalls = (query: jest.Mock) => query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'));

describe('ReconcilePlanDisplayPrices1748300000067', () => {
  let migration: ReconcilePlanDisplayPrices1748300000067;

  beforeEach(() => {
    migration = new ReconcilePlanDisplayPrices1748300000067();
  });

  it('targets exactly the four approved corrections', () => {
    expect(PLAN_PRICE_CORRECTIONS).toEqual([
      { name: 'Individual Monthly', interval: 'month', oldCents: 999, newCents: 899 },
      { name: 'Individual Annual', interval: 'year', oldCents: 8900, newCents: 8399 },
      { name: 'Dual Reader Monthly', interval: 'month', oldCents: 1499, newCents: 1399 },
      { name: 'Dual Reader Annual', interval: 'year', oldCents: 13500, newCents: 12999 },
    ]);
  });

  describe('up', () => {
    it('applies all four price changes', async () => {
      const plans = productionPlans();
      const { runner, query } = fakeQueryRunner(plans);

      await migration.up(runner);

      const byId = Object.fromEntries(plans.map((p) => [p.id, p.amountCents]));
      expect(byId['p-ind-m']).toBe(899);
      expect(byId['p-ind-y']).toBe(8399);
      expect(byId['p-dual-m']).toBe(1399);
      expect(byId['p-dual-y']).toBe(12999);
      expect(updateCalls(query)).toHaveLength(4);
    });

    it('preserves every other column and leaves unrelated rows untouched', async () => {
      const plans = productionPlans();
      const before = productionPlans();
      const { runner } = fakeQueryRunner(plans);

      await migration.up(runner);

      plans.forEach((after, i) => {
        const { amountCents: _a, ...restAfter } = after;
        const { amountCents: _b, ...restBefore } = before[i];
        expect(restAfter).toEqual(restBefore);
      });
      expect(plans.filter((p) => p.name === 'Family')).toEqual(before.filter((p) => p.name === 'Family'));
      expect(plans).toHaveLength(6);
    });

    it('never references token_packages', async () => {
      const { runner, query } = fakeQueryRunner(productionPlans());

      await migration.up(runner);

      expect(query.mock.calls.every(([sql]) => /"plans"/.test(sql) && !sql.includes('token_packages'))).toBe(true);
    });

    it('only ever writes amountCents, keyed by id and guarded by the old amount', async () => {
      const { runner, query } = fakeQueryRunner(productionPlans());

      await migration.up(runner);

      for (const [sql] of updateCalls(query)) {
        expect(sql).toBe('UPDATE "plans" SET "amountCents" = $1 WHERE "id" = $2 AND "amountCents" = $3');
      }
    });

    it('is a no-op when prices are already correct', async () => {
      const plans = productionPlans();
      const { runner, query } = fakeQueryRunner(plans);
      await migration.up(runner);
      const afterFirst = JSON.parse(JSON.stringify(plans));
      query.mockClear();

      await migration.up(runner);

      expect(updateCalls(query)).toHaveLength(0);
      expect(plans).toEqual(afterFirst);
    });

    it('updates only the rows still at the old amount when some are already correct', async () => {
      const plans = productionPlans();
      plans.find((p) => p.id === 'p-ind-m')!.amountCents = 899;
      plans.find((p) => p.id === 'p-dual-y')!.amountCents = 12999;
      const { runner, query } = fakeQueryRunner(plans);

      await migration.up(runner);

      expect(updateCalls(query).map(([, params]) => params[1])).toEqual(['p-ind-y', 'p-dual-m']);
      expect(plans.slice(0, 4).map((p) => p.amountCents)).toEqual([899, 8399, 1399, 12999]);
    });

    it('aborts with no writes when an amount is unexpected', async () => {
      const plans = productionPlans();
      plans.find((p) => p.id === 'p-dual-y')!.amountCents = 13000;
      const { runner, query } = fakeQueryRunner(plans);

      await expect(migration.up(runner)).rejects.toThrow(
        'unexpected amountCents 13000 for "Dual Reader Annual" (year) (expected 13500 or 12999). No changes made.',
      );
      expect(updateCalls(query)).toHaveLength(0);
      expect(plans).toEqual((() => { const p = productionPlans(); p[3].amountCents = 13000; return p; })());
    });

    it('aborts with no writes when a plan row is missing', async () => {
      const plans = productionPlans().filter((p) => p.id !== 'p-ind-y');
      const { runner, query } = fakeQueryRunner(plans);

      await expect(migration.up(runner)).rejects.toThrow(
        'expected exactly 1 plan row for "Individual Annual" (year), found 0. No changes made.',
      );
      expect(updateCalls(query)).toHaveLength(0);
      expect(plans.find((p) => p.id === 'p-ind-m')!.amountCents).toBe(999);
    });

    it('aborts with no writes when a plan row is duplicated', async () => {
      const plans = productionPlans();
      plans.push({ ...plans[3], id: 'p-dual-y-dup' });
      const { runner, query } = fakeQueryRunner(plans);

      await expect(migration.up(runner)).rejects.toThrow(
        'expected exactly 1 plan row for "Dual Reader Annual" (year), found 2. No changes made.',
      );
      expect(updateCalls(query)).toHaveLength(0);
    });

    it('does not match a row whose name is right but interval is wrong', async () => {
      const plans = productionPlans();
      plans.find((p) => p.id === 'p-ind-m')!.interval = 'year';
      const { runner, query } = fakeQueryRunner(plans);

      await expect(migration.up(runner)).rejects.toThrow(
        'expected exactly 1 plan row for "Individual Monthly" (month), found 0. No changes made.',
      );
      expect(updateCalls(query)).toHaveLength(0);
    });

    it('propagates database errors without further writes', async () => {
      const { runner, query } = fakeQueryRunner(productionPlans());
      query.mockRejectedValueOnce(new Error('connection lost'));

      await expect(migration.up(runner)).rejects.toThrow('connection lost');
      expect(updateCalls(query)).toHaveLength(0);
    });
  });

  describe('down', () => {
    it('restores the previous amounts after up', async () => {
      const plans = productionPlans();
      const { runner } = fakeQueryRunner(plans);

      await migration.up(runner);
      await migration.down(runner);

      expect(plans).toEqual(productionPlans());
    });

    it('is a no-op when prices are already at the old amounts', async () => {
      const { runner, query } = fakeQueryRunner(productionPlans());

      await migration.down(runner);

      expect(updateCalls(query)).toHaveLength(0);
    });

    it('aborts with no writes on an unexpected amount', async () => {
      const plans = productionPlans();
      plans.forEach((p, i) => { if (i < 4) p.amountCents = PLAN_PRICE_CORRECTIONS[i].newCents; });
      plans[0].amountCents = 1;
      const { runner, query } = fakeQueryRunner(plans);

      await expect(migration.down(runner)).rejects.toThrow('unexpected amountCents 1');
      expect(updateCalls(query)).toHaveLength(0);
    });
  });
});
