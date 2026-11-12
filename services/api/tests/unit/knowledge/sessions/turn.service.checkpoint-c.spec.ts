import { IntelligenceDenied } from '../../../../src/knowledge/common/intelligence-denied.error';
import { computeTextHash } from '../../../../src/knowledge/rights/text-hash';
import { TurnCancelRegistry } from '../../../../src/knowledge/sessions/turn-cancel.registry';
import { TurnGuard } from '../../../../src/knowledge/sessions/turn-guard';
import { TURN_HISTORY_PAGE_MAX, TURN_QUESTION_MAX_CODE_POINTS, TurnService, TurnStage } from '../../../../src/knowledge/sessions/turn.service';
import { bookId, TEST_CONFIG, USER_A } from '../support/fixtures';

/** NEM-024 Checkpoint C — TurnService stage reporting and the capability probe (collaborators mocked). */
const S = '20000000-0000-4000-8000-000000000001';
const [B1, B2] = [bookId(1), bookId(2)];
const TEXT = 'Érase una vez un faro junto al mar.';
const H = computeTextHash(Buffer.from(TEXT));
const KEY = 'client-key-0001';
const TURN = '30000000-0000-4000-8000-000000000001';

function harness(o: { rows?: any[]; byKey?: any; guard?: TurnGuard; bookText?: any; eligible?: Record<string, boolean>; index?: Record<string, any>; owned?: boolean } = {}) {
  const log: string[] = [];
  const db = {
    query: jest.fn(async (sql: string) => {
      if (/SELECT 1 FROM ai_conversations/.test(sql)) return o.owned === false ? [] : [{ '?column?': 1 }];
      if (/FROM ai_conversations/.test(sql)) return o.owned === false ? [] : [{ status: 'active' }];
      if (/FROM books WHERE id = ANY/.test(sql)) return [{ id: B1, textFileKey: 'k1' }, { id: B2, textFileKey: 'k2' }];
      throw new Error(`unexpected SQL ${sql.slice(0, 50)}`);
    }),
    transaction: jest.fn(async (fn: any) => { log.push('lock'); return fn({ query: jest.fn(async () => [{ turnCount: 1 }]) }); }),
  };
  const sessions = {
    resolveOrDeny: jest.fn(async () => ({ tier: 'noetia_plus', limits: { maxBooks: 3 } })),
    books: jest.fn(async () => [{ id: 'sb1', bookId: B1, position: 1 }]),
    markOverLimit: jest.fn(), lockOwned: jest.fn(async () => ({ status: 'active', bookSetHash: null })),
  };
  const rights = { eligibility: jest.fn(async (_u: string, b: string) => ({ eligible: o.eligible?.[b] ?? true })) };
  const retrieval = { resolve: jest.fn(async () => { log.push('retrieval'); return { items: [], passages: [], excluded: { unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] }, truncated: false }; }) };
  const indexPermission = { check: jest.fn(async (b: string) => o.index?.[b] ?? { permitted: true, textHash: H }) };
  const anchors = { resolve: jest.fn(async () => null) };
  const records = {
    findByKey: jest.fn(async (..._a: any[]) => o.byKey ?? null),
    findById: jest.fn(async (..._a: any[]): Promise<any> => null),
    insertAccepted: jest.fn(async (..._a: any[]) => ({ id: TURN, attemptToken: 'tok' })),
    complete: jest.fn(async (..._a: any[]) => true), fail: jest.fn(async (..._a: any[]) => true),
    cancel: jest.fn(async (..._a: any[]) => true), finalize: jest.fn(async (..._a: any[]) => 0),
    recordStep4Failure: jest.fn(async (..._a: any[]) => 'f'),
    listBySession: jest.fn(async (..._a: any[]) => o.rows ?? []),
    findHistoryRow: jest.fn(async (..._a: any[]): Promise<any> => (o.rows ?? [])[0] ?? null),
  };
  const prepared = { state: 'reserved' };
  const gateway = {
    prepare: jest.fn(async () => { log.push('prepare'); return prepared; }),
    release: jest.fn(async () => { log.push('release'); }),
    invoke: jest.fn(async (..._a: any[]): Promise<any> => { log.push('invoke'); return { outcome: 'completed', error: null, scopeViolation: false, settlement: 'settled', segments: [] }; }),
  };
  const cancels = new TurnCancelRegistry();
  const metrics = { observeStage: jest.fn(), finalizedInc: jest.fn(), cancelledInc: jest.fn(), guardRejectedInc: jest.fn(), unrecordedInc: jest.fn(), fencedInc: jest.fn() };
  const bookText = o.bookText ?? { read: jest.fn(async () => Buffer.from(TEXT)) };
  const turns = new TurnService(db as any, sessions as any, rights as any, { build: (u: string, a: string[], i: any[]) => ({ userId: u, allowedBookIds: a, items: i }) } as any,
    gateway as any, TEST_CONFIG, { candidates: async () => [] } as any, retrieval as any, indexPermission as any, anchors as any, records as any,
    bookText, o.guard ?? new TurnGuard(10), cancels, metrics as any);
  return { turns, log, records, gateway, cancels, metrics, rights, indexPermission, bookText, retrieval, prepared };
}

const POLICY = { id: 'p', tier: 'noetia_x', version: 3, maxBooks: 10, capabilities: ['research_session', 'z_other', 'a_other'] };

describe('NEM-024 Checkpoint C — TurnService', () => {
  describe('stage reporting (content-free progress for SSE)', () => {
    it('checking → searching → composing; composing after the lock commit and before the final eligibility check / invoke', async () => {
      const h = harness();
      const seen: string[] = [];
      h.rights.eligibility.mockImplementation(async () => { seen.push('eligibility'); return { eligible: true }; }); // step 2 and the final check (4b)
      h.retrieval.resolve.mockImplementation(async () => { seen.push('retrieval'); return { items: [], passages: [], excluded: { unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] }, truncated: false }; });
      h.gateway.invoke.mockImplementation(async () => { seen.push('invoke'); return { outcome: 'completed', error: null, scopeViolation: false, settlement: 'settled', segments: [] }; });
      const tx = (h.turns as any).db.transaction;
      tx.mockImplementation(async (fn: any) => { seen.push('lock'); return fn({ query: jest.fn(async () => [{ turnCount: 1 }]) }); });
      await h.turns.run(USER_A, S, KEY, 'faro', { onStage: (st: TurnStage) => seen.push(`stage:${st}`) });
      expect(seen).toEqual(['stage:checking', 'eligibility', 'stage:searching', 'retrieval', 'lock', 'stage:composing', 'eligibility', 'invoke']);
    });
    it('a stage callback carries only the stage name (no question text reaches the transport)', async () => {
      const h = harness();
      const args: unknown[][] = [];
      await h.turns.run(USER_A, S, KEY, '¿Qué papel tiene el faro?', { onStage: (...a: unknown[]) => { args.push(a); } });
      expect(args).toEqual([['checking'], ['searching'], ['composing']]);
    });
    it('replay of a recorded turn: checking only (no retrieval, no Gateway)', async () => {
      const h = harness({ byKey: { id: TURN, sessionId: S, status: 'completed', segments: [], exclusions: {}, settlement: 'settled' } });
      const seen: string[] = [];
      await h.turns.run(USER_A, S, KEY, 'faro', { onStage: (st) => seen.push(st) });
      expect(seen).toEqual(['checking']);
      expect(h.gateway.prepare).not.toHaveBeenCalled();
    });
    it('invalid question → denied before any stage', async () => {
      const seen: string[] = [];
      await expect(harness().turns.run(USER_A, S, KEY, '   ', { onStage: (st) => seen.push(st) })).rejects.toMatchObject({ reason: 'invalid_request' });
      expect(seen).toEqual([]);
    });
    it('a throwing stage callback never affects the turn (completes, records T1)', async () => {
      const h = harness();
      const r = await h.turns.run(USER_A, S, KEY, 'faro', { onStage: () => { throw new Error('socket gone'); } });
      expect(r.status).toBe('completed');
      expect(h.records.complete).toHaveBeenCalled();
    });
    it('without options the accepted paths are unchanged (question and legacy)', async () => {
      const h = harness();
      expect((await h.turns.run(USER_A, S, KEY, 'faro')).status).toBe('completed');
    });
    it('a pre-lock denial stops the stages where it happened (no composing)', async () => {
      const h = harness({ eligible: { [B1]: false } });
      const seen: string[] = [];
      await expect(h.turns.run(USER_A, S, KEY, 'faro', { onStage: (st) => seen.push(st) })).rejects.toMatchObject({ reason: 'no_eligible_books' });
      expect(seen).toEqual(['checking']);
    });
  });

  describe('capabilities() — the probe', () => {
    const withPolicy = (h: ReturnType<typeof harness>) => {
      (h.turns as any).sessions.resolveOrDeny.mockResolvedValue({ allowed: true, tier: 'noetia_x', capability: 'research_session', policy: POLICY, limits: { maxBooks: 10 } });
      return h;
    };
    it('tier, sorted capability keys, features, and limits only', async () => {
      const p = await withPolicy(harness()).turns.capabilities(USER_A);
      expect(p).toEqual({
        tier: 'noetia_x',
        capabilities: ['a_other', 'research_session', 'z_other'],
        features: { researchTurns: true, streaming: true, cancellation: true, history: true },
        limits: { maxBooks: 10, questionMaxCodePoints: TURN_QUESTION_MAX_CODE_POINTS, historyPageMax: TURN_HISTORY_PAGE_MAX },
      });
      expect([TURN_QUESTION_MAX_CODE_POINTS, TURN_HISTORY_PAGE_MAX]).toEqual([500, 50]);
    });
    it('never exposes budgets, ledger, prices, policy ids/versions, provider or model configuration', async () => {
      const s = JSON.stringify(await withPolicy(harness()).turns.capabilities(USER_A)).toLowerCase();
      for (const k of ['budget', 'ledger', 'usd', 'micro', 'price', 'cost', 'balance', 'provider', 'model', 'secret', 'version', '"id"', 'rollout', 'flag']) expect({ k, present: s.includes(k) }).toEqual({ k, present: false });
    });
    it('deny-first: the resolver denial propagates unchanged (e.g. feature flag off → feature_disabled)', async () => {
      const h = harness();
      (h.turns as any).sessions.resolveOrDeny.mockRejectedValue(new IntelligenceDenied('feature_disabled'));
      await expect(h.turns.capabilities(USER_A)).rejects.toMatchObject({ reason: 'feature_disabled' });
    });
    it('features report false when the research wiring is absent (accepted 3-dependency construction)', async () => {
      const sessions = { resolveOrDeny: jest.fn(async () => ({ allowed: true, tier: 'noetia_plus', policy: { ...POLICY, capabilities: ['research_session'] }, limits: { maxBooks: 3 } })) };
      const bare = new TurnService({} as any, sessions as any, {} as any, {} as any, {} as any, TEST_CONFIG, { candidates: async () => [] } as any);
      expect(await bare.capabilities(USER_A)).toMatchObject({ features: { researchTurns: false, streaming: false, cancellation: false, history: false }, limits: { maxBooks: 3 } });
    });
  });
});
