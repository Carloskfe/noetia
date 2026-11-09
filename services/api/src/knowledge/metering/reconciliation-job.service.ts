import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BudgetLedgerService, ReconcileSummary } from './budget-ledger.service';

/**
 * Periodic, idempotent reconciliation of unresolved reservations (ADR-005 B-5).
 * Exists only while KnowledgeModule is registered (default off). Logs counts
 * only — never user ids, keys, or content.
 */
@Injectable()
export class ReconciliationJobService {
  private readonly logger = new Logger(ReconciliationJobService.name);
  private running = false;

  constructor(private readonly ledger: BudgetLedgerService) {}

  @Interval('intelligence-reconciliation', 60_000)
  async tick(): Promise<ReconcileSummary | null> {
    if (this.running) return null;
    this.running = true;
    try {
      const s = await this.ledger.reconcile();
      if (s.settled || s.released || s.flaggedExpired) {
        this.logger.log(`reconciled settled=${s.settled} released=${s.released} flagged=${s.flaggedExpired} held=${s.held}`);
      }
      return s;
    } catch {
      this.logger.warn('reconciliation pass failed; will retry');
      return null;
    } finally {
      this.running = false;
    }
  }
}
