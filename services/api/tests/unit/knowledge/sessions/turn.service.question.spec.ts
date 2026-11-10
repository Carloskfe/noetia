import { IntelligenceDenied } from '../../../../src/knowledge/common/intelligence-denied.error';
import { TurnService, normalizeTurnQuestion, turnIdempotencyKey } from '../../../../src/knowledge/sessions/turn.service';
import { TurnStatusDenied } from '../../../../src/knowledge/sessions/turn-status.error';
import { bookId, TEST_CONFIG, USER_A } from '../support/fixtures';

/**
 * NEM-024 Checkpoint A — the question turn (model path `research_session.turn`, invariant `research_session_context`
 * unchanged). Collaborators are mocks sharing one call log, so the ADR-006 order, the final eligibility check's
 * position, and every failure branch are asserted exactly. The 3-argument path is covered by the unchanged
 * turn.service.spec.ts.
 */
const S = '20000000-0000-4000-8000-000000000001';
const [B1, B2] = [bookId(1), bookId(2)];
const H1 = `sha256:${'1'.repeat(64)}`;
const KEY = 'client-key-0001';
const TURN = '30000000-0000-4000-8000-000000000001';
const TOKEN = '40000000-0000-4000-8000-000000000001';

type Over = Partial<{
  existing: any; rowAfterDuplicate: any; prepareError: any; lockResult: any; lockError: any; releaseError: boolean;
  recordError: boolean; finalRights: Record<string, boolean>; finalIndex: Record<string, any>; finalThrows: boolean;
  invokeResult: any; complete: Array<boolean | 'throw'>; rowAfter: any; findByIdThrows: boolean; anchorThrows: boolean;
  retrievalThrows: boolean; sessionStatus: string; owned: boolean; books: any[]; eligibleStep2: Record<string, boolean>;
}>;

function setup(o: Over = {}) {
  const log: string[] = [];
  const books = o.books ?? [{ id: 'sb1', bookId: B1, position: 1 }, { id: 'sb2', bookId: B2, position: 2 }];
  const db = {
    query: jest.fn(async (sql: string) => {
      log.push('db.query');
      if (/FROM ai_conversations/.test(sql)) return o.owned === false ? [] : [{ status: o.sessionStatus ?? 'active' }];
      throw new Error(`unexpected SQL ${sql.slice(0, 60)}`);
    }),
    transaction: jest.fn(async (fn: any) => {
      log.push('lock.tx');
      if (o.lockError) throw o.lockError;
      if (o.lockResult) return o.lockResult;
      const m = { query: jest.fn(async () => [{ turnCount: 1 }]) };
      return fn(m);
    }),
  };
  const sessions = {
    resolveOrDeny: jest.fn(async () => { log.push('entitlement'); return { tier: 'noetia_plus', limits: { maxBooks: 3 } }; }),
    books: jest.fn(async () => books),
    markOverLimit: jest.fn(),
    lockOwned: jest.fn(async () => ({ status: 'active', bookSetHash: null })),
  };
  let finalPhase = false;
  const rights = {
    eligibility: jest.fn(async (_u: string, b: string) => {
      log.push(finalPhase ? `final.rights:${b}` : `rights:${b}`);
      if (finalPhase && o.finalThrows) throw new Error('down');
      const map = finalPhase ? o.finalRights : o.eligibleStep2;
      return { eligible: map?.[b] ?? true };
    }),
  };
  const passage = { ref: 'chunk:c1', bookId: B1, textHash: H1, text: 'Un faro junto al mar.', charStart: 0, charEnd: 21 };
  const retrieval = {
    resolve: jest.fn(async () => {
      log.push('retrieval');
      if (o.retrievalThrows) throw new Error('db timeout');
      return { items: [{ kind: 'chunk', ref: 'chunk:c1', bookId: B1, text: passage.text }], passages: [passage], excluded: { unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] }, truncated: false };
    }),
  };
  const indexPermission = {
    check: jest.fn(async (b: string) => {
      log.push(`final.index:${b}`);
      if (o.finalThrows) throw new Error('down');
      return o.finalIndex?.[b] ?? { permitted: true, textHash: H1 };
    }),
  };
  const anchors = { resolve: jest.fn(async () => { if (o.anchorThrows) throw new Error('x'); return { anchor: `${H1}:0-21` }; }) };
  const completes = [...(o.complete ?? [true])];
  let findByKeyCalls = 0;
  const turnRecords = {
    findByKey: jest.fn(async (): Promise<any> => {
      log.push('findByKey');
      findByKeyCalls += 1;
      return findByKeyCalls === 1 ? o.existing ?? null : o.rowAfterDuplicate ?? null;
    }),
    findById: jest.fn(async (..._a: any[]): Promise<any> => { if (o.findByIdThrows) throw new Error('db down'); return o.rowAfter ?? null; }),
    insertAccepted: jest.fn(async (..._a: any[]) => ({ id: TURN, attemptToken: TOKEN })),
    complete: jest.fn(async (..._a: any[]) => { log.push('complete'); const v = completes.length ? completes.shift() : true; if (v === 'throw') throw new Error('write failed'); return v; }),
    fail: jest.fn(async (..._a: any[]): Promise<boolean> => true),
    // Checkpoint B: lazy finalization (T4) is attempted for provisional rows; 0 = still before the fence.
    finalize: jest.fn(async (..._a: any[]) => 0),
    cancel: jest.fn(async (..._a: any[]) => true),
    recordStep4Failure: jest.fn(async (..._a: any[]) => { if (o.recordError) throw new Error('db down'); return 'failrow-1'; }),
  };
  const contextBuilder = { build: jest.fn((u: string, allowed: string[], items: any[]) => { log.push('build'); return { userId: u, allowedBookIds: allowed, items }; }) };
  const contextSource = { candidates: jest.fn(async () => []) };
  const prepared = { state: 'reserved' };
  const gateway = {
    prepare: jest.fn(async () => { log.push('prepare'); if (o.prepareError) throw o.prepareError; return prepared; }),
    release: jest.fn(async () => { log.push('release'); if (o.releaseError) throw new Error('ledger down'); }),
    invoke: jest.fn(async () => {
      log.push('invoke');
      return o.invokeResult ?? {
        outcome: 'completed', error: null, scopeViolation: false, settlement: 'settled',
        segments: [{ origin: 'library', text: 'Según el libro…', citations: [{ ref: 'chunk:c1', kind: 'chunk', bookId: B1 }] }, { origin: 'synthesis', text: 'Síntesis.', citations: [] }],
      };
    }),
  };
  // The final-check phase starts after the lock transaction.
  db.transaction.mockImplementation(async (fn: any) => {
    log.push('lock.tx');
    if (o.lockError) throw o.lockError;
    const out = o.lockResult ?? (await fn({ query: jest.fn(async () => [{ turnCount: 1 }]) }));
    finalPhase = true;
    return out;
  });
  const turns = new TurnService(db as any, sessions as any, rights as any, contextBuilder as any, gateway as any, TEST_CONFIG, contextSource as any,
    retrieval as any, indexPermission as any, anchors as any, turnRecords as any);
  return { turns, log, db, sessions, rights, retrieval, indexPermission, anchors, turnRecords, gateway, contextBuilder, prepared };
}

const denial = async (p: Promise<unknown>) => p.then(() => null, (e) => e);

describe('NEM-024 TurnService — question turn (Checkpoint A)', () => {
  it('happy path in ADR-006 order; final check sits immediately before invoke; completion before release of text', async () => {
    const t = setup();
    const r = await t.turns.run(USER_A, S, KEY, '  ¿Qué papel tiene el faro? ');
    expect(t.log).toEqual([
      'entitlement', 'db.query', 'findByKey', `rights:${B1}`, `rights:${B2}`, 'retrieval', 'build', 'prepare', 'lock.tx',
      `final.rights:${B1}`, `final.rights:${B2}`, `final.index:${B1}`, 'invoke', 'complete',
    ]);
    expect(t.retrieval.resolve).toHaveBeenCalledWith(USER_A, [B1, B2], '¿Qué papel tiene el faro?');
    expect(t.gateway.prepare).toHaveBeenCalledWith(expect.objectContaining({ turnKey: turnIdempotencyKey(USER_A, S, KEY), pathId: 'research_session.turn' }));
    expect(r).toMatchObject({ sessionId: S, turnId: TURN, status: 'completed', settlement: 'settled', excludedBookIds: [] });
    expect(r.citations![0][0]).toEqual({ ref: 'chunk:c1', kind: 'chunk', bookId: B1, anchor: `${H1}:0-21`, excerpt: 'Un faro junto al mar.', sourceState: 'available' });
    const stored = t.turnRecords.complete.mock.calls[0][2];
    expect(JSON.stringify(stored.segments)).not.toContain('Un faro junto al mar.'); // refs + anchors only (S2)
    expect(stored.segments[0].citations[0]).toEqual({ ref: 'chunk:c1', kind: 'chunk', bookId: B1, anchor: `${H1}:0-21` });
    expect(t.turnRecords.insertAccepted.mock.calls[0][1]).toEqual({ sessionId: S, keyHash: turnIdempotencyKey(USER_A, S, KEY), question: '¿Qué papel tiene el faro?', turnIndex: 1 });
    expect(t.gateway.release).not.toHaveBeenCalled();
  });

  it('without the NEM-024 dependencies a question is refused (feature_disabled), never answered without retrieval', async () => {
    const t = setup();
    const bare = new TurnService({} as any, {} as any, {} as any, {} as any, {} as any, TEST_CONFIG, {} as any);
    expect((await denial(bare.run(USER_A, S, KEY, 'q')))?.reason).toBe('feature_disabled');
    expect(t.gateway.prepare).not.toHaveBeenCalled();
  });

  it.each([['', 'empty'], ['   ', 'blank'], ['𝔘'.repeat(501), 'over 500 code points'], [42 as any, 'not a string']])('invalid question %#: %s', async (q) => {
    const t = setup();
    expect((await denial(t.turns.run(USER_A, S, KEY, q)))?.reason).toBe('invalid_request');
    expect(t.sessions.resolveOrDeny).not.toHaveBeenCalled();
  });

  it('normalizeTurnQuestion: NFC + trim; exactly 500 code points accepted', () => {
    expect(normalizeTurnQuestion(' canción ')).toBe('canción');
    expect([...normalizeTurnQuestion('𝔘'.repeat(500))]).toHaveLength(500);
  });

  it('preflight denials: not owned, read-only, no eligible book, retrieval failure — no reservation, no record', async () => {
    expect((await denial(setup({ owned: false }).turns.run(USER_A, S, KEY, 'q')))?.reason).toBe('not_found');
    expect((await denial(setup({ sessionStatus: 'read_only' }).turns.run(USER_A, S, KEY, 'q')))?.reason).toBe('session_read_only');
    const none = setup({ eligibleStep2: { [B1]: false, [B2]: false } });
    expect((await denial(none.turns.run(USER_A, S, KEY, 'q')))?.reason).toBe('no_eligible_books');
    const rf = setup({ retrievalThrows: true });
    expect((await denial(rf.turns.run(USER_A, S, KEY, 'q')))?.reason).toBe('turn_failed');
    for (const t of [none, rf]) {
      expect(t.gateway.prepare).not.toHaveBeenCalled();
      expect(t.turnRecords.insertAccepted).not.toHaveBeenCalled();
    }
  });

  it('over the tier limit: the session is marked read-only before any reservation', async () => {
    const t = setup({ books: [1, 2, 3, 4].map((n) => ({ id: `sb${n}`, bookId: bookId(n), position: n })) });
    expect((await denial(t.turns.run(USER_A, S, KEY, 'q')))?.reason).toBe('session_read_only');
    expect(t.sessions.markOverLimit).toHaveBeenCalledWith(S);
    expect(t.gateway.prepare).not.toHaveBeenCalled();
  });

  describe('replay (same key)', () => {
    const completed = {
      id: TURN, sessionId: S, status: 'completed', settlement: 'settled', attemptToken: TOKEN, failureReason: null, reservationRelease: null,
      segments: [{ origin: 'library', text: 'Según el libro…', bookId: B1, citations: [{ ref: 'chunk:c1', kind: 'chunk', bookId: B1, anchor: `${H1}:0-21` }] }],
      exclusions: { ineligible: [B2] },
    };
    it('completed → the stored result, with no Gateway call', async () => {
      const t = setup({ existing: completed });
      const r = await t.turns.run(USER_A, S, KEY, 'q');
      expect(r).toMatchObject({ turnId: TURN, status: 'completed', replayed: true, excludedBookIds: [B2], segments: [{ origin: 'library', text: 'Según el libro…', bookId: B1 }] });
      expect(r.citations![0][0]).toEqual({ ref: 'chunk:c1', kind: 'chunk', bookId: B1, anchor: `${H1}:0-21`, excerpt: null, sourceState: 'deferred' });
      expect(t.gateway.prepare).not.toHaveBeenCalled();
      expect(t.retrieval.resolve).not.toHaveBeenCalled();
    });
    it('completed replays even when the session became read-only', async () => {
      expect(await setup({ existing: completed, sessionStatus: 'read_only' }).turns.run(USER_A, S, KEY, 'q')).toMatchObject({ replayed: true });
    });
    it.each<[any, string, object]>([
      [{ id: TURN, status: 'accepted' }, 'duplicate_turn', { turnId: TURN, status: 'accepted' }],
      [{ id: TURN, status: 'failed', failureReason: 'set_changed', reservationRelease: 'released' }, 'set_changed', { turnId: TURN, status: 'failed', reservationRelease: 'released' }],
      [{ id: TURN, status: 'failed', failureReason: 'weird', reservationRelease: null }, 'turn_failed', { turnId: TURN, status: 'failed' }],
      [{ id: TURN, status: 'interrupted' }, 'turn_failed', { turnId: TURN, status: 'interrupted' }],
      [{ id: TURN, status: 'cancelled' }, 'turn_failed', { turnId: TURN, status: 'cancelled' }],
    ])('recorded %j → %s with status payload, no Gateway call', async (row, code, detail) => {
      const t = setup({ existing: row });
      const e = await denial(t.turns.run(USER_A, S, KEY, 'q'));
      expect(e).toBeInstanceOf(TurnStatusDenied);
      expect(e.reason).toBe(code);
      expect(e.detail).toEqual(detail);
      expect(e.getResponse()).toMatchObject({ code, ...detail });
      expect(t.gateway.prepare).not.toHaveBeenCalled();
    });
  });

  it('duplicate reservation (ledger attempt-key gate): replay the row if it exists, else 409 pending', async () => {
    const dup = Object.assign(new IntelligenceDenied('duplicate_turn'), {});
    const withRow = setup({ prepareError: dup, rowAfterDuplicate: { id: TURN, status: 'accepted' } });
    expect((await denial(withRow.turns.run(USER_A, S, KEY, 'q')))?.detail).toEqual({ turnId: TURN, status: 'accepted' });
    const noRow = setup({ prepareError: dup });
    const e = await denial(noRow.turns.run(USER_A, S, KEY, 'q'));
    expect([e.reason, e.detail]).toEqual(['duplicate_turn', { status: 'pending' }]);
    expect(noRow.db.transaction).not.toHaveBeenCalled();
    const other = setup({ prepareError: new IntelligenceDenied('budget_exhausted') });
    expect((await denial(other.turns.run(USER_A, S, KEY, 'q')))?.reason).toBe('budget_exhausted');
  });

  describe('step-4 failure (Amendment 1, B-2)', () => {
    it.each<[string, Over, string]>([
      ['set changed', { lockResult: { outcome: 'set_changed' } }, 'set_changed'],
      ['read-only at lock', { lockResult: { outcome: 'session_read_only' } }, 'session_read_only'],
      ['another provisional turn (partial unique index)', { lockError: Object.assign(new Error('dup'), { driverError: { code: '23505', constraint: 'UQ_ai_turns_one_provisional' } }) }, 'duplicate_turn'],
      ['same key raced to the insert', { lockError: Object.assign(new Error('dup'), { driverError: { code: '23505', constraint: 'UQ_ai_turns_session_key' } }) }, 'duplicate_turn'],
      ['transaction error', { lockError: new Error('deadlock') }, 'turn_failed'],
    ])('%s → release via the Gateway, then a terminal failed record; no provider call', async (_l, o, code) => {
      const t = setup(o);
      const e = await denial(t.turns.run(USER_A, S, KEY, 'q'));
      expect(e.reason).toBe(code);
      expect(e.detail).toEqual({ status: 'failed', reservationRelease: 'released', recorded: true, turnId: 'failrow-1' });
      expect(t.log.indexOf('release')).toBeGreaterThan(t.log.indexOf('lock.tx'));
      expect(t.turnRecords.recordStep4Failure).toHaveBeenCalledWith({ sessionId: S, keyHash: turnIdempotencyKey(USER_A, S, KEY), question: 'q', reason: code, release: 'released' });
      expect(t.gateway.invoke).not.toHaveBeenCalled();
    });

    it('release failure is reported as unconfirmed (never a confirmed release), and the record says so', async () => {
      const t = setup({ lockResult: { outcome: 'set_changed' }, releaseError: true });
      const e = await denial(t.turns.run(USER_A, S, KEY, 'q'));
      expect(e.detail).toMatchObject({ reservationRelease: 'unconfirmed', recorded: true });
      expect(t.turnRecords.recordStep4Failure).toHaveBeenCalledWith(expect.objectContaining({ release: 'unconfirmed' }));
    });

    it('failure-record write failure: denial still returned with recorded: false', async () => {
      const t = setup({ lockResult: { outcome: 'set_changed' }, recordError: true });
      const e = await denial(t.turns.run(USER_A, S, KEY, 'q'));
      expect(e.detail).toEqual({ status: 'failed', reservationRelease: 'released', recorded: false });
    });
  });

  describe('final eligibility check (F-3)', () => {
    it.each<[string, Over]>([
      ['user-level rights revoked', { finalRights: { [B2]: false } }],
      ['index permission withdrawn', { finalIndex: { [B1]: { permitted: false, reason: 'not_attested' } } }],
      ['text version changed (hash differs)', { finalIndex: { [B1]: { permitted: true, textHash: `sha256:${'2'.repeat(64)}` } } }],
      ['a check throws (fail closed)', { finalThrows: true }],
    ])('%s → no invoke; release; T2 failed; book_ineligible', async (_l, o) => {
      const t = setup(o);
      const e = await denial(t.turns.run(USER_A, S, KEY, 'q'));
      expect(e.reason).toBe('book_ineligible');
      expect(e.detail).toMatchObject({ turnId: TURN, status: 'failed', reservationRelease: 'released' });
      expect(e.detail.exclusions.ineligible.length).toBeGreaterThan(0);
      expect(t.gateway.invoke).not.toHaveBeenCalled();
      expect(t.gateway.release).toHaveBeenCalledWith(t.prepared);
      expect(t.turnRecords.fail).toHaveBeenCalledWith(TURN, TOKEN, 'book_ineligible', 'released', expect.objectContaining({ ineligible: expect.any(Array) }));
    });

    it('final-check failure with an unconfirmed release reports unconfirmed', async () => {
      const t = setup({ finalRights: { [B1]: false }, releaseError: true });
      expect((await denial(t.turns.run(USER_A, S, KEY, 'q')))?.detail).toMatchObject({ reservationRelease: 'unconfirmed' });
    });
  });

  it('provider scope violation or failure → T2 failed, denial, no text', async () => {
    const sv = setup({ invokeResult: { scopeViolation: true, outcome: 'completed', error: null, segments: [] } });
    expect((await denial(sv.turns.run(USER_A, S, KEY, 'q')))?.detail).toEqual({ turnId: TURN, status: 'failed' });
    expect(sv.turnRecords.fail).toHaveBeenCalledWith(TURN, TOKEN, 'scope_violation', null, null);
    const pf = setup({ invokeResult: { scopeViolation: false, outcome: 'timed_out', error: 'timeout', segments: [] } });
    expect((await denial(pf.turns.run(USER_A, S, KEY, 'q')))?.reason).toBe('turn_failed');
    expect(pf.turnRecords.complete).not.toHaveBeenCalled();
  });

  it('T2 lost or erroring → the stored status (or unknown) is reported', async () => {
    const t = setup({ invokeResult: { scopeViolation: false, outcome: 'refused', error: 'refusal', segments: [] }, rowAfter: { id: TURN, status: 'interrupted' } });
    t.turnRecords.fail.mockResolvedValueOnce(false);
    expect((await denial(t.turns.run(USER_A, S, KEY, 'q')))?.detail).toEqual({ turnId: TURN, status: 'interrupted' });
    const u = setup({ invokeResult: { scopeViolation: false, outcome: 'refused', error: 'refusal', segments: [] } });
    u.turnRecords.fail.mockRejectedValueOnce(new Error('db'));
    expect((await denial(u.turns.run(USER_A, S, KEY, 'q')))?.detail).toEqual({ turnId: TURN, status: 'unknown' });
  });

  describe('completion (T1) and answer release (G5)', () => {
    it('one retry after a write error, then committed → answer', async () => {
      const t = setup({ complete: ['throw', true] });
      expect(await t.turns.run(USER_A, S, KEY, 'q')).toMatchObject({ status: 'completed' });
      expect(t.turnRecords.complete).toHaveBeenCalledTimes(2);
    });
    it('lost the transition (0 rows) → the winner status, no text', async () => {
      const t = setup({ complete: [false], rowAfter: { id: TURN, status: 'interrupted', attemptToken: TOKEN } });
      const e = await denial(t.turns.run(USER_A, S, KEY, 'q'));
      expect([e.reason, e.detail]).toEqual(['turn_failed', { turnId: TURN, status: 'interrupted' }]);
      expect(JSON.stringify(e.getResponse())).not.toContain('Según el libro');
    });
    it('write errors twice and the row is still accepted → D-8(a) best-effort unrecorded delivery', async () => {
      const t = setup({ complete: ['throw', 'throw'], rowAfter: { id: TURN, status: 'accepted', attemptToken: TOKEN } });
      expect(await t.turns.run(USER_A, S, KEY, 'q')).toMatchObject({ status: 'completed', unrecorded: true });
    });
    it('ambiguous commit: the re-read shows our completed row → answer (no unrecorded flag)', async () => {
      const t = setup({ complete: ['throw', 'throw'], rowAfter: { id: TURN, status: 'completed', attemptToken: TOKEN } });
      const r = await t.turns.run(USER_A, S, KEY, 'q');
      expect(r.unrecorded).toBeUndefined();
    });
    it('ambiguous commit: completed by another token → no text', async () => {
      const t = setup({ complete: ['throw', 'throw'], rowAfter: { id: TURN, status: 'completed', attemptToken: 'other' } });
      expect((await denial(t.turns.run(USER_A, S, KEY, 'q')))?.detail).toEqual({ turnId: TURN, status: 'unknown' });
    });
    it('re-read fails → nothing confirmed → status unknown, no text', async () => {
      const t = setup({ complete: ['throw', 'throw'], findByIdThrows: true });
      expect((await denial(t.turns.run(USER_A, S, KEY, 'q')))?.detail).toEqual({ turnId: TURN, status: 'unknown' });
    });
    it('anchor resolution failure → position_unavailable, excerpt kept', async () => {
      const r = await setup({ anchorThrows: true }).turns.run(USER_A, S, KEY, 'q');
      expect(r.citations![0][0]).toMatchObject({ anchor: null, sourceState: 'position_unavailable', excerpt: 'Un faro junto al mar.' });
    });
  });
});
