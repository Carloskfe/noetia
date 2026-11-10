import { randomUUID } from 'crypto';
import { join } from 'path';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { KnowledgeConfig } from '../../../../src/knowledge/common/knowledge-config';
import { KnowledgeDbService } from '../../../../src/knowledge/common/knowledge-db.service';
import { KnowledgeMetricsService } from '../../../../src/knowledge/common/knowledge-metrics.service';
import { RAW_FIXTURE_UNIT_WEIGHTS } from '../../../../src/knowledge/ai/contract/fixtures';
import { AiGatewayService } from '../../../../src/knowledge/ai/gateway/ai-gateway.service';
import { CapabilityRouterService } from '../../../../src/knowledge/ai/gateway/capability-router.service';
import { RAW_SIMULATOR_PRICING, SIMULATOR_DESCRIPTORS } from '../../../../src/knowledge/ai/simulator/simulator-fixtures';
import { SimStep, SimulatorV2Adapter } from '../../../../src/knowledge/ai/simulator/simulator-v2';
import { ContextItem } from '../../../../src/knowledge/ai/verified-context';
import { EntitlementService } from '../../../../src/knowledge/entitlement/entitlement.service';
import { QualifyingPlanAnswer } from '../../../../src/knowledge/entitlement/qualifying-plan.port';
import { AdmissionCachePort, RedisAdmissionCache } from '../../../../src/knowledge/metering/admission-cache';
import { BudgetLedgerService } from '../../../../src/knowledge/metering/budget-ledger.service';
import { CostConfigService } from '../../../../src/knowledge/metering/cost-config.service';
import { CostLedgerService } from '../../../../src/knowledge/metering/cost-ledger.service';
import { RateCardService } from '../../../../src/knowledge/metering/rate-card.service';
import { OwnershipAnswer, RightsVerificationAuthorityPort } from '../../../../src/knowledge/rights/rights.ports';
import { RightsService } from '../../../../src/knowledge/rights/rights.service';
import { ContextBuilderService } from '../../../../src/knowledge/sessions/context-builder.service';
import { SessionsService } from '../../../../src/knowledge/sessions/sessions.service';
import { TurnService } from '../../../../src/knowledge/sessions/turn.service';

/** Refuse anything but a local, explicitly disposable database. */
export function assertDisposable() {
  const host = process.env.DB_HOST ?? '';
  const name = process.env.DB_NAME ?? '';
  if (process.env.NEM019_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost'].includes(host) || !/_test$/.test(name)) {
    throw new Error('NEM-019 integration tests require NEM019_DISPOSABLE_DB=1 and a local DB whose name ends in _test');
  }
}

export async function openDataSource(): Promise<DataSource> {
  assertDisposable();
  const src = join(__dirname, '../../../../src');
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    entities: [join(src, '**/*.entity.ts')],
    migrations: [join(src, 'migrations/*.ts')],
    synchronize: false,
    extra: { max: 20 },
  });
  await ds.initialize();
  await ds.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await ds.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await ds.runMigrations({ transaction: 'each' });
  return ds;
}

export const IT_CONFIG: KnowledgeConfig = {
  statementTimeoutMs: 5000,
  providerTimeoutMs: 200,
  overallUnresolvedUnitsBound: 1_000_000_000,
  admissionCacheTtlSeconds: 30,
};

export async function createUser(ds: DataSource, label = 'it'): Promise<string> {
  const [u] = await ds.query(`INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id`, [`${label}-${randomUUID()}@example.invalid`, 'Fixture Reader']);
  return u.id;
}

export async function createBook(ds: DataSource, opts: { isFree?: boolean } = {}): Promise<string> {
  const [b] = await ds.query(
    `INSERT INTO books (title, author, category, "isFree") VALUES ($1, 'Fixture Author', 'classic', $2) RETURNING id`,
    [`Invented Fixture ${randomUUID().slice(0, 8)}`, opts.isFree ?? false],
  );
  return b.id;
}

export const IT_HASH = 'sha256:it-fixture-text';

/** Insert a test-only rights record for an invented book. */
export async function insertRights(ds: DataSource, bookId: string, over: Record<string, unknown> = {}) {
  const r: Record<string, unknown> = {
    bookId, status: 'verified', textHash: IT_HASH, workTitle: 'Invented Fixture', workAuthors: ['Fixture Author'],
    authorDeathDate: '1801-01-01', firstPublicationDate: '1790', edition: 'Fixture edition', editionPublisher: 'Fixture Press',
    editionYear: 1890, textSource: 'fixture', isTranslation: false, addedMaterial: 'excluded', sourceUrl: 'https://example.invalid/f',
    rightsBasis: 'public_domain', rightsEvidence: 'fixture', jurisdiction: 'fixture', permittedOperations: ['research_analysis'],
    verifier: 'fixture-verifier', verifiedAt: '2026-01-01T00:00:00Z', evidenceLinks: ['https://example.invalid/e'], reviewDate: '2099-01-01',
    ...over,
  };
  const cols = Object.keys(r);
  await ds.query(
    `INSERT INTO book_ai_rights (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
    cols.map((c) => r[c]),
  );
}

export async function grant(ds: DataSource, userId: string, tier: 'noetia_plus' | 'noetia_x') {
  await ds.query(`UPDATE ai_grants SET "revokedAt" = now() WHERE "userId" = $1 AND "revokedAt" IS NULL`, [userId]);
  await ds.query(`INSERT INTO ai_grants ("userId", tier, reason) VALUES ($1, $2, 'integration-test')`, [userId, tier]);
}

export async function enableFlag(ds: DataSource, capability = 'research_session') {
  await ds.query(
    `INSERT INTO feature_flags (key, enabled, "rolloutPercent") VALUES ($1, true, 100)
     ON CONFLICT (key) DO UPDATE SET enabled = true, "rolloutPercent" = 100`,
    [`intelligence.${capability}`],
  );
}

/** Marked test-fixture budget policy (no real values exist). */
export async function budgetPolicy(ds: DataSource, tier: string, capability: string, over: Record<string, number> = {}) {
  const p = { allowanceUnits: 1000, periodDays: 30, reserveUnitsPerTurn: 10, reservationTtlSeconds: 300, maxUnresolvedUnits: 100000, maxUnresolvedAgeSeconds: 3600, ...over };
  await ds.query(`UPDATE ai_budget_policies SET active = false WHERE tier = $1 AND capability = $2`, [tier, capability]);
  const [{ v }] = await ds.query(`SELECT COALESCE(MAX(version), 0) + 1 AS v FROM ai_budget_policies WHERE tier = $1 AND capability = $2`, [tier, capability]);
  await ds.query(
    `INSERT INTO ai_budget_policies (tier, capability, version, "allowanceUnits", "periodDays", "reserveUnitsPerTurn",
       "reservationTtlSeconds", "maxUnresolvedUnits", "maxUnresolvedAgeSeconds", "isTestFixture")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
    [tier, capability, v, p.allowanceUnits, p.periodDays, p.reserveUnitsPerTurn, p.reservationTtlSeconds, p.maxUnresolvedUnits, p.maxUnresolvedAgeSeconds],
  );
}

export interface Fixtures {
  plan: Map<string, QualifyingPlanAnswer>;
  ownership: Map<string, OwnershipAnswer>;
  textHash: Map<string, string>;
  context: ContextItem[];
  /** Test verification authority: attests fixture-verifier records unless the book is listed here. */
  unattested: Set<string>;
}

/** NEM-019 legacy simulator scripts, still used by unchanged suites (e.g. account deletion). */
export type LegacySimBehavior =
  | { kind: 'success'; units?: number; toolCalls?: { name: string; bookId: string }[] }
  | { kind: 'failure'; units: number | null }
  | { kind: 'abort' }
  | { kind: 'hang' }
  | { kind: 'throw' };

/**
 * NEM-022 D-2 harness wiring: simulator v2 (the registered provider adapter, so `jest.spyOn(w.sim, 'invoke')` still
 * counts provider calls) that also accepts the NEM-019 script vocabulary, mapped onto the shared outcome model:
 * failure with unknown usage → provider_unavailable (held); failure with known usage → a refusal with complete
 * usage (settled); abort → stream ends without a usage record (held); hang → timeout (held); throw → internal (held).
 */
export class HarnessSimulator extends SimulatorV2Adapter {
  enqueue(...steps: (SimStep | LegacySimBehavior)[]) {
    super.enqueue(...steps.map((b): SimStep => {
      switch (b.kind) {
        case 'success': return { kind: 'success', toolCalls: (b as { toolCalls?: { name: string; bookId: string }[] }).toolCalls };
        case 'failure': return b.units === null ? { kind: 'unavailable' } : { kind: 'refusal', category: 'policy', completeness: 'complete' };
        case 'abort': return { kind: 'partial_stream', deltas: 1, then: 'drop' };
        case 'hang': return { kind: 'timeout' };
        case 'throw': return { kind: 'internal' };
        default: return b as SimStep;
      }
    }));
  }
}

/** Fixture cost configuration for turns (idempotent): simulator pricing, unit weights, and a roomy global policy. */
export async function ensureCostFixtures(costConfig: CostConfigService, ds: DataSource) {
  if (!(await costConfig.activeGlobalPolicy())) {
    const id = await costConfig.addGlobalPolicy({ periodDays: 30, allowanceMicroUsd: 1_000_000_000_000n, maxUnresolvedMicroUsd: 1_000_000_000_000n, isTestFixture: true });
    await costConfig.activateGlobalPolicy(id);
  }
  if (!(await costConfig.activeUnitWeightSchema())) {
    const [{ v }] = await ds.query(`SELECT COALESCE(MAX(version), 0) + 1 AS v FROM ai_unit_weight_schemas WHERE "schemaKey" = $1`, [RAW_FIXTURE_UNIT_WEIGHTS.id]);
    await costConfig.activateUnitWeightSchema(await costConfig.addUnitWeightSchema({ ...JSON.parse(JSON.stringify(RAW_FIXTURE_UNIT_WEIGHTS)), version: Number(v) }));
  }
  for (const raw of RAW_SIMULATOR_PRICING) {
    if ((await costConfig.activePricingSchema(raw.providerKey, raw.modelKey)).status === 'ok') continue;
    const [{ v }] = await ds.query(`SELECT COALESCE(MAX(version), 0) + 1 AS v FROM ai_pricing_schemas WHERE provider = $1 AND "modelKey" = $2`, [raw.providerKey, raw.modelKey]);
    const id = await costConfig.addPricingSchema({ ...JSON.parse(JSON.stringify(raw)), version: Number(v) });
    const [{ open }] = await ds.query(`SELECT count(*)::int AS open FROM ai_overrun_breakers b JOIN ai_pricing_schemas s ON s.id = b."pricingSchemaId" WHERE b.state = 'open' AND s.provider = $1 AND s."modelKey" = $2`, [raw.providerKey, raw.modelKey]);
    await costConfig.activatePricingSchema(id, open > 0 ? 'harness-fixture-replacement' : null);
  }
}

/** Wire the real services against the disposable DB with simulated ports. */
export function wire(
  ds: DataSource,
  opts: { cache?: AdmissionCachePort; config?: Partial<KnowledgeConfig>; authority?: RightsVerificationAuthorityPort } = {},
) {
  const fx: Fixtures = { plan: new Map(), ownership: new Map(), textHash: new Map(), context: [], unattested: new Set() };
  const config = { ...IT_CONFIG, ...opts.config };
  const db = new KnowledgeDbService(ds, config);
  const metrics = new KnowledgeMetricsService();
  const entitlements = new EntitlementService(db, metrics, { check: async (u) => fx.plan.get(u) ?? 'unknown' });
  const rights = new RightsService(
    db,
    { check: async (u, b) => fx.ownership.get(`${u}:${b}`) ?? 'unknown' },
    { currentTextHash: async (b) => fx.textHash.get(b) ?? null },
    opts.authority ?? {
      attest: async (r) => (r.verifier === 'fixture-verifier' && !fx.unattested.has(r.bookId) ? 'attested' : 'not_attested'),
    },
  );
  const rateCards = new RateCardService(db);
  const ledger = new BudgetLedgerService(db, rateCards, metrics, config, opts.cache);
  const sessions = new SessionsService(db, entitlements, rights, metrics);
  // NEM-022 D-2: turns run through the Gateway v2 on the real NEM-021 cost ledger (one accounting path).
  const costConfig = new CostConfigService(db);
  const costLedger = new CostLedgerService(db, costConfig, ledger, metrics, config, opts.cache);
  const sim = new HarnessSimulator(SIMULATOR_DESCRIPTORS[0]);
  const gateway = new AiGatewayService(new CapabilityRouterService([sim]), costLedger, metrics, config);
  const turns = new TurnService(db, sessions, rights, new ContextBuilderService(metrics), gateway, config, { candidates: async () => fx.context });
  return { fx, db, entitlements, rights, ledger, sessions, turns, sim, rateCards, costConfig, costLedger, gateway };
}

/** A qualifying subscriber with a grant, an enabled flag, and a fixture budget. */
export async function readyUser(ds: DataSource, w: ReturnType<typeof wire>, tier: 'noetia_plus' | 'noetia_x' = 'noetia_plus') {
  const userId = await createUser(ds);
  await ensureCostFixtures(w.costConfig, ds); // NEM-022 D-2: turns need fixture pricing, weights, and a global policy
  w.fx.plan.set(userId, 'qualifying');
  await grant(ds, userId, tier);
  return userId;
}

/** A verified public-domain fixture book, NOT in any library. */
export async function eligibleBook(ds: DataSource, w: ReturnType<typeof wire>) {
  const id = await createBook(ds);
  await insertRights(ds, id);
  w.fx.textHash.set(id, IT_HASH);
  return id;
}

export function redisCache(url = process.env.NEM019_REDIS_URL ?? 'redis://127.0.0.1:56379') {
  const client = new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, retryStrategy: () => null });
  return { client, cache: new RedisAdmissionCache(client) };
}

export async function denial(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'allowed';
  } catch (e: any) {
    return e.reason ?? `error:${e.message}`;
  }
}
