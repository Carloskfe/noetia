import { register } from 'prom-client';
import { KnowledgeMetricsService } from '../../../../src/knowledge/common/knowledge-metrics.service';

const value = async (name: string) => (await register.getSingleMetric(name)!.get()).values.reduce((a, v) => a + v.value, 0);

describe('KnowledgeMetricsService — NEM-021 cost counters (§5.14, §9.1)', () => {
  it('exposes the five new counters, label-free, alongside the NEM-019 ones', async () => {
    const m = new KnowledgeMetricsService();
    const before = {
      reserved: await value('intelligence_budget_reserved_micro_usd_total'),
      settled: await value('intelligence_budget_settled_micro_usd_total'),
      overrun: await value('intelligence_cost_overrun_total'),
      overspend: await value('intelligence_overspend_micro_usd_total'),
      global: await value('intelligence_global_allowance_rejected_total'),
    };
    m.reservedMicroUsdInc(1_000_000n);
    m.settledMicroUsdInc(1_400_000n);
    m.costOverrunInc();
    m.overspendMicroUsdInc(400_000n);
    m.globalAllowanceRejectedInc();
    expect(await value('intelligence_budget_reserved_micro_usd_total')).toBe(before.reserved + 1_000_000);
    expect(await value('intelligence_budget_settled_micro_usd_total')).toBe(before.settled + 1_400_000);
    expect(await value('intelligence_cost_overrun_total')).toBe(before.overrun + 1);
    expect(await value('intelligence_overspend_micro_usd_total')).toBe(before.overspend + 400_000);
    expect(await value('intelligence_global_allowance_rejected_total')).toBe(before.global + 1);
    for (const n of ['intelligence_budget_reserved_micro_usd_total', 'intelligence_cost_overrun_total', 'intelligence_global_allowance_rejected_total']) {
      expect((await register.getSingleMetric(n)!.get()).values.every((v) => Object.keys(v.labels).length === 0)).toBe(true);
    }
    for (const n of ['intelligence_budget_reserved_total', 'intelligence_budget_rejected_total', 'intelligence_reservation_expired_total',
      'intelligence_resolver_denied_total', 'intelligence_session_limit_rejected_total', 'intelligence_scope_violation_total']) {
      expect(register.getSingleMetric(n)).toBeDefined();
    }
  });

  it('a second instance reuses the registered counters (no duplicate registration)', () => {
    expect(() => new KnowledgeMetricsService()).not.toThrow();
  });
});
