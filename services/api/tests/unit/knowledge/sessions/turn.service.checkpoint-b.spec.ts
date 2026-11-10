import { computeTextHash } from '../../../../src/knowledge/rights/text-hash';
import { TurnCancelRegistry } from '../../../../src/knowledge/sessions/turn-cancel.registry';
import { TurnGuard } from '../../../../src/knowledge/sessions/turn-guard';
import { TurnService, turnIdempotencyKey } from '../../../../src/knowledge/sessions/turn.service';
import { bookId, TEST_CONFIG, USER_A } from '../support/fixtures';

/** NEM-024 Checkpoint B — TurnService cancellation, guard, lazy finalization, and D-10 history (collaborators mocked). */
const S = '20000000-0000-4000-8000-000000000001';
const [B1, B2] = [bookId(1), bookId(2)];
const TEXT = 'Érase una vez un faro junto al mar.';
const H = computeTextHash(Buffer.from(TEXT));
const H_OLD = `sha256:${'9'.repeat(64)}`;
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
const caught = async (p: Promise<unknown>) => p.then(() => null, (e) => e);
const completedRow = (cites: any[], over: any = {}) => ({
  id: TURN, sessionId: S, turnIndex: 1, status: 'completed', question: 'q', createdAt: new Date('2026-11-10T00:00:00Z'), completedAt: new Date('2026-11-10T00:00:01Z'),
  failureReason: null, reservationRelease: null, settlement: 'settled', exclusions: { ineligible: [] }, attemptToken: 'tok',
  segments: [{ origin: 'library', text: 'Según el libro…', bookId: B1, citations: cites }], ...over,
});
const cite = (bookIdV: string, hash: string, a = 17, b = 35) => ({ ref: 'chunk:c1', kind: 'chunk', bookId: bookIdV, anchor: `${hash}:${a}-${b}` });

describe('NEM-024 Checkpoint B — TurnService', () => {
  describe('cancel()', () => {
    it('provisional row before the fence → T3 cancelled; idempotent; metrics', async () => {
      const h = harness({ byKey: { id: TURN, status: 'accepted' } });
      h.records.findById.mockResolvedValueOnce({ id: TURN, status: 'accepted' }).mockResolvedValue({ id: TURN, status: 'cancelled' });
      expect(await h.turns.cancel(USER_A, S, KEY)).toEqual({ turnId: TURN, status: 'cancelled' });
      expect(h.records.finalize).toHaveBeenCalledWith([TURN]); // lazy T4 attempted first
      expect(h.records.cancel).toHaveBeenCalledWith(TURN);
      expect(h.metrics.cancelledInc).toHaveBeenCalled();
    });
    it('after the fence → lazy finalization wins → interrupted (no T3)', async () => {
      const h = harness({ byKey: { id: TURN, status: 'accepted' } });
      h.records.finalize.mockResolvedValue(1);
      h.records.findById.mockResolvedValue({ id: TURN, status: 'interrupted' });
      expect(await h.turns.cancel(USER_A, S, KEY)).toEqual({ turnId: TURN, status: 'interrupted' });
      expect(h.records.cancel).not.toHaveBeenCalled();
    });
    it('terminal row → returns it unchanged (late cancel)', async () => {
      const h = harness({ byKey: { id: TURN, status: 'completed' } });
      expect(await h.turns.cancel(USER_A, S, KEY)).toEqual({ turnId: TURN, status: 'completed' });
      expect(h.records.cancel).not.toHaveBeenCalled();
    });
    it('T3 races the fence: 0 rows → re-read is lazily finalized again', async () => {
      const h = harness({ byKey: { id: TURN, status: 'accepted' } });
      h.records.cancel.mockResolvedValue(false);
      h.records.finalize.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      h.records.findById.mockResolvedValueOnce({ id: TURN, status: 'accepted' }).mockResolvedValueOnce({ id: TURN, status: 'interrupted' });
      expect((await h.turns.cancel(USER_A, S, KEY)).status).toBe('interrupted');
    });
    it('no row: an in-flight owner here → cancel_requested; otherwise not_found; another user\'s session → not_found', async () => {
      const h = harness();
      h.cancels.register(turnIdempotencyKey(USER_A, S, KEY));
      expect(await h.turns.cancel(USER_A, S, KEY)).toEqual({ status: 'cancel_requested' });
      expect((await caught(harness().turns.cancel(USER_A, S, KEY)))?.reason).toBe('not_found');
      expect((await caught(harness({ owned: false }).turns.cancel(USER_A, S, KEY)))?.reason).toBe('not_found');
    });
  });

  describe('cancellation boundaries inside the turn', () => {
    it('cancel before reservation → no prepare, no record, cancelled status', async () => {
      const h = harness();
      h.retrieval.resolve.mockImplementationOnce(async () => {
        h.cancels.abort(turnIdempotencyKey(USER_A, S, KEY));
        return { items: [], passages: [], excluded: { unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] }, truncated: false };
      });
      const e = await caught(h.turns.run(USER_A, S, KEY, 'faro'));
      expect([e.reason, e.detail]).toEqual(['turn_failed', { status: 'cancelled' }]);
      expect(h.gateway.prepare).not.toHaveBeenCalled();
      expect(h.records.insertAccepted).not.toHaveBeenCalled();
    });
    it('cancel after the lock, before the provider call → release, T3, no invoke', async () => {
      const h = harness();
      h.indexPermission.check.mockImplementation(async () => { h.cancels.abort(turnIdempotencyKey(USER_A, S, KEY)); return { permitted: true, textHash: H }; });
      h.rights.eligibility.mockImplementation(async () => { if (h.log.includes('lock')) h.cancels.abort(turnIdempotencyKey(USER_A, S, KEY)); return { eligible: true }; });
      const e = await caught(h.turns.run(USER_A, S, KEY, 'faro'));
      expect(e.detail).toEqual({ turnId: TURN, status: 'cancelled', reservationRelease: 'released' });
      expect(h.gateway.invoke).not.toHaveBeenCalled();
      expect(h.log.slice(-1)).toEqual(['release']);
      expect(h.records.cancel).toHaveBeenCalledWith(TURN);
    });
    it('cancel during the provider attempt → signal passed to the Gateway; aborted outcome → T3 cancelled (no T2)', async () => {
      const h = harness();
      h.gateway.invoke.mockImplementationOnce(async (_p: any, opts: any) => {
        h.cancels.abort(turnIdempotencyKey(USER_A, S, KEY));
        expect(opts.signal.aborted).toBe(true);
        return { outcome: 'aborted', error: 'client_abort', scopeViolation: false, settlement: 'held', segments: [] };
      });
      const e = await caught(h.turns.run(USER_A, S, KEY, 'faro'));
      expect(e.detail).toEqual({ turnId: TURN, status: 'cancelled' });
      expect(h.records.fail).not.toHaveBeenCalled();
      expect(h.gateway.release).not.toHaveBeenCalled(); // the attempt stays held by the Gateway/ledger
    });
    it('owner T3 loses (endpoint or finalization already committed) → the stored status', async () => {
      const h = harness();
      h.records.cancel.mockResolvedValue(false);
      h.records.findById.mockResolvedValue({ id: TURN, status: 'interrupted' });
      h.gateway.invoke.mockImplementationOnce(async () => { h.cancels.abort(turnIdempotencyKey(USER_A, S, KEY)); return { outcome: 'aborted', error: 'client_abort', scopeViolation: false, settlement: 'held', segments: [] }; });
      expect((await caught(h.turns.run(USER_A, S, KEY, 'faro')))?.detail).toEqual({ turnId: TURN, status: 'interrupted' });
    });
    it('the registry entry is removed when the turn ends', async () => {
      const h = harness();
      await h.turns.run(USER_A, S, KEY, 'faro');
      expect(h.cancels.size).toBe(0);
    });
  });

  it('weighted guard: refusal happens before retrieval and reservation (budget_unavailable, no charge)', async () => {
    const guard = new TurnGuard(1);
    const hold = guard.tryAcquire(1);
    const h = harness({ guard });
    const e = await caught(h.turns.run(USER_A, S, KEY, 'faro'));
    expect([e.reason, e.detail]).toEqual(['budget_unavailable', { status: 'pending', retryAfterSeconds: 1, guard: 'over_limit' }]);
    expect(h.retrieval.resolve).not.toHaveBeenCalled();
    expect(h.gateway.prepare).not.toHaveBeenCalled();
    expect(h.metrics.guardRejectedInc).toHaveBeenCalledWith('over_limit');
    if (hold.ok) hold.release();
    await h.turns.run(USER_A, S, 'client-key-0002', 'faro');
    expect(guard.used).toBe(0); // released after retrieval
  });

  it('replay of a provisional row attempts lazy finalization and returns the finalized status', async () => {
    const h = harness({ byKey: { id: TURN, status: 'accepted' } });
    h.records.finalize.mockResolvedValue(1);
    h.records.findById.mockResolvedValue({ id: TURN, status: 'interrupted' });
    expect((await caught(h.turns.run(USER_A, S, KEY, 'q')))?.detail).toEqual({ turnId: TURN, status: 'interrupted' });
    expect(h.metrics.finalizedInc).toHaveBeenCalledWith('lazy', 1);
  });

  describe('history / turnView — D-10 re-validation', () => {
    it('available: excerpt re-materialized from the verified object; generated text kept', async () => {
      const h = harness({ rows: [completedRow([cite(B1, H)])] });
      const [v] = await h.turns.history(USER_A, S, 20);
      expect(v.segments).toEqual([{ origin: 'library', text: 'Según el libro…', bookId: B1 }]);
      expect(v.citations![0][0]).toMatchObject({ excerpt: 'faro junto al mar.', sourceState: 'available' });
    });
    it.each<[string, any, string]>([
      ['user-level rights revoked', { eligible: { [B1]: false } }, 'revoked'],
      ['index permission withdrawn', { index: { [B1]: { permitted: false, reason: 'not_attested' } } }, 'revoked'],
      ['text version changed', { index: { [B1]: { permitted: true, textHash: `sha256:${'2'.repeat(64)}` } } }, 'stale'],
      ['object unreadable', { bookText: { read: jest.fn(async () => { throw new Error('minio'); }) } }, 'unavailable'],
      ['object bytes no longer match', { bookText: { read: jest.fn(async () => Buffer.from(`${TEXT}!`)) } }, 'stale'],
    ])('%s → excerpt hidden (%s); answer text kept', async (_l, o, state) => {
      const h = harness({ rows: [completedRow([cite(B1, H)])], ...o });
      const [v] = await h.turns.history(USER_A, S, 20);
      expect(v.citations![0][0]).toMatchObject({ excerpt: null, sourceState: state });
      expect(v.segments![0].text).toBe('Según el libro…');
    });
    it('an anchor for an older text version is stale; a missing anchor is position_unavailable', async () => {
      const h = harness({ rows: [completedRow([cite(B1, H_OLD), { ref: 'chunk:c2', kind: 'chunk', bookId: B1, anchor: null }])] });
      const [v] = await h.turns.history(USER_A, S, 20);
      expect(v.citations![0].map((c) => c.sourceState)).toEqual(['stale', 'position_unavailable']);
      expect(h.bookText.read).not.toHaveBeenCalled(); // nothing to fetch for the current version
    });
    it('guard full → excerpts deferred (history degrades, never fails); no bytes read', async () => {
      const guard = new TurnGuard(1);
      guard.tryAcquire(1);
      const h = harness({ rows: [completedRow([cite(B1, H)])], guard });
      const [v] = await h.turns.history(USER_A, S, 20);
      expect(v.citations![0][0]).toMatchObject({ excerpt: null, sourceState: 'deferred' });
      expect(h.bookText.read).not.toHaveBeenCalled();
    });
    it('provisional rows are finalized before the page is returned; non-completed rows carry no segments', async () => {
      const h = harness({ rows: [{ ...completedRow([]), status: 'accepted', segments: null }] });
      h.records.listBySession.mockResolvedValueOnce([{ ...completedRow([]), status: 'accepted', segments: null }])
        .mockResolvedValueOnce([{ ...completedRow([]), status: 'interrupted', segments: null }]);
      h.records.finalize.mockResolvedValue(1);
      const [v] = await h.turns.history(USER_A, S, 500);
      expect(h.records.finalize).toHaveBeenCalledWith([TURN]);
      expect(h.records.listBySession).toHaveBeenLastCalledWith(S, 50); // limit clamped
      expect(v).toMatchObject({ status: 'interrupted', segments: null, citations: null });
    });
    it('turnView: owner only; unknown turn → not_found; provisional row finalized first', async () => {
      expect((await caught(harness({ owned: false }).turns.turnView(USER_A, S, TURN)))?.reason).toBe('not_found');
      expect((await caught(harness().turns.turnView(USER_A, S, TURN)))?.reason).toBe('not_found');
      const h = harness({ rows: [{ ...completedRow([]), status: 'accepted', segments: null }] });
      h.records.findHistoryRow.mockResolvedValueOnce({ ...completedRow([]), status: 'accepted', segments: null })
        .mockResolvedValueOnce({ ...completedRow([]), status: 'interrupted', segments: null });
      expect((await h.turns.turnView(USER_A, S, TURN)).status).toBe('interrupted');
    });
    it('without NEM-024 dependencies the read routes are refused', async () => {
      const bare = new TurnService({} as any, {} as any, {} as any, {} as any, {} as any, TEST_CONFIG, {} as any);
      for (const call of [() => bare.history(USER_A, S), () => bare.turnView(USER_A, S, TURN), () => bare.cancel(USER_A, S, KEY)]) expect((await caught(call()))?.reason).toBe('feature_disabled');
    });
    it('no S2 reader bound → excerpts deferred', async () => {
      const h = harness({ rows: [completedRow([cite(B1, H)])] });
      (h.turns as any).bookText = undefined;
      const [v] = await h.turns.history(USER_A, S, 20);
      expect(v.citations![0][0].sourceState).toBe('deferred');
    });
  });
});
