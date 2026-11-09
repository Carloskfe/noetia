import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AttemptReconcileSummary, CostLedgerService } from './cost-ledger.service';

/**
 * Periodic, idempotent reconciliation of unresolved per-attempt reservations (NEM-021 §5 item 12).
 * Exists only while KnowledgeModule is registered (default off). Logs counts only — never user ids,
 * keys, amounts, or content.
 */
@Injectable()
export class CostReconciliationJobService {
  private readonly logger = new Logger(CostReconciliationJobService.name);
  private running = false;

  constructor(private readonly costLedger: CostLedgerService) {}

  @Interval('intelligence-cost-reconciliation', 60_000)
  async tick(): Promise<AttemptReconcileSummary | null> {
    if (this.running) return null;
    this.running = true;
    try {
      const s = await this.costLedger.reconcileAttempts();
      if (s.settled || s.released || s.flaggedExpired) {
        this.logger.log(`attempts reconciled settled=${s.settled} released=${s.released} flagged=${s.flaggedExpired} held=${s.held}`);
      }
      return s;
    } catch {
      this.logger.warn('attempt reconciliation pass failed; will retry');
      return null;
    } finally {
      this.running = false;
    }
  }
}
