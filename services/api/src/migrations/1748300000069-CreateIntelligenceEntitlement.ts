import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NEM-019 — intelligence entitlement tables (ADR-005). Additive only.
 *
 * - ai_tier_policies: versioned tier policy data. Seeds the only two PO-approved
 *   values (PO-027): 3 selected books for Noetia+ and 10 for NoetiaX.
 * - ai_grants: per-user tier grants. Grants never bypass the subscription
 *   prerequisite (PO-026); the resolver checks the prerequisite first.
 * - feature_flags: capability flags. Flags and rollout can only restrict.
 *   No per-user targeting, so no foreign key to users.
 */
export const TIER_POLICY_SEED = [
  { tier: 'noetia_plus', version: 1, maxBooks: 3, capabilities: ['research_session'] },
  { tier: 'noetia_x', version: 1, maxBooks: 10, capabilities: ['research_session'] },
] as const;

export class CreateIntelligenceEntitlement1748300000069 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_tier_policies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tier varchar(32) NOT NULL CHECK (tier IN ('noetia_plus', 'noetia_x')),
        version integer NOT NULL CHECK (version >= 1),
        "maxBooks" smallint NOT NULL CHECK ("maxBooks" BETWEEN 1 AND 10),
        capabilities text[] NOT NULL DEFAULT '{}',
        active boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_tier_policies_tier_version" UNIQUE (tier, version)
      )
    `);
    for (const p of TIER_POLICY_SEED) {
      await queryRunner.query(
        `INSERT INTO ai_tier_policies (tier, version, "maxBooks", capabilities)
         VALUES ($1, $2, $3, $4) ON CONFLICT (tier, version) DO NOTHING`,
        [p.tier, p.version, p.maxBooks, [...p.capabilities]],
      );
    }

    await queryRunner.query(`
      CREATE TABLE ai_grants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tier varchar(32) NOT NULL CHECK (tier IN ('noetia_plus', 'noetia_x')),
        reason varchar(64) NOT NULL,
        "startsAt" timestamptz NOT NULL DEFAULT now(),
        "expiresAt" timestamptz,
        "revokedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ai_grants_userId" ON ai_grants ("userId")`);

    await queryRunner.query(`
      CREATE TABLE feature_flags (
        key varchar(128) PRIMARY KEY,
        enabled boolean NOT NULL DEFAULT false,
        "rolloutPercent" smallint NOT NULL DEFAULT 0 CHECK ("rolloutPercent" BETWEEN 0 AND 100),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS feature_flags`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_grants`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_tier_policies`);
  }
}
