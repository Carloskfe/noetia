/**
 * NEM-024 Checkpoint E — Q-11 reader-interference harness (SERVER side). Test tooling only; never imported by src.
 *
 * Boots the REAL AppModule (every production module, the real BooksController/SessionsController, the real Gateway with
 * the SIMULATED provider only) with KNOWLEDGE_MODULE_ENABLED=true. Only test-module overrides are applied:
 *   - the four dark ports (qualifying plan, ownership, text identity, rights authority) → fixture answers, so research
 *     turns can run (the shipped module denies every turn by design);
 *   - the throttler storage → never blocks (the measurement client is one IP; the 120/min/IP limit would 429 it).
 * Research load is generated IN-PROCESS through the real TurnService, so it shares the event loop with the reader
 * endpoints — exactly the interference §9.5 must bound. Intended to run under `docker run --cpus=1 --memory=512m`.
 *
 * Control API (port CONTROL_PORT): POST /load?scenario=<id> · POST /stop · GET /stats · POST /reset · GET /ready.
 * Disposable local PostgreSQL / Redis / MinIO only (guarded below).
 */
import { createServer } from 'http';
import { monitorEventLoopDelay } from 'perf_hooks';
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { QUALIFYING_PLAN_PORT } from '../../src/knowledge/entitlement/qualifying-plan.port';
import { OWNERSHIP_PORT, RIGHTS_VERIFICATION_AUTHORITY_PORT, TEXT_IDENTITY_PORT } from '../../src/knowledge/rights/rights.ports';
import { TurnService } from '../../src/knowledge/sessions/turn.service';
import { PROVIDER_ADAPTERS } from '../../src/knowledge/ai/gateway/gateway.types';
import { SimulatorV2Adapter } from '../../src/knowledge/ai/simulator/simulator-v2';
import { SessionsService } from '../../src/knowledge/sessions/sessions.service';
import { CostConfigService } from '../../src/knowledge/metering/cost-config.service';
import { CostLedgerService } from '../../src/knowledge/metering/cost-ledger.service';
import { ensureCostFixtures, budgetPolicy, enableFlag, grant } from '../integration/knowledge/support/it-env';
import { installDiagnostics } from './q11-diagnostics';

const env = process.env;
if (env.NEM019_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost'].includes(env.DB_HOST ?? '') || !/_test$/.test(env.DB_NAME ?? '')) {
  throw new Error('Q-11 harness: disposable local *_test database only');
}
const PORT = Number(env.HARNESS_PORT ?? 4100);
const CONTROL_PORT = Number(env.CONTROL_PORT ?? 4101);
const W = Number(env.INTELLIGENCE_TURN_WEIGHT_LIMIT ?? 10);

/** The deterministic NEM-023 perf vocabulary (same generator), so questions match the indexed fixture. */
function vocabulary(n: number): string[] {
  const syl = ['ra', 'mo', 'ti', 'sa', 'le', 'no', 'ca', 've', 'du', 'pi', 'ña', 'ló', 'gue', 'trí', 'bas', 'cen', 'fo', 'ju', 'xe', 'zú'];
  const out: string[] = [];
  for (let i = 0; out.length < n; i++) {
    let w = '';
    let x = i + 7;
    do { w += syl[x % syl.length]; x = Math.floor(x / syl.length); } while (x > 0);
    out.push(w);
  }
  return out;
}
const VOCAB = vocabulary(6000);
const QUESTIONS = [VOCAB[3], VOCAB[40], VOCAB[400], VOCAB[2500], `${VOCAB[10]} ${VOCAB[11]}`, `${VOCAB[100]} or ${VOCAB[900]}`, VOCAB[1200], VOCAB[5999]];
const pct = (xs: number[], p: number) => { if (xs.length === 0) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Scenario { loops: { books: number }[] }
const SCENARIOS: Record<string, Scenario> = {
  x10: { loops: [{ books: 10 }] },                      // one NoetiaX 10-book turn continuously (weight 10)
  p3x3: { loops: [{ books: 3 }, { books: 3 }, { books: 3 }] }, // three Noetia+ 3-book turns (weight 9)
  p3x2: { loops: [{ books: 3 }, { books: 3 }] },        // weight 6
  p3x1: { loops: [{ books: 3 }] },                      // weight 3
};

async function main() {
  const ref = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(QUALIFYING_PLAN_PORT).useValue({ check: async () => 'qualifying' })
    .overrideProvider(OWNERSHIP_PORT).useValue({ check: async () => 'entitled' })
    .overrideProvider(TEXT_IDENTITY_PORT).useValue({ currentTextHash: async (bookId: string) => hashes.get(bookId) ?? null })
    .overrideProvider(RIGHTS_VERIFICATION_AUTHORITY_PORT).useValue({ attest: async (r: { verifier: string | null }) => (r.verifier === 'fixture-verifier' ? 'attested' : 'not_attested') })
    .overrideProvider(ThrottlerStorage).useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }) })
    .compile();
  const app: INestApplication = ref.createNestApplication({ logger: ['error'] });
  await app.listen(PORT, '0.0.0.0');
  const ds = ref.get(DataSource, { strict: false });
  const turns = ref.get(TurnService, { strict: false });
  const sessions = ref.get(SessionsService, { strict: false });
  const jwt = ref.get(JwtService, { strict: false });

  if (env.Q11_DEBUG === '1') {
    // Debug only: surface the underlying error behind a fail-closed `ledger_unavailable` (message only; no payloads).
    const ledger = ref.get(CostLedgerService, { strict: false }) as unknown as { reserveOrThrow: (r: unknown) => Promise<unknown> };
    const orig = ledger.reserveOrThrow.bind(ledger);
    ledger.reserveOrThrow = async (r: unknown) => { try { return await orig(r); } catch (e) { process.stdout.write(`Q11_DEBUG reserve: ${(e as Error).constructor.name} ${(e as Error).message}\n`); throw e; } };
  }
  // ── Fixtures (setup only; not timed) ────────────────────────────────────────────────────────────────────────────
  const perf: { id: string; textHash: string; textFileKey: string }[] = await ds.query(
    `SELECT b.id, r."textHash", b."textFileKey" FROM books b JOIN book_ai_rights r ON r."bookId" = b.id WHERE b."textFileKey" LIKE 'texts/nem023-perf-%' ORDER BY b."textFileKey" LIMIT 10`);
  if (perf.length < 10) throw new Error(`need the 10 NEM-023 perf books (found ${perf.length}); run retrieval-performance with NEM023_PERF_KEEP=1`);
  for (const b of perf) hashes.set(b.id, b.textHash);
  // PO-044 diagnostics (opt-in; instrumentation of this test process only). Installed before any measured traffic.
  const diag = env.Q11_DIAG === '1' ? installDiagnostics(ref) : null;
  if (diag) for (const b of perf) diag.keyOf.set(b.id, b.textFileKey);
  await enableFlag(ds);
  await ensureCostFixtures(ref.get(CostConfigService, { strict: false }), ds);
  for (const tier of ['noetia_plus', 'noetia_x']) await budgetPolicy(ds, tier, 'research_session', { allowanceUnits: 1_000_000_000, maxUnresolvedUnits: 1_000_000_000 });

  // Reader catalog: 40 published free books with ≥ 90% sync maps (3,000 phrases ≈ realistic sync-map payload).
  let [reader] = await ds.query(`SELECT id FROM books WHERE title = 'Q11 Reader Fixture 00'`);
  if (!reader) {
    const phrases = JSON.stringify(Array.from({ length: 3000 }, (_, i) => ({ index: i, text: `${VOCAB[i % 6000]} ${VOCAB[(i * 7) % 6000]} ${VOCAB[(i * 13) % 6000]} fixture phrase number ${i} for the reader path.`, startTime: i * 2.5, endTime: i * 2.5 + 2.4, type: 'text' })));
    for (let i = 0; i < 40; i++) {
      const [b] = await ds.query(`INSERT INTO books (title, author, category, "isFree", "isPublished") VALUES ($1, 'Fixture Author', 'classic', true, true) RETURNING id`, [`Q11 Reader Fixture ${String(i).padStart(2, '0')}`]);
      await ds.query(`INSERT INTO sync_maps ("bookId", phrases, "syncSource", "syncCoverage") VALUES ($1, $2::jsonb, 'whisper', 0.97)`, [b.id, phrases]);
      if (i === 0) reader = b;
    }
  }
  const [readerUser] = await ds.query(`INSERT INTO users (email, name) VALUES ($1, 'Q11 Reader') RETURNING id`, [`q11-reader-${randomUUID()}@example.invalid`]);
  const readerToken = jwt.sign({ sub: readerUser.id, email: null }, { secret: env.JWT_SECRET ?? 'changeme', expiresIn: '6h' });

  async function researcher(tier: 'noetia_plus' | 'noetia_x', books: string[]) {
    const [u] = await ds.query(`INSERT INTO users (email, name) VALUES ($1, 'Q11 Researcher') RETURNING id`, [`q11-research-${randomUUID()}@example.invalid`]);
    await grant(ds, u.id, tier);
    const s = await sessions.create(u.id, books);
    return { userId: u.id as string, sessionId: s.id as string };
  }

  // Sanity: one real 3-book turn must COMPLETE before anything is measured (fail fast on a mis-wired fixture).
  {
    // The admission-cache Redis client has enableOfflineQueue=false: a reservation before it connects fails closed
    // (ledger_unavailable). Retry briefly after boot (observation recorded in the Checkpoint E report).
    let last: unknown = null;
    for (let attempt = 1; attempt <= 10; attempt++) {
      const r = await researcher('noetia_plus', perf.slice(0, 3).map((b) => b.id));
      try {
        const out = await turns.run(r.userId, r.sessionId, `q11-sanity-${randomUUID().slice(0, 20)}`, QUESTIONS[1]);
        process.stdout.write(`Q11_SANITY attempt=${attempt} status=${out.status} segments=${out.segments.length} citations=${(out.citations ?? []).flat().length}\n`);
        last = null;
        break;
      } catch (e) {
        last = e;
        await sleep(500);
      }
    }
    if (last) throw new Error(`sanity turn failed: ${(last as { reason?: string }).reason} cause=${(last as { cause?: string }).cause}`);
  }

  // ── Load generation ─────────────────────────────────────────────────────────────────────────────────────────────
  let running = false;
  let active: Promise<void>[] = [];
  let loadStartedAt = 0;
  const stats = { turnsOk: 0, turnsFailed: 0, guardRejected: 0, turnMs: { 3: [] as number[], 10: [] as number[] }, errors: {} as Record<string, number> };
  const loop = async (books: number, idx: number) => {
    const tier = books > 3 ? 'noetia_x' : 'noetia_plus';
    const ids = books === 10 ? perf.map((b) => b.id) : perf.slice((idx * 3) % 8, ((idx * 3) % 8) + 3).map((b) => b.id);
    const r = await researcher(tier, ids);
    let n = 0;
    while (running) {
      const q = QUESTIONS[(n++ + idx) % QUESTIONS.length];
      const t0 = process.hrtime.bigint();
      try {
        await turns.run(r.userId, r.sessionId, `q11-${randomUUID().slice(0, 30)}`, q);
        stats.turnsOk++;
        stats.turnMs[books as 3 | 10].push(Number(process.hrtime.bigint() - t0) / 1e6);
      } catch (e) {
        const code = (e as { reason?: string }).reason ?? 'error';
        const guard = (e as { detail?: { guard?: string } }).detail?.guard;
        if (guard) { stats.guardRejected++; await sleep(5); } else { stats.turnsFailed++; stats.errors[code] = (stats.errors[code] ?? 0) + 1; await sleep(5); }
      }
    }
  };

  // ── Sampling ────────────────────────────────────────────────────────────────────────────────────────────────────
  const eld = monitorEventLoopDelay({ resolution: 10 });
  eld.enable();
  const samples = { rssMb: [] as number[], heapMb: [] as number[], pgConn: [] as number[], pgActive: [] as number[] };
  const sampler = setInterval(async () => {
    const m = process.memoryUsage();
    samples.rssMb.push(m.rss / 1048576);
    samples.heapMb.push(m.heapUsed / 1048576);
    try {
      const [c] = await ds.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE state = 'active')::int AS active FROM pg_stat_activity WHERE datname = current_database()`);
      samples.pgConn.push(c.total);
      samples.pgActive.push(c.active);
    } catch { /* ignore */ }
  }, 1000);
  sampler.unref();

  const summary = () => ({
    W, running, ...stats, loadSeconds: loadStartedAt ? (Date.now() - loadStartedAt) / 1000 : null,
    turnMs: { 3: { n: stats.turnMs[3].length, p50: pct(stats.turnMs[3], 50), p95: pct(stats.turnMs[3], 95) }, 10: { n: stats.turnMs[10].length, p50: pct(stats.turnMs[10], 50), p95: pct(stats.turnMs[10], 95) } },
    eventLoopDelayMs: { p50: eld.percentile(50) / 1e6, p99: eld.percentile(99) / 1e6, max: eld.max / 1e6 },
    rssMb: { max: Math.max(0, ...samples.rssMb), last: samples.rssMb[samples.rssMb.length - 1] ?? null },
    heapMb: { max: Math.max(0, ...samples.heapMb) },
    pg: { maxConnections: Math.max(0, ...samples.pgConn), maxActive: Math.max(0, ...samples.pgActive) },
  });
  const reset = () => {
    stats.turnsOk = 0; stats.turnsFailed = 0; stats.guardRejected = 0; stats.turnMs = { 3: [], 10: [] }; stats.errors = {};
    samples.rssMb = []; samples.heapMb = []; samples.pgConn = []; samples.pgActive = []; eld.reset();
  };

  createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const send = (code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (diag && url.pathname.startsWith('/diag/')) {
      try { const out = await diag.handle(url.pathname, url.searchParams); if (out !== undefined) return send(200, out); }
      catch (e) { return send(500, { error: (e as Error).message }); }
    }
    if (url.pathname === '/ready') return send(200, { readerBookId: reader.id, readerToken, W });
    if (url.pathname === '/reset') { reset(); if (running) loadStartedAt = Date.now(); return send(200, { ok: true }); }
    if (url.pathname === '/stats') return send(200, summary());
    if (url.pathname === '/stop') { running = false; await Promise.all(active); active = []; return send(200, summary()); }
    if (url.pathname === '/load') {
      const sc = SCENARIOS[url.searchParams.get('scenario') ?? ''];
      if (!sc) return send(400, { error: 'unknown scenario' });
      running = true;
      loadStartedAt = Date.now();
      active = sc.loops.map((l, i) => loop(l.books, i));
      return send(200, { started: sc });
    }
    if (url.pathname === '/research-session') {
      // SSE idle-timeout test: a researcher session + bearer token for POST /knowledge/sessions/:id/turns/stream.
      const r = await researcher('noetia_plus', perf.slice(0, 3).map((b) => b.id));
      return send(200, { sessionId: r.sessionId, token: jwt.sign({ sub: r.userId, email: null }, { secret: env.JWT_SECRET ?? 'changeme', expiresIn: '1h' }) });
    }
    if (url.pathname === '/sim-silent') {
      // The next provider attempt streams one delta and then goes silent until the provider timeout (simulated only).
      for (const a of ref.get(PROVIDER_ADAPTERS, { strict: false }) as SimulatorV2Adapter[]) a.enqueue({ kind: 'partial_stream', deltas: 1, then: 'hang' });
      return send(200, { ok: true });
    }
    if (url.pathname === '/probe10') {
      // A 10-book turn under W < 10 must be refused before any reservation (exceeds_limit).
      const r = await researcher('noetia_x', perf.map((b) => b.id));
      try { await turns.run(r.userId, r.sessionId, `q11-probe-${randomUUID().slice(0, 20)}`, QUESTIONS[0]); return send(200, { outcome: 'admitted' }); }
      catch (e) { return send(200, { outcome: 'refused', code: (e as { reason?: string }).reason, detail: (e as { detail?: unknown }).detail }); }
    }
    send(404, {});
  }).listen(CONTROL_PORT, '0.0.0.0');
  process.stdout.write(`Q11_HARNESS_READY W=${W} port=${PORT} control=${CONTROL_PORT}\n`);
}

const hashes = new Map<string, string>();
main().catch((e) => { process.stderr.write(`Q11_HARNESS_FAILED ${(e as Error).stack}\n`); process.exit(1); });
