import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { KnowledgeDbService } from '../common/knowledge-db.service';
import { KnowledgeMetricsService } from '../common/knowledge-metrics.service';
import { Capability, DenialReason, IntelligenceTier, TIER_RANK } from '../knowledge.types';
import { QUALIFYING_PLAN_PORT, QualifyingPlanPort } from './qualifying-plan.port';

export interface TierPolicy {
  id: string;
  tier: IntelligenceTier;
  version: number;
  maxBooks: number;
  capabilities: string[];
}

export type Resolution =
  | { allowed: true; tier: IntelligenceTier; capability: Capability; policy: TierPolicy; limits: { maxBooks: number } }
  | { allowed: false; reason: DenialReason };

/** Feature-flag key for a capability. A missing flag denies. */
export const flagKeyFor = (capability: Capability) => `intelligence.${capability}`;

/** Deterministic rollout bucket 0–99 for a user and flag. */
export function rolloutBucket(userId: string, flagKey: string): number {
  const digest = createHash('sha256').update(`${flagKey}:${userId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

/**
 * The single entitlement resolver (ADR-005). Deny-first:
 *   1. prerequisite port must answer `qualifying` (grants never bypass this);
 *   2. an active, unexpired, unrevoked grant supplies the tier;
 *   3. the tier's latest active policy must include the capability;
 *   4. the capability flag must be enabled and the user inside the rollout.
 * Flags and rollout can only restrict. Nothing is cached as authority.
 * Client-supplied tier, plan, limit, or budget values are never inputs.
 */
@Injectable()
export class EntitlementService {
  constructor(
    private readonly db: KnowledgeDbService,
    private readonly metrics: KnowledgeMetricsService,
    @Inject(QUALIFYING_PLAN_PORT) private readonly plans: QualifyingPlanPort,
  ) {}

  async resolve(userId: string, capability: Capability): Promise<Resolution> {
    const r = await this.evaluate(userId, capability);
    if (!r.allowed) this.metrics.resolverDeniedInc(r.reason);
    return r;
  }

  private async evaluate(userId: string, capability: Capability): Promise<Resolution> {
    let answer;
    try {
      answer = await this.plans.check(userId);
    } catch {
      answer = 'unknown';
    }
    if (answer !== 'qualifying') return { allowed: false, reason: 'prerequisite_missing' };

    const tier = await this.activeGrantTier(userId);
    if (!tier) return { allowed: false, reason: 'no_entitlement' };

    const policy = await this.activePolicy(tier);
    if (!policy) return { allowed: false, reason: 'policy_missing' };
    if (!policy.capabilities.includes(capability)) return { allowed: false, reason: 'capability_not_in_tier' };

    if (!(await this.flagAllows(userId, capability))) return { allowed: false, reason: 'feature_disabled' };

    return { allowed: true, tier, capability, policy, limits: { maxBooks: policy.maxBooks } };
  }

  private async activeGrantTier(userId: string): Promise<IntelligenceTier | null> {
    const rows = await this.db.query<{ tier: IntelligenceTier }>(
      `SELECT tier FROM ai_grants
        WHERE "userId" = $1 AND "revokedAt" IS NULL AND "startsAt" <= now()
          AND ("expiresAt" IS NULL OR "expiresAt" > now())`,
      [userId],
    );
    let best: IntelligenceTier | null = null;
    for (const { tier } of rows) {
      if (TIER_RANK[tier] === undefined) continue;
      if (!best || TIER_RANK[tier] > TIER_RANK[best]) best = tier;
    }
    return best;
  }

  async activePolicy(tier: IntelligenceTier): Promise<TierPolicy | null> {
    const rows = await this.db.query<TierPolicy>(
      `SELECT id, tier, version, "maxBooks", capabilities FROM ai_tier_policies
        WHERE tier = $1 AND active = true ORDER BY version DESC LIMIT 1`,
      [tier],
    );
    const p = rows[0];
    if (!p) return null;
    return { ...p, maxBooks: Number(p.maxBooks), version: Number(p.version) };
  }

  private async flagAllows(userId: string, capability: Capability): Promise<boolean> {
    const key = flagKeyFor(capability);
    const rows = await this.db.query<{ enabled: boolean; rolloutPercent: number }>(
      `SELECT enabled, "rolloutPercent" FROM feature_flags WHERE key = $1`,
      [key],
    );
    const flag = rows[0];
    if (!flag || !flag.enabled) return false;
    return rolloutBucket(userId, key) < Number(flag.rolloutPercent);
  }
}
