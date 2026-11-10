import { IntelligenceDenied } from '../common/intelligence-denied.error';
import { DenialReason } from '../knowledge.types';

/**
 * A denial that also carries the turn's recorded state (review package Q-4: reuse the accepted `DenialReason` codes
 * with a status payload instead of adding codes). The payload never contains question, answer, or excerpt text.
 */
export interface TurnStatusDetail {
  turnId?: string;
  status: 'accepted' | 'pending' | 'failed' | 'cancelled' | 'interrupted' | 'unknown';
  reservationRelease?: 'released' | 'unconfirmed';
  /** False when a terminal failure record could not be written (Amendment 1, B-2 residual). */
  recorded?: boolean;
  exclusions?: Record<string, string[]>;
  /** Weighted-guard refusal (Checkpoint B): retry hint and reason; no charge was made. */
  retryAfterSeconds?: number;
  guard?: 'over_limit' | 'exceeds_limit';
}

export class TurnStatusDenied extends IntelligenceDenied {
  constructor(reason: DenialReason, readonly detail: TurnStatusDetail) {
    super(reason);
  }

  getResponse(): string | object {
    const base = super.getResponse();
    return { ...(typeof base === 'object' ? base : { message: base }), ...this.detail };
  }
}
