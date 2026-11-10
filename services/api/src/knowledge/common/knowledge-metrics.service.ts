import { Injectable } from '@nestjs/common';
import { Counter, register } from 'prom-client';

function counter(name: string, help: string, labelNames: string[] = []): Counter<string> {
  const existing = register.getSingleMetric(name);
  if (existing) return existing as Counter<string>;
  return new Counter({ name, help, labelNames });
}

/**
 * NEM-019 §13 metrics plus the NEM-021 cost-aware ledger counters (§5.14, §9.1). Labels carry no content,
 * user id, book id, provider, or model. Micro-USD counters are observability only: Prometheus counters are
 * floating point, so they are never used for accounting (the ledger rows are the record).
 */
@Injectable()
export class KnowledgeMetricsService {
  private readonly resolverDenied = counter(
    'intelligence_resolver_denied_total', 'Entitlement resolver denials', ['reason'],
  );
  private readonly limitRejected = counter(
    'intelligence_session_limit_rejected_total', 'Book additions rejected at the session limit', ['tier'],
  );
  private readonly scopeViolation = counter(
    'intelligence_scope_violation_total', 'Context invariant violations (turn aborted)',
  );
  private readonly budgetReserved = counter(
    'intelligence_budget_reserved_total', 'Budget reservations written to the ledger',
  );
  private readonly budgetRejected = counter(
    'intelligence_budget_rejected_total', 'Budget admissions rejected', ['tier'],
  );
  private readonly reservationExpired = counter(
    'intelligence_reservation_expired_total', 'Expired reservations flagged by reconciliation',
  );

  private readonly reservedMicroUsd = counter(
    'intelligence_budget_reserved_micro_usd_total', 'Worst-case micro-USD reserved by cost-aware admissions',
  );
  private readonly settledMicroUsd = counter(
    'intelligence_budget_settled_micro_usd_total', 'Actual micro-USD settled (full actual, including any overrun)',
  );
  private readonly costOverrun = counter(
    'intelligence_cost_overrun_total', 'Attempts whose actual cost exceeded the reservation (classified once)',
  );
  private readonly overspendMicroUsd = counter(
    'intelligence_overspend_micro_usd_total', 'Micro-USD by which actual cost exceeded reservations (classification only)',
  );
  // NEM-022 Gateway v2 (§13). Outcome labels are contract-v1 outcomes only — never content, provider, or model.
  private readonly gatewayOutcome = counter(
    'intelligence_gateway_outcome_total', 'Gateway attempts by terminal outcome (contract v1)', ['outcome'],
  );
  private readonly gatewayRetry = counter('intelligence_gateway_retry_total', 'Gateway retries (each a new reserved attempt)');
  private readonly capabilityUnavailable = counter(
    'intelligence_capability_unavailable_total', 'Requests no registered model could serve (denied before reservation)',
  );
  private readonly globalAllowanceRejected = counter(
    'intelligence_global_allowance_rejected_total', 'Cost-aware admissions rejected by the global micro-USD allowance',
  );

  resolverDeniedInc(reason: string) { this.resolverDenied.inc({ reason }); }
  limitRejectedInc(tier: string) { this.limitRejected.inc({ tier }); }
  scopeViolationInc() { this.scopeViolation.inc(); }
  budgetReservedInc() { this.budgetReserved.inc(); }
  budgetRejectedInc(tier: string) { this.budgetRejected.inc({ tier }); }
  reservationExpiredInc() { this.reservationExpired.inc(); }
  reservedMicroUsdInc(amount: bigint) { this.reservedMicroUsd.inc(Number(amount)); }
  settledMicroUsdInc(amount: bigint) { this.settledMicroUsd.inc(Number(amount)); }
  costOverrunInc() { this.costOverrun.inc(); }
  overspendMicroUsdInc(amount: bigint) { this.overspendMicroUsd.inc(Number(amount)); }
  globalAllowanceRejectedInc() { this.globalAllowanceRejected.inc(); }
  gatewayOutcomeInc(outcome: string) { this.gatewayOutcome.inc({ outcome }); }
  gatewayRetryInc() { this.gatewayRetry.inc(); }
  capabilityUnavailableInc() { this.capabilityUnavailable.inc(); }
}
