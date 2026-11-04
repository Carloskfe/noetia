import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { adminSql, evaluateEvidence, evidenceSql, parseEvidence } from '../lib/evidence.mjs';
import { aggregate, allChecks, findTest, MATRIX, overallVerdict, testStatus } from '../lib/matrix.mjs';
import { renderCoverage, renderReport } from '../lib/report.mjs';
import { mergeManual, setCheck } from '../lib/state.mjs';

const dir = dirname(fileURLToPath(import.meta.url));

test('the matrix holds A1–A20, A8b, A14b and supplemental cases', () => {
  const ids = new Set(MATRIX.map((t) => t.id));
  for (let i = 1; i <= 20; i++) assert.ok(ids.has(`A${i}`), `A${i}`);
  for (const id of ['A8b', 'A14b', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7']) assert.ok(ids.has(id), id);
  assert.equal(new Set(allChecks().map((c) => c.id)).size, allChecks().length, 'check ids are unique');
});

test('disruptive tests need explicit approval', () => {
  for (const id of ['A8b', 'A11', 'A12', 'A14b', 'A15', 'A19']) assert.equal(findTest(id).approval, true, id);
});

test('A11 says it is disruptive, and A13 cannot be automated', () => {
  assert.match(findTest('A11').note, /DISRUPTIVE/);
  assert.equal(findTest('A13').checks.find((c) => c.id === 'A13.sequence').kind, 'operator');
});

test('status precedence: FAIL, BLOCKED, NOT RUN, PASS', () => {
  assert.equal(aggregate(['PASS', 'NOT RUN', 'BLOCKED', 'FAIL']), 'FAIL');
  assert.equal(aggregate(['PASS', 'NOT RUN', 'BLOCKED']), 'BLOCKED');
  assert.equal(aggregate(['PASS', 'NOT RUN']), 'NOT RUN');
  assert.equal(aggregate(['PASS', 'PASS']), 'PASS');
  assert.equal(aggregate([]), 'NOT RUN');
});

test('a test with a passing API check but no evidence is not PASS', () => {
  assert.equal(testStatus(findTest('A1'), { 'A1.api': { status: 'PASS' } }), 'NOT RUN');
});

const allPass = (skip = []) => Object.fromEntries(allChecks().filter((c) => !skip.includes(c.test)).map((c) => [c.id, { status: 'PASS' }]));

test('ACCEPTED only when every required test passes', () => {
  assert.equal(overallVerdict(allPass()), 'ACCEPTED');
  assert.equal(overallVerdict(allPass(['A8b', 'A14b', 'X7'])), 'ACCEPTED', 'optional and local-only tests are not required');
  assert.equal(overallVerdict(allPass(['A16'])), 'INCOMPLETE');
  assert.equal(overallVerdict({}), 'INCOMPLETE');
});

test('A13 keeps the verdict INCOMPLETE until its sequence is resolved', () => {
  const r = allPass();
  r['A13.sequence'] = { status: 'BLOCKED' };
  assert.equal(testStatus(findTest('A13'), r), 'BLOCKED');
  assert.equal(overallVerdict(r), 'INCOMPLETE');
});

test('local evidence X7 cannot stand in for A13', () => {
  const r = allPass(['A13']);
  r['X7.local'] = { status: 'PASS' };
  assert.equal(overallVerdict(r), 'INCOMPLETE');
});

test('any failure rejects, including optional tests', () => {
  const r = allPass();
  r['A8b.api'] = { status: 'FAIL' };
  assert.equal(overallVerdict(r), 'REJECTED');
});

test('hand-entered results are limited to manual and operator checks and need evidence', () => {
  const state = { results: {} };
  assert.throws(() => mergeManual(state, { 'A1.api': { status: 'PASS', evidence: 'trust me' } }), /api check/);
  assert.throws(() => mergeManual(state, { 'A1.db': { status: 'PASS', evidence: 'trust me' } }), /db check/);
  assert.throws(() => mergeManual(state, { 'A16.ios': { status: 'PASS', evidence: '' } }), /evidence/);
  assert.throws(() => mergeManual(state, { 'A16.ios': { status: 'MAYBE', evidence: 'x' } }), /unknown status/);
  assert.throws(() => mergeManual(state, { 'A99.x': { status: 'PASS', evidence: 'x' } }), /Unknown check/);
  mergeManual(state, { 'A16.ios': { status: 'PASS', evidence: 'iPhone 15, build 12' } });
  assert.equal(state.results['A16.ios'].status, 'PASS');
});

test('the report template lists every check and classification', () => {
  const body = renderReport({ template: true });
  for (const c of allChecks()) assert.ok(body.includes(`| ${c.id} |`), c.id);
  for (const s of ['**PASS**', '**FAIL**', '**BLOCKED**', '**NOT RUN**']) assert.ok(body.includes(s), s);
});

test('recorded details are redacted on the way into the report', () => {
  const state = { results: {} };
  setCheck(state, 'A1.api', 'FAIL', 'token="abc" Bearer eyJaaaaaaa.bbbbbbb.ccc');
  const body = renderReport({ state });
  assert.ok(!body.includes('abc"') && !body.includes('eyJaaaaaaa'));
});

test('committed generated docs are current', () => {
  assert.equal(readFileSync(join(dir, '..', 'COVERAGE.md'), 'utf8'), renderCoverage());
  assert.equal(readFileSync(join(dir, '..', 'REPORT-TEMPLATE.md'), 'utf8'), renderReport({ template: true }));
});

const baseState = () => ({
  runId: 'abc123',
  users: { b: { id: '11111111-1111-4111-8111-111111111111' }, r: { id: '22222222-2222-4222-8222-222222222222' }, d: { id: '33333333-3333-4333-8333-333333333333' } },
  fragments: { fA: { id: '44444444-4444-4444-8444-444444444444' } },
  shares: { a11: { id: 'abc', imageUrl: 'https://s/images/55555555-5555-4555-8555-555555555555.png' } },
  book: null, results: {}, snapshots: {},
});

test('evidence SQL is read-only and rolls back', () => {
  const sql = evidenceSql(baseState(), 'final');
  assert.match(sql, /BEGIN TRANSACTION READ ONLY/);
  assert.match(sql, /ROLLBACK;\s*$/);
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|COMMIT)\b/);
});

test('evidence SQL refuses values that could carry SQL', () => {
  const s = baseState();
  s.shares.a11.id = "x'; DROP TABLE users; --";
  assert.throws(() => evidenceSql(s, 'final'));
  const u = baseState();
  u.users.d.id = "x' OR '1'='1";
  assert.throws(() => evidenceSql(u, 'final'));
  assert.throws(() => evidenceSql(baseState(), "a'b"));
});

test('admin SQL touches exactly one synthetic row or aborts', () => {
  const sql = adminSql('nem016-abc123-adm@staging.invalid', true);
  assert.match(sql, /IF n <> 1 THEN RAISE EXCEPTION/);
  assert.match(sql, /"isAdmin" = true/);
  assert.match(sql, /LIKE 'nem016-%@staging\.invalid'/);
  assert.match(adminSql('nem016-abc123-adm@staging.invalid', false), /"isAdmin" = false/);
});

const snapshot = (over = {}) => ({
  nem016: 'final', latestMigration: 'AddShareLifecycle1748300000068', schemaColumns: 3, outboxTable: true, shareIndexes: 2, admins: 0,
  fragmentsDigest: { count: 5, md5: 'x' }, booksDigest: { count: 84, md5: 'y' }, shares: [], outbox: [],
  deletedAccount: { users: 0, fragments: 0, shares: 0 }, ...over,
});

test('evidence: schema, unchanged books and no admins pass', () => {
  const s = baseState();
  s.snapshots.baseline = snapshot({ nem016: 'baseline' });
  s.snapshots.final = snapshot();
  evaluateEvidence(s);
  for (const id of ['A13.schema', 'A17.run', 'X6.books', 'X6.admin']) assert.equal(s.results[id].status, 'PASS', id);
});

test('evidence: a changed book, fragment or leftover admin fails', () => {
  const s = baseState();
  s.snapshots.baseline = snapshot({ nem016: 'baseline' });
  s.snapshots.final = snapshot({ booksDigest: { count: 84, md5: 'changed' }, fragmentsDigest: { count: 6, md5: 'x' }, admins: 1 });
  evaluateEvidence(s);
  for (const id of ['A17.run', 'X6.books', 'X6.admin']) assert.equal(s.results[id].status, 'FAIL', id);
});

test('evidence: an unrecorded share row fails the negative tests', () => {
  const s = baseState();
  s.results['A3.api'] = { status: 'PASS' };
  s.snapshots.final = snapshot({ shares: [{ id: 'sneaky', createdById: 'x' }] });
  evaluateEvidence(s);
  assert.equal(s.results['A3.db'].status, 'FAIL');
});

test('evidence: A11 outbox needs attempts and an error class', () => {
  const key = '55555555-5555-4555-8555-555555555555.png';
  const run = (outbox) => { const s = baseState(); s.snapshots['a11-paused'] = { outbox }; evaluateEvidence(s); return s.results['A11.outbox'].status; };
  assert.equal(run([{ key, attempts: 1, lastError: 'TimeoutError' }]), 'PASS');
  assert.equal(run([{ key, attempts: 0, lastError: null }]), 'FAIL');
  assert.equal(run([]), 'FAIL');
});

const countState = (shareCount) => {
  const s = baseState();
  s.book = { id: 'F' };
  s.fragments = { fA: { id: 'f1', bookId: 'F' }, f19: { id: 'f2', bookId: 'other' } };
  s.shares = { a9: { id: 'a9x', fragmentId: 'f1' }, q1: { id: 'q1x', fragmentId: 'f1' }, a19: { id: 'a19x', fragmentId: 'f2' } };
  s.snapshots.final = snapshot({ fixtureShareCount: shareCount, shares: [{ id: 'a9x', configHash: 'h', revoked: false }, { id: 'q1x', configHash: 'i', revoked: false }, { id: 'a19x', configHash: 'j', revoked: false }] });
  evaluateEvidence(s);
  return s.results['A9.db'];
};

test('evidence: shareCount must match the shares created on the fixture', () => {
  assert.equal(countState(2).status, 'PASS', 'a19 is on another book and does not count');
  assert.equal(countState(3).status, 'FAIL', 'a reused card counted twice');
  assert.equal(countState(null).status, 'FAIL', 'no evidence is not a pass');
});

test('evidence: two live rows for one configuration fail A9', () => {
  const s = baseState();
  s.shares = { a9: { id: 'a', fragmentId: 'f' } };
  s.snapshots.final = snapshot({ fixtureShareCount: 0, shares: [{ id: 'a', configHash: 'h', revoked: false }, { id: 'b', configHash: 'h', revoked: false }] });
  evaluateEvidence(s);
  assert.equal(s.results['A9.db'].status, 'FAIL');
});

test('evidence parser finds the JSON line among psql output', () => {
  assert.equal(parseEvidence('BEGIN\nSET\n{"nem016":"final","x":1}\nROLLBACK\n').x, 1);
  assert.throws(() => parseEvidence('BEGIN\nROLLBACK\n'), /No NEM-016 evidence/);
});
