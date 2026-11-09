import { Injectable } from '@nestjs/common';
import { Counter, register } from 'prom-client';

function counter(name: string, help: string, labelNames: string[] = []): Counter<string> {
  const existing = register.getSingleMetric(name);
  if (existing) return existing as Counter<string>;
  return new Counter({ name, help, labelNames });
}

/** NEM-019 §13 metrics. Labels carry no content, user id, or book id. */
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

  resolverDeniedInc(reason: string) { this.resolverDenied.inc({ reason }); }
  limitRejectedInc(tier: string) { this.limitRejected.inc({ tier }); }
  scopeViolationInc() { this.scopeViolation.inc(); }
  budgetReservedInc() { this.budgetReserved.inc(); }
  budgetRejectedInc(tier: string) { this.budgetRejected.inc({ tier }); }
  reservationExpiredInc() { this.reservationExpired.inc(); }
}
