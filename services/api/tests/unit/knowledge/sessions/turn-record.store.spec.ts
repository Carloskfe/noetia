import { FENCE_GRACE_SECONDS, fenceSeconds, isUniqueViolation, TurnRecordStore } from '../../../../src/knowledge/sessions/turn-record.store';
import { FakeDb, TEST_CONFIG } from '../support/fixtures';

const S = '20000000-0000-4000-8000-000000000001';
const T = '30000000-0000-4000-8000-000000000001';

function setup(handlers: [RegExp, (p: any[]) => any][] = []) {
  const db = new FakeDb();
  for (const [re, fn] of handlers) db.on(re, fn);
  return { db, store: new TurnRecordStore(db as any, TEST_CONFIG) };
}

describe('TurnRecordStore (NEM-024 Checkpoint A)', () => {
  it('fenceSeconds = ceil(T_max) + grace, with T_max = provider timeout × attempts + retry delays + 2 statement timeouts', () => {
    expect(FENCE_GRACE_SECONDS).toBe(30);
    expect(fenceSeconds({ ...TEST_CONFIG, providerTimeoutMs: 30_000, statementTimeoutMs: 5_000 })).toBe(40 + 30);
    expect(fenceSeconds({ ...TEST_CONFIG, providerTimeoutMs: 1_000, statementTimeoutMs: 500, maxProviderAttempts: 3, maxRetryDelayMs: 2_000 })).toBe(Math.ceil((3_000 + 4_000 + 1_000) / 1000) + 30);
    expect(fenceSeconds({ ...TEST_CONFIG, providerTimeoutMs: 1_000, statementTimeoutMs: 500, maxProviderAttempts: 0 })).toBe(2 + 30);
    expect(fenceSeconds({ ...TEST_CONFIG, providerTimeoutMs: 1, statementTimeoutMs: 1, maxProviderAttempts: 10_000 })).toBe(Math.ceil((99 + 2) / 1000) + 30);
  });

  it('insertAccepted (T0): database-time fence, fresh token, inside the caller transaction', async () => {
    const m = { query: jest.fn(async () => [{ id: T }]) };
    const { store } = setup();
    const r = await store.insertAccepted(m as any, { sessionId: S, keyHash: 'turn:k', question: 'q', turnIndex: 2 });
    expect(r.id).toBe(T);
    expect(r.attemptToken).toMatch(/^[0-9a-f-]{36}$/);
    const [sql, params] = (m.query.mock.calls[0] as unknown) as [string, unknown[]];
    expect(sql).toMatch(/statement_timestamp\(\) \+ make_interval\(secs => \$6\)/);
    expect(sql).not.toMatch(/\bnow\(\)/);
    expect(params).toEqual([S, 2, 'turn:k', 'q', r.attemptToken, fenceSeconds(TEST_CONFIG)]);
  });

  it('complete (T1) and fail (T2): one conditional UPDATE in a CTE, fenced by statement_timestamp(), owner token required', async () => {
    const { db, store } = setup([[/WITH u AS \(UPDATE ai_turns SET status = 'completed'/, () => [{ n: 1 }]], [/WITH u AS \(UPDATE ai_turns SET status = 'failed'/, () => [{ n: 0 }]]]);
    expect(await store.complete(T, 'tok', { segments: [], exclusions: { ineligible: [] }, settlement: 'settled' })).toBe(true);
    expect(await store.fail(T, 'tok', 'book_ineligible', 'released', { ineligible: ['b'] })).toBe(false);
    for (const c of db.ran(/UPDATE ai_turns/)) {
      expect(c.sql).toMatch(/status = 'accepted' AND statement_timestamp\(\) < "fenceAt"/);
      expect(c.sql).toMatch(/"attemptToken" = \$2/);
      expect(c.sql).not.toMatch(/\bnow\(\)/);
    }
    expect(db.transaction).toHaveBeenCalledTimes(2); // each transition is its own transaction
    expect(db.ran(/status = 'failed'/)[0].params).toEqual([T, 'tok', 'book_ineligible', 'released', JSON.stringify({ ineligible: ['b'] })]);
    await store.fail(T, 'tok', 'turn_failed');
    expect(db.ran(/status = 'failed'/)[1].params).toEqual([T, 'tok', 'turn_failed', null, null]);
  });

  it('recordStep4Failure (B-2): idempotent INSERT … ON CONFLICT DO NOTHING; existing record kept; no lock fields', async () => {
    const { db, store } = setup([[/INSERT INTO ai_turns/, () => [{ id: 'new-id' }]]]);
    expect(await store.recordStep4Failure({ sessionId: S, keyHash: 'turn:k', question: 'q', reason: 'set_changed', release: 'released' })).toBe('new-id');
    const [c] = db.ran(/INSERT INTO ai_turns/);
    expect(c.sql).toMatch(/ON CONFLICT \("sessionId", "keyHash"\) DO NOTHING/);
    expect(c.sql).toMatch(/VALUES \(\$1, NULL, \$2, \$3, 'failed'/); // turnIndex NULL: not a research turn
    expect(c.params.slice(0, 5)).toEqual([S, 'turn:k', 'q', 'set_changed', 'released']);
    const kept = setup([[/INSERT INTO ai_turns/, () => []], [/FROM ai_turns WHERE "sessionId" = \$1 AND "keyHash"/, () => [{ id: 'existing' }]]]);
    expect(await kept.store.recordStep4Failure({ sessionId: S, keyHash: 'turn:k', question: 'q', reason: 'x', release: 'unconfirmed' })).toBe('existing');
    const broken = setup([[/INSERT INTO ai_turns/, () => []], [/FROM ai_turns WHERE "sessionId" = \$1 AND "keyHash"/, () => []]]);
    await expect(broken.store.recordStep4Failure({ sessionId: S, keyHash: 'k', question: 'q', reason: 'x', release: 'released' })).rejects.toThrow(/conflict/);
  });

  it('finders return the row or null', async () => {
    const row = { id: T, status: 'accepted' };
    const { store } = setup([[/WHERE "sessionId" = \$1 AND "keyHash"/, () => [row]], [/WHERE id = \$1/, () => []], [/status = 'accepted'$/, () => [row]]]);
    expect(await store.findByKey(S, 'k')).toEqual(row);
    expect(await store.findById(T)).toBeNull();
    expect(await store.findProvisional(S)).toEqual(row);
  });

  it('isUniqueViolation recognises TypeORM-wrapped and raw pg errors by constraint name', () => {
    expect(isUniqueViolation({ driverError: { code: '23505', constraint: 'UQ_ai_turns_one_provisional' } }, 'UQ_ai_turns_one_provisional')).toBe(true);
    expect(isUniqueViolation({ code: '23505', constraint: 'UQ_ai_turns_session_key' }, 'UQ_ai_turns_session_key')).toBe(true);
    expect(isUniqueViolation({ code: '23505', constraint: 'other' }, 'UQ_ai_turns_session_key')).toBe(false);
    expect(isUniqueViolation({ code: '40001' }, 'UQ_ai_turns_session_key')).toBe(false);
    expect(isUniqueViolation(null, 'x')).toBe(false);
  });

  it('Checkpoint B: T3 cancel and T4 finalize/sweep are fenced in opposite directions and require status accepted', async () => {
    const { db, store } = setup([[/SET status = 'cancelled'/, () => [{ n: 1 }]], [/SET status = 'interrupted'/, () => [{ n: 2 }]]]);
    expect(await store.cancel(T)).toBe(true);
    expect(await store.finalize([T, 'x'])).toBe(2);
    expect(await store.finalize([])).toBe(0);
    expect(await store.sweep(7)).toBe(2);
    const [cancel] = db.ran(/SET status = 'cancelled'/);
    expect(cancel.sql).toMatch(/status = 'accepted' AND statement_timestamp\(\) < "fenceAt"/);
    for (const c of db.ran(/SET status = 'interrupted'/)) {
      expect(c.sql).toMatch(/status = 'accepted' AND statement_timestamp\(\) >= "fenceAt"/);
      expect(c.sql).toMatch(/^WITH u AS \(UPDATE/);
      expect(c.sql).not.toMatch(/\bnow\(\)/);
      expect(c.sql).not.toMatch(/ai_budget_ledger|ai_usage_events/);
    }
    expect(db.ran(/SET status = 'interrupted'/)[1].params).toEqual([7]);
    expect(db.ran(/SET status = 'interrupted'/).length).toBe(2); // finalize([]) issues no statement
  });

  it('LW-5 guard (source-level): no transition statement uses now()', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../../../src/knowledge/sessions/turn-record.store.ts'), 'utf8');
    const updates = [...src.matchAll(/`(UPDATE ai_turns[^`]*)`/g)].map((m: RegExpMatchArray) => m[1]);
    expect(updates.length).toBeGreaterThanOrEqual(5);
    for (const u of updates) { expect(u).not.toMatch(/\bnow\(\)/); expect(u).toMatch(/statement_timestamp\(\)/); }
  });

  it('history listing and single-row lookup are scoped to the session', async () => {
    const { db, store } = setup([[/ORDER BY "createdAt" DESC/, () => [{ id: T }]], [/"sessionId" = \$1 AND id = \$2/, () => []]]);
    expect(await store.listBySession(S, 5)).toEqual([{ id: T }]);
    expect(db.ran(/ORDER BY "createdAt" DESC/)[0].params).toEqual([S, 5]);
    expect(await store.findHistoryRow(S, T)).toBeNull();
  });
});
