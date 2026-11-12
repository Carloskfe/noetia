import { Injectable } from '@nestjs/common';

/**
 * NEM-024 Checkpoint B (D-11) — per-process WEIGHTED guard on in-flight S2 work (retrieval and history excerpt
 * re-materialization): Σ weight ≤ W, where weight = number of books whose texts are fetched and verified.
 * Admission happens BEFORE any reservation; over the limit the caller is refused (no queueing).
 *
 * W = 10 is a performance-test CANDIDATE (PO-034 D-11), not a guaranteed capacity; it is configurable
 * (`INTELLIGENCE_TURN_WEIGHT_LIMIT`) for the 10 → 6 → 3 fallback evaluation. A single request heavier than W can never
 * be admitted — if that happens for 10-book sessions it is a product conflict (PO-027) to escalate (Q-11).
 */
export const DEFAULT_TURN_WEIGHT_LIMIT = 10;

export function turnWeightLimitFromEnv(env: NodeJS.ProcessEnv): number {
  const n = Number.parseInt(env.INTELLIGENCE_TURN_WEIGHT_LIMIT ?? '', 10);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : DEFAULT_TURN_WEIGHT_LIMIT;
}

export type GuardRejection = 'over_limit' | 'exceeds_limit';

@Injectable()
export class TurnGuard {
  private inUse = 0;

  constructor(readonly limit: number = DEFAULT_TURN_WEIGHT_LIMIT) {}

  /** Admit `weight` units or report why not. The returned release function is idempotent. */
  tryAcquire(weight: number): { ok: true; release: () => void } | { ok: false; reason: GuardRejection } {
    const w = Math.max(1, Math.floor(weight));
    if (w > this.limit) return { ok: false, reason: 'exceeds_limit' };
    if (this.inUse + w > this.limit) return { ok: false, reason: 'over_limit' };
    this.inUse += w;
    let released = false;
    return {
      ok: true,
      release: () => {
        if (released) return;
        released = true;
        this.inUse -= w;
      },
    };
  }

  get used(): number {
    return this.inUse;
  }
}
