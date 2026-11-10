import { register } from 'prom-client';
import { TurnMetricsService } from '../../../../src/knowledge/sessions/turn-metrics.service';

describe('TurnMetricsService (content-free labels)', () => {
  it('registers once and records every metric with fixed labels only', async () => {
    const m = new TurnMetricsService();
    new TurnMetricsService();
    m.observeStage('retrieval', 0.2); m.finalizedInc('lazy'); m.finalizedInc('sweep', 0); m.cancelledInc();
    m.guardRejectedInc('over_limit'); m.unrecordedInc(); m.fencedInc();
    for (const n of ['intelligence_turn_stage_seconds', 'intelligence_turn_finalized_total', 'intelligence_turn_cancelled_total',
      'intelligence_turn_guard_rejected_total', 'intelligence_turn_unrecorded_total', 'intelligence_turn_fenced_total']) {
      const labels = (await register.getSingleMetric(n)!.get()).values.flatMap((v: any) => Object.keys(v.labels));
      expect({ n, ok: labels.every((l: string) => ['stage', 'via', 'reason', 'le'].includes(l)) }).toEqual({ n, ok: true });
    }
  });
});
