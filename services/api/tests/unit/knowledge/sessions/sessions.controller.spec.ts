import { CanActivate, ExecutionContext, Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../../../src/auth/jwt-auth.guard';
import { knowledgeModules } from '../../../../src/knowledge/knowledge.registration';
import { EntitlementService } from '../../../../src/knowledge/entitlement/entitlement.service';
import { SessionsController } from '../../../../src/knowledge/sessions/sessions.controller';
import { TurnStatusDenied } from '../../../../src/knowledge/sessions/turn-status.error';
import { TurnService } from '../../../../src/knowledge/sessions/turn.service';
import { USER_A } from '../support/fixtures';

/** NEM-024 Checkpoint A: the real KnowledgeModule wiring (flag on, fake DataSource; no network, no DB). */
class FakeJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    ctx.switchToHttp().getRequest().user = { id: USER_A };
    return true;
  }
}

describe('NEM-024 SessionsController + KnowledgeModule wiring (Checkpoint A)', () => {
  let app: INestApplication;
  let turns: TurnService;
  let entitlements: EntitlementService;
  beforeAll(async () => {
    const ds = { query: jest.fn(async () => []), transaction: jest.fn() };
    @Global()
    @Module({ providers: [{ provide: DataSource, useValue: ds }], exports: [DataSource] })
    class FakeDbModule {}
    @Module({ imports: [FakeDbModule, ...knowledgeModules({ KNOWLEDGE_MODULE_ENABLED: 'true' })] })
    class TestAppModule {}
    const ref = await Test.createTestingModule({ imports: [TestAppModule] }).overrideGuard(JwtAuthGuard).useClass(FakeJwtGuard).compile();
    app = ref.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    turns = ref.get(TurnService);
    entitlements = ref.get(EntitlementService);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => app?.close());

  const post = async (path: string, body: unknown) => {
    const url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    const res = await fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };

  it('injects the NEM-024 dependencies into TurnService (retrieval facade, index permission, anchors, turn records)', () => {
    const t = turns as unknown as Record<string, unknown>;
    for (const k of ['retrieval', 'indexPermission', 'anchors', 'turnRecords']) expect({ k, present: t[k] !== undefined }).toEqual({ k, present: true });
  });

  it('deny-first: the capability guard denies an unentitled user before body validation; with a question, still denied by default', async () => {
    const sid = '20000000-0000-4000-8000-000000000001';
    // Guards run before pipes in Nest, so the deny-first entitlement answer comes before DTO validation
    // (the required `question` rule itself is proven in sessions.dto.spec.ts).
    const missing = await post(`/knowledge/sessions/${sid}/turns`, { idempotencyKey: 'client-key-0001' });
    expect(missing.status).toBe(403);
    const denied = await post(`/knowledge/sessions/${sid}/turns`, { idempotencyKey: 'client-key-0001', question: '¿Qué papel tiene el faro?' });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('prerequisite_missing');
  });

  // ── NEM-024 Checkpoint C ─────────────────────────────────────────────────────────────────────────────────────
  const base = async () => (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const allow = () => jest.spyOn(entitlements, 'resolve').mockResolvedValue({ allowed: true, tier: 'noetia_plus', capability: 'research_session', policy: { id: 'p', tier: 'noetia_plus', version: 1, maxBooks: 3, capabilities: ['research_session'] }, limits: { maxBooks: 3 } } as any);
  const SID = '20000000-0000-4000-8000-000000000001';

  describe('Checkpoint C — capability probe route', () => {
    it('route precedence: "capabilities" never reaches the :id ParseUUIDPipe (403 deny-first, not 400)', async () => {
      const res = await fetch(`${await base()}/knowledge/sessions/capabilities`);
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('prerequisite_missing');
      const other = await fetch(`${await base()}/knowledge/sessions/not-a-uuid`); // history access: no entitlement needed, UUID pipe applies
      expect(other.status).toBe(400);
    });
    it('entitled → 200 with tier, capabilities, features, limits (no budget values)', async () => {
      allow();
      const res = await fetch(`${await base()}/knowledge/sessions/capabilities`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        tier: 'noetia_plus', capabilities: ['research_session'],
        features: { researchTurns: true, streaming: true, cancellation: true, history: true },
        limits: { maxBooks: 3, questionMaxCodePoints: 500, historyPageMax: 50 },
      });
    });
    it('is declared before every :id route in SessionsController', () => {
      const names = Object.getOwnPropertyNames(Object.getPrototypeOf(app.get(SessionsController)));
      expect(names.indexOf('capabilities')).toBeGreaterThan(-1);
      expect(names.indexOf('capabilities')).toBeLessThan(names.indexOf('get'));
    });
  });

  describe('Checkpoint C — SSE stream route', () => {
    const stream = async (body: unknown) => fetch(`${await base()}/knowledge/sessions/${SID}/turns/stream`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    it('deny-first: unentitled → ordinary 403 JSON (no stream opened)', async () => {
      const res = await stream({ idempotencyKey: 'client-key-0001', question: '¿Qué?' });
      expect(res.status).toBe(403);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);
      expect((await res.json()).code).toBe('prerequisite_missing');
    });
    it('entitled but invalid body / UUID → ordinary 400 before any stream', async () => {
      allow();
      expect((await stream({ idempotencyKey: 'x' })).status).toBe(400);
      const bad = await fetch(`${await base()}/knowledge/sessions/nope/turns/stream`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'client-key-0001', question: 'q' }) });
      expect(bad.status).toBe(400);
    });
    it('entitled → text/event-stream, X-Accel-Buffering: no; stage → delta → segment → terminal; the run gets the stage callback', async () => {
      allow();
      const run = jest.spyOn(turns, 'run').mockImplementation(async (_u, sid, _k, _q, opts) => {
        opts?.onStage?.('checking'); opts?.onStage?.('composing');
        return { sessionId: sid, segments: [{ origin: 'library', text: 'Respuesta.', bookId: 'b' } as any], excludedBookIds: [], settlement: 'settled', turnId: 't', status: 'completed', citations: [[]] };
      });
      const res = await stream({ idempotencyKey: 'client-key-0001', question: '¿Qué papel tiene el faro?' });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
      expect(res.headers.get('x-accel-buffering')).toBe('no');
      expect(res.headers.get('cache-control')).toBe('no-cache, no-transform');
      const text = await res.text();
      expect([...text.matchAll(/^event: (\w+)$/gm)].map((m) => m[1])).toEqual(['stage', 'stage', 'delta', 'segment', 'terminal']);
      expect(run).toHaveBeenCalledWith(USER_A, SID, 'client-key-0001', '¿Qué papel tiene el faro?', expect.objectContaining({ onStage: expect.any(Function) }));
    });
    it('a denial after the stream opened → terminal event with the safe payload (HTTP 200 stream)', async () => {
      allow();
      jest.spyOn(turns, 'run').mockRejectedValue(new TurnStatusDenied('duplicate_turn', { turnId: 't', status: 'accepted' }));
      const res = await stream({ idempotencyKey: 'client-key-0001', question: 'q' });
      const text = await res.text();
      expect(text).toBe(`event: terminal\ndata: ${JSON.stringify({ outcome: 'pending', statusCode: 409, code: 'duplicate_turn', message: JSON.parse(text.split('data: ')[1]).message, status: 'accepted', turnId: 't' })}\n\n`);
    });
  });
});

