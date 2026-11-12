import { Injectable } from '@nestjs/common';
import { Counter, Histogram, register } from 'prom-client';

function counter(name: string, help: string, labelNames: string[] = []): Counter<string> {
  return (register.getSingleMetric(name) as Counter<string>) ?? new Counter({ name, help, labelNames });
}
function histogram(name: string, help: string, labelNames: string[]): Histogram<string> {
  return (register.getSingleMetric(name) as Histogram<string>) ?? new Histogram({ name, help, labelNames, buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10] });
}

/** NEM-024 turn metrics. Fixed enumerations only: no question, answer, user id, book id, or key in any label. */
@Injectable()
export class TurnMetricsService {
  private readonly stage = histogram('intelligence_turn_stage_seconds', 'Question-turn stage durations', ['stage']);
  private readonly finalized = counter('intelligence_turn_finalized_total', 'Provisional turns finalized as interrupted', ['via']);
  private readonly cancelled = counter('intelligence_turn_cancelled_total', 'Explicit cancellations that committed T3');
  private readonly guardRejected = counter('intelligence_turn_guard_rejected_total', 'Requests refused by the weighted guard', ['reason']);
  private readonly unrecorded = counter('intelligence_turn_unrecorded_total', 'Answers delivered without a durable record (D-8)');
  private readonly fenced = counter('intelligence_turn_fenced_total', 'Owner transitions that lost to another terminal outcome');

  observeStage(stage: 'retrieval' | 'prepare' | 'provider' | 'history', seconds: number) { this.stage.observe({ stage }, seconds); }
  finalizedInc(via: 'sweep' | 'lazy', n = 1) { if (n > 0) this.finalized.inc({ via }, n); }
  cancelledInc() { this.cancelled.inc(); }
  guardRejectedInc(reason: string) { this.guardRejected.inc({ reason }); }
  unrecordedInc() { this.unrecorded.inc(); }
  fencedInc() { this.fenced.inc(); }
}
