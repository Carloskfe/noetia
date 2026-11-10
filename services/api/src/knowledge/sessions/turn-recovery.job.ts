import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TurnMetricsService } from './turn-metrics.service';
import { TurnRecordStore } from './turn-record.store';

/**
 * NEM-024 Checkpoint B — periodic recovery of stranded provisional turns (release condition, PO-036): finalizes
 * `accepted` rows whose database fence has passed as `interrupted` (T4). Independent of the original request process.
 * Never reserves, never invokes a provider, never reads or writes the ledger (held attempts resolve through the
 * existing NEM-021 reconciliation). Logs counts only. Exists only while KnowledgeModule is registered (default off).
 */
@Injectable()
export class TurnRecoveryJobService {
  private readonly logger = new Logger(TurnRecoveryJobService.name);
  private running = false;

  constructor(private readonly records: TurnRecordStore, private readonly metrics: TurnMetricsService) {}

  @Interval('intelligence-turn-recovery', 60_000)
  async tick(): Promise<number | null> {
    if (this.running) return null;
    this.running = true;
    try {
      const n = await this.records.sweep(500);
      this.metrics.finalizedInc('sweep', n);
      if (n > 0) this.logger.log(`turns finalized as interrupted count=${n}`);
      return n;
    } catch {
      this.logger.warn('turn recovery sweep failed; will retry');
      return null;
    } finally {
      this.running = false;
    }
  }
}
