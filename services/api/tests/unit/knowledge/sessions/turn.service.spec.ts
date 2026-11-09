import { IntelligenceDenied } from '../../../../src/knowledge/common/intelligence-denied.error';
import { ModelGatewayService } from '../../../../src/knowledge/ai/model-gateway.service';
import { ModelRouterService } from '../../../../src/knowledge/ai/model-router.service';
import { SimulatedProviderService } from '../../../../src/knowledge/ai/simulated-provider.service';
import { NO_PROVIDER } from '../../../../src/knowledge/metering/budget-ledger.service';
import { ContextBuilderService } from '../../../../src/knowledge/sessions/context-builder.service';
import { SessionsService } from '../../../../src/knowledge/sessions/sessions.service';
import { TurnService, turnIdempotencyKey } from '../../../../src/knowledge/sessions/turn.service';
import { bookId, mockMetrics, TEST_CONFIG, USER_A, USER_B } from '../support/fixtures';
import { sessionStore } from '../support/session-store';

/**
 * Model path `research_session.turn` — declared context invariant
 * `research_session_context` (B-3, AC-12a). This suite proves the invariant on
 * the turn path and the ADR-006 turn order / failure table (B-5).
 */
function setup(opts: { ineligible?: string[]; candidates?: any[] } = {}) {
  const store = sessionStore([bookId(1), bookId(2), bookId(3), bookId(4)]);
  const tier = { name: 'noetia_plus' as 'noetia_plus' | 'noetia_x', allowed: true };
  const entitlements = {
    resolve: jest.fn(async () => (tier.allowed
      ? { allowed: true, tier: tier.name, capability: 'research_session', policy: { id: 'p', version: 1 }, limits: { maxBooks: tier.name === 'noetia_x' ? 10 : 3 } }
      : { allowed: false, reason: 'prerequisite_missing' })),
  };
  const ineligible = new Set(opts.ineligible ?? []);
  const rights = { eligibility: jest.fn(async (_u: string, b: string) => (ineligible.has(b) ? { eligible: false } : { eligible: true })) };
  const metrics = mockMetrics();
  const sessions = new SessionsService(store.db as any, entitlements as any, rights as any, metrics);
  const ledger = {
    reserve: jest.fn(async (r: any) => ({ idempotencyKey: r.idempotencyKey, units: 10 })),
    recordUsage: jest.fn(async () => undefined),
    settle: jest.fn(async () => 'settled'),
    release: jest.fn(async () => 'settled'),
  };
  const rateCards = { active: jest.fn(async () => null) };
  const sim = new SimulatedProviderService();
  const gateway = new ModelGatewayService(new ModelRouterService([sim]), TEST_CONFIG);
  const invokeSpy = jest.spyOn(gateway, 'invoke');
  const contextSource = { candidates: jest.fn(async () => opts.candidates ?? []) };
  const turns = new TurnService(store.db as any, sessions, rights as any, new ContextBuilderService(metrics), ledger as any,
    rateCards as any, gateway, metrics, contextSource as any);
  return { store, sessions, turns, ledger, sim, invokeSpy, tier, ineligible, metrics, rateCards };
}

const reason = async (p: Promise<unknown>) => p.then(() => 'allowed', (e) => (e instanceof IntelligenceDenied ? e.reason : e.message));
const KEY = 'client-key-0001';

describe('TurnService — research_session.turn', () => {
  it('happy path: reserve → lock → provider → settle; lock recorded with the set hash', async () => {
    const t = setup();
    const s = await t.sessions.create(USER_A, [bookId(1), bookId(2)]);
    const r = await t.turns.run(USER_A, s.id, KEY);
    expect(r).toMatchObject({ settlement: 'settled', excludedBookIds: [] });
    expect(r.segments.every((seg) => ['library', 'synthesis', 'broader', 'user_content'].includes(seg.origin))).toBe(true);
    const key = turnIdempotencyKey(USER_A, s.id, KEY);
    expect(t.ledger.reserve).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: key, tier: 'noetia_plus' }));
    expect(t.ledger.settle).toHaveBeenCalledWith(key, expect.any(Number), null);
    expect(t.store.sessions[0]).toMatchObject({ turnCount: 1 });
    expect(t.store.sessions[0].lockedAt).not.toBeNull();
    // Order: reservation strictly before the provider call.
    expect(t.ledger.reserve.mock.invocationCallOrder[0]).toBeLessThan(t.invokeSpy.mock.invocationCallOrder[0]);
  });

  it('idempotency keys are namespaced per user and session', () => {
    expect(turnIdempotencyKey(USER_A, 's', KEY)).not.toBe(turnIdempotencyKey(USER_B, 's', KEY));
    expect(turnIdempotencyKey(USER_A, 's', KEY)).toMatch(/^turn:[0-9a-f]{64}$/);
  });

  describe('preflight (steps 1–3): no lock, no charge', () => {
    it('entitlement denial', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.tier.allowed = false;
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('prerequisite_missing');
      expect(t.ledger.reserve).not.toHaveBeenCalled();
      expect(t.store.sessions[0].lockedAt).toBeNull();
    });

    it("other user's session → not_found", async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      expect(await reason(t.turns.run(USER_B, s.id, KEY))).toBe('not_found');
    });

    it('read-only session is rejected', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.store.sessions[0].status = 'read_only';
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('session_read_only');
    });

    it('downgrade over the limit marks read_only before any reservation', async () => {
      const t = setup();
      t.tier.name = 'noetia_x';
      const s = await t.sessions.create(USER_A, [bookId(1), bookId(2), bookId(3), bookId(4)]);
      t.tier.name = 'noetia_plus';
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('session_read_only');
      expect(t.store.sessions[0].status).toBe('read_only');
      expect(t.ledger.reserve).not.toHaveBeenCalled();
    });

    it('no eligible book (empty set or all revoked) is rejected', async () => {
      const t = setup();
      const empty = await t.sessions.create(USER_A, []);
      expect(await reason(t.turns.run(USER_A, empty.id, KEY))).toBe('no_eligible_books');
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.ineligible.add(bookId(1));
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('no_eligible_books');
    });

    it('a revoked book is excluded from the turn and disclosed', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1), bookId(2)]);
      t.ineligible.add(bookId(2));
      const r = await t.turns.run(USER_A, s.id, KEY);
      expect(r.excludedBookIds).toEqual([bookId(2)]);
      expect(r.segments.some((seg) => seg.bookId === bookId(2))).toBe(false);
    });

    it('budget rejection does not lock the set', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.ledger.reserve.mockRejectedValueOnce(new IntelligenceDenied('budget_exhausted'));
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('budget_exhausted');
      expect(t.store.sessions[0].lockedAt).toBeNull();
      expect(t.invokeSpy).not.toHaveBeenCalled();
    });

    it('ledger unavailable at admission → denied before any provider call', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.ledger.reserve.mockRejectedValueOnce(new IntelligenceDenied('budget_unavailable'));
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('budget_unavailable');
      expect(t.invokeSpy).not.toHaveBeenCalled();
      expect(t.store.sessions[0].lockedAt).toBeNull();
    });
  });

  describe('context invariant research_session_context (AC-13)', () => {
    it.each([
      ['chunk from an unselected book', { kind: 'chunk', ref: 'c', bookId: bookId(4) }],
      ['highlight from an unselected book', { kind: 'highlight', ref: 'h', bookId: bookId(4), userId: USER_A }],
      ['note from an unselected book', { kind: 'note', ref: 'n', bookId: bookId(4), userId: USER_A }],
      ["another user's highlight", { kind: 'highlight', ref: 'h', bookId: bookId(1), userId: USER_B }],
    ])('%s aborts the turn: no reservation, no lock, no provider call, metric fires', async (_label, item) => {
      const t = setup({ candidates: [item] });
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('scope_violation');
      expect(t.ledger.reserve).not.toHaveBeenCalled();
      expect(t.invokeSpy).not.toHaveBeenCalled();
      expect(t.store.sessions[0].lockedAt).toBeNull();
      expect(t.metrics.scopeViolationInc).toHaveBeenCalled();
    });

    it('a highlight from an excluded (revoked) selected book cannot reach the context', async () => {
      const t = setup({ candidates: [{ kind: 'highlight', ref: 'h', bookId: bookId(2), userId: USER_A }] });
      const s = await t.sessions.create(USER_A, [bookId(1), bookId(2)]);
      t.ineligible.add(bookId(2));
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('scope_violation');
    });

    it('AC-14: a planner naming an unselected book is rejected after settlement', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.sim.enqueue({ kind: 'success', units: 3, toolCalls: [{ name: 'retrieve', bookId: bookId(4) }] });
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('scope_violation');
      expect(t.ledger.settle).toHaveBeenCalledWith(expect.any(String), 3, null); // usage is still settled, once
      expect(t.metrics.scopeViolationInc).toHaveBeenCalled();
    });
  });

  describe('step 4 (lock transaction) failures', () => {
    it('a lock-transaction error releases the reservation; no provider call', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.store.db.failNext = /FOR UPDATE/;
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('turn_failed');
      expect(t.ledger.release).toHaveBeenCalledTimes(1);
      expect(t.invokeSpy).not.toHaveBeenCalled();
      expect(t.store.sessions[0].lockedAt).toBeNull();
    });

    it('if the release cannot be written, a no-provider usage record is left for reconciliation', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.store.db.failNext = /FOR UPDATE/;
      t.ledger.release.mockRejectedValueOnce(new Error('ledger down'));
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('turn_failed');
      expect(t.ledger.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ provider: NO_PROVIDER, unitsReported: 0, outcome: 'aborted' }));
    });

    it('if both release and evidence fail, the reservation simply stays held', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.store.db.failNext = /FOR UPDATE/;
      t.ledger.release.mockRejectedValueOnce(new Error('down'));
      t.ledger.recordUsage.mockRejectedValueOnce(new Error('down'));
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('turn_failed');
    });

    it('a set changed between preflight and lock → set_changed, released, not locked', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.ledger.reserve.mockImplementationOnce(async (r: any) => {
        await t.sessions.addBook(USER_A, s.id, bookId(2)); // races the first turn
        return { idempotencyKey: r.idempotencyKey, units: 10 };
      });
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('set_changed');
      expect(t.ledger.release).toHaveBeenCalled();
      expect(t.store.sessions[0].lockedAt).toBeNull();
    });

    it('session turned read-only between preflight and lock → released', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.ledger.reserve.mockImplementationOnce(async (r: any) => {
        t.store.sessions[0].status = 'read_only';
        return { idempotencyKey: r.idempotencyKey, units: 10 };
      });
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('session_read_only');
      expect(t.ledger.release).toHaveBeenCalled();
    });
  });

  describe('steps 5–6: the lock stands; settlement is never assumed', () => {
    it.each([
      ['failure with unknown usage', { kind: 'failure', units: null }],
      ['aborted stream', { kind: 'abort' }],
      ['timeout', { kind: 'hang' }],
    ] as const)('%s → held (no settlement), lock stands, turn_failed', async (_l, behavior) => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.sim.enqueue(behavior as any);
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('turn_failed');
      expect(t.ledger.settle).not.toHaveBeenCalled();
      expect(t.ledger.release).not.toHaveBeenCalled();
      expect(t.ledger.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ unitsReported: null }));
      expect(t.store.sessions[0].lockedAt).not.toBeNull();
    });

    it('failure with known usage is settled from reported usage', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.sim.enqueue({ kind: 'failure', units: 2 });
      expect(await reason(t.turns.run(USER_A, s.id, KEY))).toBe('turn_failed');
      expect(t.ledger.settle).toHaveBeenCalledWith(expect.any(String), 2, null);
    });

    it('ledger unavailable at settlement → held; the turn still answers', async () => {
      const t = setup();
      const s = await t.sessions.create(USER_A, [bookId(1)]);
      t.ledger.settle.mockRejectedValueOnce(new Error('ledger down'));
      const r = await t.turns.run(USER_A, s.id, KEY);
      expect(r.settlement).toBe('held');
      expect(t.ledger.release).not.toHaveBeenCalled();
    });

    it('a downgrade during an active turn: the turn completes; the next turn is read_only', async () => {
      const t = setup();
      t.tier.name = 'noetia_x';
      const s = await t.sessions.create(USER_A, [bookId(1), bookId(2), bookId(3), bookId(4)]);
      t.sim.beforeRespond = async () => { t.tier.name = 'noetia_plus'; };
      expect((await t.turns.run(USER_A, s.id, KEY)).settlement).toBe('settled');
      t.sim.beforeRespond = undefined;
      expect(await reason(t.turns.run(USER_A, s.id, 'client-key-0002'))).toBe('session_read_only');
    });
  });
});
