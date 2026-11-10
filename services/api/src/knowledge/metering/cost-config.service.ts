import { Injectable } from '@nestjs/common';
import {
  assertPricingSchema, assertUnitWeightSchema, MAX_BIGINT_COLUMN, ValidatedPricingSchema, ValidatedUnitWeightSchema,
} from '../ai/contract';
import { KnowledgeDbService } from '../common/knowledge-db.service';
import { GLOBAL_ADMISSION_LOCK } from './budget-ledger.service';

export interface GlobalBudgetPolicy {
  id: string;
  version: number;
  periodDays: number;
  allowanceMicroUsd: bigint;
  maxUnresolvedMicroUsd: bigint;
}

export interface GlobalPolicyInput {
  periodDays: number;
  allowanceMicroUsd: bigint;
  maxUnresolvedMicroUsd: bigint;
  isTestFixture: boolean;
}

export type ActivePricingLookup =
  | { status: 'ok'; id: string; schema: ValidatedPricingSchema }
  | { status: 'missing' | 'expired' | 'invalid' };

/** Anything that can run SQL: the database service or a transaction's entity manager. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Queryable = { query: (sql: string, params?: unknown[]) => Promise<any[]> };

/** Error from a configuration write that must not proceed (fail closed). */
export class CostConfigError extends Error {}

const PRICING_LOCK = (provider: string, modelKey: string) => `intelligence:pricing-activation:v1:${provider}:${modelKey}`;
const SINGLETON_LOCK = (table: string) => `intelligence:${table}-activation:v1`;

/**
 * Versioned cost configuration for the NEM-021 ledger: pricing schemas, internal-unit weight schemas, and
 * global budget policies, plus breaker closure on reviewed replacement.
 *
 * Validation boundary (contract v1, F-6/F-7): every stored schema passes `assertPricingSchema` /
 * `assertUnitWeightSchema` before insert, and again when loaded. The sealed result is cached by row id
 * (rows are never updated in place: a change is a new version), so calculations never revalidate.
 *
 * No value is seeded or invented here: rows exist only when an operator (or a test fixture) adds them,
 * and a missing, expired, or invalid row makes admission deny.
 */
@Injectable()
export class CostConfigService {
  private readonly pricingCache = new Map<string, ValidatedPricingSchema>();
  private readonly weightCache = new Map<string, ValidatedUnitWeightSchema>();

  constructor(private readonly db: KnowledgeDbService) {}

  // ── Pricing schemas ──────────────────────────────────────────────────────────────────────────

  /** Validate and store a pricing schema (inactive). Returns its row id. */
  async addPricingSchema(raw: unknown, opts: { expiresAt?: Date | null } = {}): Promise<string> {
    const schema = assertPricingSchema(raw);
    const [row] = await this.db.query<{ id: string }>(
      `INSERT INTO ai_pricing_schemas ("schemaKey", provider, "modelKey", version, schema, "isTestFixture", "expiresAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING id`,
      [schema.id, schema.providerKey, schema.modelKey, schema.version, JSON.stringify(schema), schema.isTestFixture, opts.expiresAt ?? null],
    );
    this.pricingCache.set(row.id, schema);
    return row.id;
  }

  /**
   * Activate a pricing schema for its provider and model (deactivating any other). If an overrun breaker
   * is open on any schema for that model, activation is the review gate (§9.1 rule 3): it requires a
   * review reference, the schema being activated must be a different (replacement) version, and the open
   * breakers are closed with the reference recorded.
   */
  async activatePricingSchema(id: string, reviewRef: string | null = null): Promise<{ closedBreakers: number }> {
    if (reviewRef !== null && (typeof reviewRef !== 'string' || reviewRef.trim() === '' || reviewRef.length > 256)) {
      throw new CostConfigError('review reference must be a non-empty string of at most 256 characters');
    }
    return this.db.transaction(async (m) => {
      const [target] = await m.query(`SELECT provider, "modelKey" FROM ai_pricing_schemas WHERE id = $1`, [id]);
      if (!target) throw new CostConfigError('unknown pricing schema');
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [PRICING_LOCK(target.provider, target.modelKey)]);
      const open: { pricingSchemaId: string }[] = await m.query(
        `SELECT b."pricingSchemaId" FROM ai_overrun_breakers b JOIN ai_pricing_schemas s ON s.id = b."pricingSchemaId"
          WHERE b.state = 'open' AND s.provider = $1 AND s."modelKey" = $2`,
        [target.provider, target.modelKey],
      );
      if (open.some((b) => b.pricingSchemaId === id)) {
        throw new CostConfigError('this schema has an open overrun breaker; activate a reviewed replacement version');
      }
      if (open.length > 0 && reviewRef === null) {
        throw new CostConfigError('an overrun breaker is open for this model; a review reference is required');
      }
      await m.query(`UPDATE ai_pricing_schemas SET active = false WHERE provider = $1 AND "modelKey" = $2 AND active`, [target.provider, target.modelKey]);
      await m.query(`UPDATE ai_pricing_schemas SET active = true, "activatedAt" = now(), "activationReviewRef" = $2 WHERE id = $1`, [id, reviewRef]);
      if (open.length === 0) return { closedBreakers: 0 };
      // Wrapped in a CTE so the statement is a SELECT: on PostgreSQL, TypeORM returns `[rows, rowCount]` for a bare
      // UPDATE … RETURNING, which would make any length-based count wrong.
      const [closed] = await m.query(
        `WITH closed AS (
           UPDATE ai_overrun_breakers SET state = 'closed', "closedAt" = now(), "closedByReviewRef" = $2, "replacementSchemaId" = $1
            WHERE state = 'open' AND "pricingSchemaId" = ANY($3::uuid[]) RETURNING "pricingSchemaId")
         SELECT count(*)::int AS n FROM closed`,
        [id, reviewRef, open.map((b) => b.pricingSchemaId)],
      );
      return { closedBreakers: Number(closed.n) };
    });
  }

  /** The active schema for a provider and model, sealed by the contract boundary, or why there is none. */
  async activePricingSchema(provider: string, modelKey: string): Promise<ActivePricingLookup> {
    const [row] = await this.db.query<{ id: string; schema: unknown; expired: boolean }>(
      `SELECT id, schema, ("expiresAt" IS NOT NULL AND "expiresAt" <= now()) AS expired
         FROM ai_pricing_schemas WHERE provider = $1 AND "modelKey" = $2 AND active`,
      [provider, modelKey],
    );
    if (!row) return { status: 'missing' };
    if (row.expired) return { status: 'expired' };
    const schema = this.sealPricing(row.id, row.schema);
    return schema ? { status: 'ok', id: row.id, schema } : { status: 'invalid' };
  }

  /** A pinned schema by id (active or not, expired or not): settlement always uses the pinned version. */
  async pricingSchemaById(id: string | null): Promise<ValidatedPricingSchema | null> {
    if (!id) return null;
    const cached = this.pricingCache.get(id);
    if (cached) return cached;
    const [row] = await this.db.query<{ schema: unknown }>(`SELECT schema FROM ai_pricing_schemas WHERE id = $1`, [id]);
    return row ? this.sealPricing(id, row.schema) : null;
  }

  // ── Unit-weight schemas ──────────────────────────────────────────────────────────────────────

  async addUnitWeightSchema(raw: unknown): Promise<string> {
    const schema = assertUnitWeightSchema(raw);
    const [row] = await this.db.query<{ id: string }>(
      `INSERT INTO ai_unit_weight_schemas ("schemaKey", version, schema, "isTestFixture") VALUES ($1, $2, $3::jsonb, $4) RETURNING id`,
      [schema.id, schema.version, JSON.stringify(schema), schema.isTestFixture],
    );
    this.weightCache.set(row.id, schema);
    return row.id;
  }

  async activateUnitWeightSchema(id: string): Promise<void> {
    await this.activateSingleton('ai_unit_weight_schemas', id);
  }

  async activeUnitWeightSchema(): Promise<{ id: string; schema: ValidatedUnitWeightSchema } | null> {
    const [row] = await this.db.query<{ id: string; schema: unknown }>(`SELECT id, schema FROM ai_unit_weight_schemas WHERE active`);
    if (!row) return null;
    const schema = this.sealWeights(row.id, row.schema);
    return schema ? { id: row.id, schema } : null;
  }

  async unitWeightSchemaById(id: string | null): Promise<ValidatedUnitWeightSchema | null> {
    if (!id) return null;
    const cached = this.weightCache.get(id);
    if (cached) return cached;
    const [row] = await this.db.query<{ schema: unknown }>(`SELECT schema FROM ai_unit_weight_schemas WHERE id = $1`, [id]);
    return row ? this.sealWeights(id, row.schema) : null;
  }

  // ── Global budget policies (D14) ─────────────────────────────────────────────────────────────

  /** Store a global policy (inactive). No policy is seeded; values come only from an operator or a fixture. */
  async addGlobalPolicy(p: GlobalPolicyInput): Promise<string> {
    if (!Number.isSafeInteger(p.periodDays) || p.periodDays < 1) throw new CostConfigError('periodDays must be a positive integer');
    for (const [k, v] of [['allowanceMicroUsd', p.allowanceMicroUsd], ['maxUnresolvedMicroUsd', p.maxUnresolvedMicroUsd]] as const) {
      if (typeof v !== 'bigint' || v < 0n || v > MAX_BIGINT_COLUMN) throw new CostConfigError(`${k} must be a bigint in [0, 2^63-1]`);
    }
    if (typeof p.isTestFixture !== 'boolean') throw new CostConfigError('isTestFixture must be declared');
    const [row] = await this.db.query<{ id: string }>(
      `INSERT INTO ai_global_budget_policies (version, "periodDays", "allowanceMicroUsd", "maxUnresolvedMicroUsd", "isTestFixture")
       SELECT COALESCE(MAX(version), 0) + 1, $1, $2, $3, $4 FROM ai_global_budget_policies RETURNING id`,
      [p.periodDays, p.allowanceMicroUsd.toString(), p.maxUnresolvedMicroUsd.toString(), p.isTestFixture],
    );
    return row.id;
  }

  async activateGlobalPolicy(id: string): Promise<void> {
    await this.activateSingleton('ai_global_budget_policies', id);
  }

  /** Read inside or outside a transaction. With no active policy, cost-aware admission denies. */
  async activeGlobalPolicy(m: Queryable = this.db): Promise<GlobalBudgetPolicy | null> {
    const [row]: Record<string, string | number>[] = await m.query(
      `SELECT id, version, "periodDays", "allowanceMicroUsd"::text AS "allowanceMicroUsd",
              "maxUnresolvedMicroUsd"::text AS "maxUnresolvedMicroUsd"
         FROM ai_global_budget_policies WHERE active`,
    );
    if (!row) return null;
    return {
      id: String(row.id),
      version: Number(row.version),
      periodDays: Number(row.periodDays),
      allowanceMicroUsd: BigInt(row.allowanceMicroUsd),
      maxUnresolvedMicroUsd: BigInt(row.maxUnresolvedMicroUsd),
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────────────────────────

  private async activateSingleton(table: 'ai_unit_weight_schemas' | 'ai_global_budget_policies', id: string): Promise<void> {
    await this.db.transaction(async (m) => {
      if (table === 'ai_global_budget_policies') {
        // F-9: serialize with admission. Every cost-aware admission holds this B-6 lock while it reads the active
        // policy, checks the invariant, and inserts its reservation. Taking it here (first, so the lock order is
        // always global → other) means a policy change commits strictly before or strictly after each admission:
        // an admission never commits against an allowance that has already been replaced.
        await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [GLOBAL_ADMISSION_LOCK]);
      }
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [SINGLETON_LOCK(table)]);
      const [exists] = await m.query(`SELECT 1 AS ok FROM ${table} WHERE id = $1`, [id]);
      if (!exists) throw new CostConfigError('unknown configuration row');
      await m.query(`UPDATE ${table} SET active = false WHERE active AND id <> $1`, [id]);
      await m.query(`UPDATE ${table} SET active = true${table === 'ai_unit_weight_schemas' ? ', "activatedAt" = now()' : ''} WHERE id = $1`, [id]);
    });
  }

  /** Seal stored JSON through the contract boundary once; a row that no longer validates is unusable. */
  private sealPricing(id: string, raw: unknown): ValidatedPricingSchema | null {
    const cached = this.pricingCache.get(id);
    if (cached) return cached;
    try {
      const schema = assertPricingSchema(raw);
      this.pricingCache.set(id, schema);
      return schema;
    } catch {
      return null;
    }
  }

  private sealWeights(id: string, raw: unknown): ValidatedUnitWeightSchema | null {
    const cached = this.weightCache.get(id);
    if (cached) return cached;
    try {
      const schema = assertUnitWeightSchema(raw);
      this.weightCache.set(id, schema);
      return schema;
    } catch {
      return null;
    }
  }
}
