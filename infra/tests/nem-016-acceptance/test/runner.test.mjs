import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../lib/client.mjs';
import { GuardError, derivePassword } from '../lib/guard.mjs';
import { MATRIX } from '../lib/matrix.mjs';
import { accountEmail, buildExcerpt, Ctx, runTests } from '../lib/runner.mjs';
import { fakeApi } from './fake-api.mjs';

const SEED = 'f'.repeat(64);
const TARGET = Object.freeze({ name: 'local', api: 'http://127.0.0.1:14016', storage: 'http://127.0.0.1:19016' });
const ALL_APPROVED = new Set(['A8b', 'A12', 'A14b', 'A15', 'A19']);
const AUTOMATED = MATRIX.filter((t) => t.checks.some((c) => c.kind === 'api') && t.id !== 'A11');

async function setup(defects = new Set(), { approved = ALL_APPROVED, env = {} } = {}) {
  const api = fakeApi({ defects, storage: TARGET.storage });
  const client = new ApiClient(TARGET, { fetchImpl: api.fetchImpl, sleep: async () => {}, minIntervalMs: 0 });
  const state = { runId: 'abc123', users: {}, fragments: {}, shares: {}, book: null, results: {}, snapshots: {}, a11: {} };
  for (const role of ['a', 'b', 'r', 'd', 'x', 'adm']) {
    const email = accountEmail('abc123', role);
    const res = await client.request('POST', '/auth/register', { json: { name: role, email, password: derivePassword(SEED, 'abc123', role) } });
    state.users[role] = { id: res.body.user.id, email };
  }
  const form = new FormData(); form.set('title', 'fixture');
  const admin = (await client.request('POST', '/auth/login', { json: { email: state.users.adm.email, password: derivePassword(SEED, 'abc123', 'adm') } })).body.accessToken;
  state.book = { id: (await client.request('POST', '/books', { token: admin, form, fixtureUpload: true })).body.id };
  const t = new Ctx({ client, state, seed: SEED, approved, sleep: async () => {}, env: {
    NEM016_PRESET_BG_URL: 'https://bgstatic/backgrounds/imagen-7.jpg', NEM016_INELIGIBLE_BOOK_ID: api.db.ineligible, NEM016_ELIGIBLE_BOOK_ID: api.db.seededBook, NEM016_A8B_TOKEN_SEEDED: '1', ...env } });
  t.startedAt = new Date(0).toISOString();
  // A8b's fake token is seeded by the operator; the fake models that with this flag.
  api.db.seedSocial = env.NEM016_A8B_TOKEN_SEEDED !== '0' && !env.keepA8Unconnected;
  return { api, client, state, t };
}

const statusOf = (state, id) => state.results[id]?.status;

test('correct behaviour passes every automated check', async () => {
  const { state, t, api } = await setup();
  api.db.seedSocial = false;
  await runTests(t, new Set(AUTOMATED.map((x) => x.id).filter((id) => id !== 'A8b')));
  api.db.seedSocial = true;
  t.state.book.deleted = false;
  await runTests(t, new Set(['A8b']));
  for (const test of AUTOMATED) for (const c of test.checks.filter((k) => k.kind === 'api')) {
    if (test.id === 'A8b' || test.id === 'A14b') continue;
    assert.equal(statusOf(state, c.id), 'PASS', `${c.id}: ${state.results[c.id]?.detail}`);
  }
});

const DEFECTS = [
  ['noOwnerCheck', 'A1', 'A1.api'],
  ['acceptAllQuotes', 'A3', 'A3.api'],
  ['acceptAllQuotes', 'A5', 'A5.api'],
  ['noCanon', 'A4', 'A4.api'],
  ['allowAnyBg', 'A7', 'A7.api'],
  ['noDedupe', 'A9', 'A9.api'],
  ['noDedupe', 'X4', 'X4.api'],
  ['anyoneRevokes', 'A10', 'A10.api'],
  ['revokeKeepsImage', 'A10', 'A10.api'],
  ['fragmentDeleteKeepsShares', 'A12', 'A12.fragment'],
  ['noGate', 'A14', 'A14.api'],
  ['noRateLimit', 'A15', 'A15.api'],
  ['noDto', 'X1', 'X1.api'],
  ['leakFields', 'X3', 'X3.api'],
  ['publishWithoutAccount', 'A8', 'A8.api'],
];

for (const [defect, testId, check] of DEFECTS) {
  test(`detects the "${defect}" defect in ${testId}`, async () => {
    const { state, t, api } = await setup(new Set([defect]));
    api.db.seedSocial = false;
    await runTests(t, new Set([testId]));
    assert.equal(statusOf(state, check), 'FAIL', state.results[check]?.detail);
  });
}

test('A19 fails if a changed word is accepted', async () => {
  const { state, t } = await setup(new Set(['acceptAllQuotes']));
  await runTests(t, new Set(['A19']));
  assert.equal(statusOf(state, 'A19.api'), 'FAIL');
});

test('unapproved disruptive tests stay BLOCKED and make no writes', async () => {
  const { state, t, api } = await setup(new Set(), { approved: new Set() });
  const before = api.db.calls.length;
  await runTests(t, new Set(['A11', 'A12', 'A14b', 'A15', 'A19', 'A8b']));
  for (const id of ['A11.prepare', 'A12.fragment', 'A12.account', 'A14b.api', 'A15.api', 'A19.api', 'A8b.api']) assert.equal(statusOf(state, id), 'BLOCKED', id);
  assert.deepEqual(api.db.calls.slice(before).filter((c) => !c.startsWith('GET')), []);
  assert.ok(api.db.books.has(state.book.id), 'fixture still exists');
});

test('A11 does nothing until the operator names a phase', async () => {
  const { state, t, api } = await setup(new Set(), { approved: new Set(['A11']) });
  const before = api.db.calls.length;
  await runTests(t, new Set(['A11']));
  assert.equal(statusOf(state, 'A11.prepare'), 'BLOCKED');
  assert.deepEqual(api.db.calls.slice(before).filter((c) => !c.startsWith('GET')), []);
});

test('A14 is BLOCKED, not failed, without a book below the gate', async () => {
  const { state, t } = await setup(new Set(), { env: { NEM016_INELIGIBLE_BOOK_ID: '' } });
  await runTests(t, new Set(['A14']));
  assert.equal(statusOf(state, 'A14.api'), 'BLOCKED');
});

test('A8b is BLOCKED until the fake token is seeded', async () => {
  const { state, t } = await setup(new Set(), { env: { NEM016_A8B_TOKEN_SEEDED: '0' } });
  await runTests(t, new Set(['A8b']));
  assert.equal(statusOf(state, 'A8b.api'), 'BLOCKED');
});

test("A8b refuses to run a case with the caller's own live card", async () => {
  const { t, client, state, api } = await setup();
  await runTests(t, new Set(['A2']));
  const live = state.shares.Q1.imageUrl;
  const realReq = client.request.bind(client);
  // Simulate a bug in the case list: B's card turns out to be A's live URL.
  client.request = async (m, p, o) => {
    const res = await realReq(m, p, o);
    if (p.endsWith('/share') && o?.json?.citation === undefined && res.body?.imageUrl && t.tokens.get('b')?.token === o?.token) res.body.imageUrl = live;
    return res;
  };
  api.db.seedSocial = true;
  await assert.rejects(() => runTests(t, new Set(['A8b'])), GuardError);
});

test('tests depending on the fixture are BLOCKED once it is gone', async () => {
  const { state, t } = await setup();
  await runTests(t, new Set(['A14b']));
  assert.equal(statusOf(state, 'A14b.api'), 'PASS', state.results['A14b.api']?.detail);
  await runTests(t, new Set(['A2']));
  assert.equal(statusOf(state, 'A2.api'), 'BLOCKED');
});

test('A14b runs last even when listed with others', async () => {
  const { state, t } = await setup();
  await runTests(t, new Set(['A14b', 'A2']));
  assert.equal(statusOf(state, 'A2.api'), 'PASS');
  assert.equal(statusOf(state, 'A14b.api'), 'PASS');
});

test('A15 waits for a fresh window, and a crossed window is NOT RUN, not FAIL', async () => {
  const { state, t, client } = await setup();
  const slept = [];
  t.sleep = async (ms) => { slept.push(ms); };
  const base = Math.floor(Date.now() / 600_000) * 600_000;
  const real = client.request.bind(client);
  let n = 0;
  client.request = async (...a) => { const r = await real(...a); n++; r.date = new Date(base + 599_000 + (n > 10 ? 2000 : 0)).toUTCString(); return r; };
  await runTests(t, new Set(['A15']));
  assert.ok(slept.length >= 1, 'waited for a new window');
  assert.equal(statusOf(state, 'A15.api'), 'NOT RUN');
});

test('stops running once the target is unhealthy', async () => {
  const { state, t, client } = await setup();
  const real = client.request.bind(client);
  client.request = async (m, p, o) => (p === '/health' ? { status: 502, body: null } : real(m, p, o));
  await runTests(t, new Set(['A1', 'A2']));
  assert.equal(statusOf(state, 'A2.api'), 'BLOCKED');
});

test('no token or password reaches the recorded state', async () => {
  const { state, t } = await setup();
  await runTests(t);
  const dump = JSON.stringify(state);
  assert.ok(!dump.includes('eyJfake'), 'token');
  assert.ok(!dump.includes('Aa1-'), 'password');
});

test('the excerpt builder skips short, exception and symbol-heavy phrases', () => {
  assert.equal(buildExcerpt([{ text: 'corta' }, { text: 'una frase con seis palabras aquí', exception: true }, { text: 'con [corchetes] que no sirven para nada hoy' }]), null);
  assert.equal(buildExcerpt([]), null);
  assert.equal(buildExcerpt(undefined), null);
  const { excerpt, altered } = buildExcerpt([{ text: 'una frase con seis palabras aquí' }]);
  assert.equal(excerpt, 'una frase con seis palabras aquí');
  assert.notEqual(altered, excerpt);
  assert.equal(altered.split(' ').length, excerpt.split(' ').length);
});
