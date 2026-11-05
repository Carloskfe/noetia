import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ApiClient } from '../lib/client.mjs';
import { assertAdminSqlAllowed, assertImageUrl, assertOutsideRepo, assertRoute, assertTestEmail, authorizationPhrase, derivePassword, GuardError, readSecretSeed, redact, resolveTarget, STAGING, writeSecretSeed } from '../lib/guard.mjs';

const SHA = 'a'.repeat(40);
const UUID = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const refused = (fn) => assert.throws(fn, GuardError);

test('production and unknown targets are refused', () => {
  for (const name of ['production', 'prod', 'main', '', undefined]) refused(() => resolveTarget({ NEM016_TARGET: name }));
});

test('there is no way to point the staging target somewhere else', () => {
  const t = resolveTarget({ NEM016_TARGET: 'staging', NEM016_DEPLOYED_SHA: SHA, NEM016_PO_AUTHORIZATION: authorizationPhrase(SHA), NEM016_API: 'https://noetia.app/api', NEM016_LOCAL_API: 'https://noetia.app' });
  assert.equal(t.api, 'https://staging.noetia.app/api');
  assert.equal(t.storage, 'https://storage.staging.noetia.app');
  assert.ok(Object.isFrozen(t));
});

test('staging needs the authorization phrase for the exact deployed commit', () => {
  refused(() => resolveTarget({ NEM016_TARGET: 'staging' }));
  refused(() => resolveTarget({ NEM016_TARGET: 'staging', NEM016_DEPLOYED_SHA: SHA }));
  refused(() => resolveTarget({ NEM016_TARGET: 'staging', NEM016_DEPLOYED_SHA: SHA, NEM016_PO_AUTHORIZATION: 'yes' }));
  refused(() => resolveTarget({ NEM016_TARGET: 'staging', NEM016_DEPLOYED_SHA: SHA, NEM016_PO_AUTHORIZATION: authorizationPhrase('b'.repeat(40)) }));
  refused(() => resolveTarget({ NEM016_TARGET: 'staging', NEM016_DEPLOYED_SHA: 'abc', NEM016_PO_AUTHORIZATION: authorizationPhrase('abc') }));
});

test('the local target only accepts loopback origins', () => {
  const env = (api, storage = 'http://127.0.0.1:19016') => ({ NEM016_TARGET: 'local', NEM016_LOCAL_API: api, NEM016_LOCAL_STORAGE: storage });
  assert.equal(resolveTarget(env('http://127.0.0.1:14016')).api, 'http://127.0.0.1:14016');
  for (const bad of ['https://noetia.app', 'http://noetia.app', 'http://84.247.140.175:4000', 'http://127.0.0.1.noetia.app', 'http://user:pw@127.0.0.1:1', 'nonsense', '']) refused(() => resolveTarget(env(bad)));
  refused(() => resolveTarget(env('http://127.0.0.1:14016', 'https://storage.noetia.app')));
});

test('writes to existing books are impossible', () => {
  refused(() => assertRoute('PATCH', `/books/${UUID}`));
  refused(() => assertRoute('PATCH', `/books/${UUID}/publish`));
  refused(() => assertRoute('POST', `/books/${UUID}/sync-map`));
  refused(() => assertRoute('POST', `/books/${UUID}/sync-map/srt`));
  refused(() => assertRoute('POST', '/books'));
  refused(() => assertRoute('DELETE', `/books/${UUID}`));
  refused(() => assertRoute('DELETE', `/books/${UUID}`, { deletableBookIds: [OTHER] }));
  assert.doesNotThrow(() => assertRoute('DELETE', `/books/${UUID}`, { deletableBookIds: [UUID] }));
  assert.doesNotThrow(() => assertRoute('POST', '/books', { fixtureUpload: true }));
});

test('on staging no book can be created or deleted, whatever the options say', async () => {
  refused(() => assertRoute('POST', '/books', { fixtureUpload: true, protectBooks: true }));
  refused(() => assertRoute('DELETE', `/books/${STAGING.fixtureBookId}`, { deletableBookIds: [STAGING.fixtureBookId], protectBooks: true }));
  let calls = 0;
  const client = new ApiClient(STAGING, { fetchImpl: async () => { calls++; return new Response('{}'); }, minIntervalMs: 0 });
  client.deletableBookIds = [STAGING.fixtureBookId];
  await assert.rejects(() => client.request('DELETE', `/books/${STAGING.fixtureBookId}`), GuardError);
  await assert.rejects(() => client.request('POST', '/books', { fixtureUpload: true }), GuardError);
  assert.equal(calls, 0);
});

test('admin SQL is never generated for staging', () => {
  assert.doesNotThrow(() => assertAdminSqlAllowed({ NEM016_TARGET: 'local' }));
  for (const t of ['staging', 'production', undefined]) refused(() => assertAdminSqlAllowed({ NEM016_TARGET: t }));
});

test('the existing staging records are pinned exactly', () => {
  assert.equal(STAGING.fixtureBookId, '68303e17-3a80-4f17-b3c1-8be00a66cc71');
  assert.equal(STAGING.adminId, '4219d326-b9fc-4aa9-8d35-6ce8b9e6e787');
  assert.equal(STAGING.adminEmail, 'nem016-admin-test@noetia.invalid');
  refused(() => assertTestEmail(STAGING.adminEmail));
});

test('only listed routes are reachable', () => {
  for (const [m, p] of [['PATCH', '/users/me'], ['POST', '/admin/x'], ['POST', '/social/facebook/publish'], ['GET', '/subscriptions'], ['POST', `/subscriptions/checkout`], ['GET', '/shares/../users']]) refused(() => assertRoute(m, p));
  assert.doesNotThrow(() => assertRoute('POST', `/fragments/${UUID}/share`));
  assert.doesNotThrow(() => assertRoute('DELETE', '/shares/AbC123'));
  refused(() => assertRoute('GET', `/books/${UUID}`));
});

test('a refused route makes no network call', async () => {
  let calls = 0;
  const client = new ApiClient(STAGING, { fetchImpl: async () => { calls++; throw new Error('network'); }, minIntervalMs: 0 });
  await assert.rejects(() => client.request('PATCH', `/books/${UUID}`), GuardError);
  assert.equal(calls, 0);
});

test('redirects are never followed', async () => {
  let seen;
  const client = new ApiClient(STAGING, { fetchImpl: async (_u, init) => { seen = init.redirect; return new Response(null, { status: 302, headers: { location: 'https://noetia.app/' } }); }, minIntervalMs: 0 });
  const res = await client.request('GET', '/health');
  assert.equal(seen, 'manual');
  assert.equal(res.status, 302);
});

test('images are fetched only from the target storage origin', () => {
  assert.doesNotThrow(() => assertImageUrl(STAGING, `https://storage.staging.noetia.app/images/${UUID}.png`));
  for (const u of [`https://storage.noetia.app/images/${UUID}.png`, `http://storage.staging.noetia.app/images/${UUID}.png`, `https://storage.staging.noetia.app/books/${UUID}.png`, `https://storage.staging.noetia.app/images/${UUID}.png?x=1`, 'nonsense']) {
    refused(() => assertImageUrl(STAGING, u));
  }
});

test('accounts must be synthetic and undeliverable', () => {
  assert.doesNotThrow(() => assertTestEmail('nem016-abc123-a@staging.invalid'));
  for (const e of ['carlos@noetia.app', 'nem016-abc123-a@gmail.com', 'nem016-abc123-z@staging.invalid', "x'@staging.invalid"]) refused(() => assertTestEmail(e));
});

test('a host-wide throttle 429 is retried, not read as the share limit', async () => {
  const replies = [new Response('{"statusCode":429,"message":"ThrottlerException"}', { status: 429 }), new Response('{"ok":true}', { status: 200 })];
  let waited = 0;
  const client = new ApiClient(STAGING, { fetchImpl: async () => replies.shift(), sleep: async () => { waited++; }, minIntervalMs: 0 });
  const res = await client.request('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(waited, 1);
});

test('the per-user limit is returned as is', async () => {
  const client = new ApiClient(STAGING, { fetchImpl: async () => new Response('{"error":"rate_limited"}', { status: 429 }), minIntervalMs: 0 });
  assert.equal((await client.request('GET', '/health')).status, 429);
});

test('no response is reported as status 0, not thrown', async () => {
  const client = new ApiClient(STAGING, { fetchImpl: async () => { throw new TypeError('fetch failed'); }, minIntervalMs: 0 });
  const res = await client.request('GET', '/health');
  assert.equal(res.status, 0);
  assert.equal(res.netError, 'TypeError');
});

test('secret and state files are refused inside a git repository', () => {
  const inRepo = join(dirname(fileURLToPath(import.meta.url)), 'x.secret');
  refused(() => assertOutsideRepo(inRepo, 'secret file'));
  refused(() => writeSecretSeed(inRepo));
});

test('secret file must be mode 600, and is never overwritten', { skip: process.env.NEM016_TMP_IN_REPO === '1' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'nem016-'));
  try {
    const f = join(dir, 'seed');
    writeSecretSeed(f);
    assert.match(readSecretSeed(f), /^[0-9a-f]{64}$/);
    refused(() => writeSecretSeed(f));
    chmodSync(f, 0o644);
    refused(() => readSecretSeed(f));
    const bad = join(dir, 'bad');
    writeFileSync(bad, 'short', { mode: 0o600 });
    refused(() => readSecretSeed(bad));
    refused(() => readSecretSeed(undefined));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('passwords differ per run and role', () => {
  const s = 'f'.repeat(64);
  assert.notEqual(derivePassword(s, 'run1', 'a'), derivePassword(s, 'run1', 'b'));
  assert.notEqual(derivePassword(s, 'run1', 'a'), derivePassword(s, 'run2', 'a'));
});

test('redaction removes tokens and passwords', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123_-';
  for (const raw of [jwt, `Bearer ${jwt}`, 'Authorization: Bearer abc.def', '{"password":"hunter2"}', '{"accessToken":"xyz"}', `pw ${derivePassword('f'.repeat(64), 'r', 'a')}`]) {
    const out = redact(raw);
    for (const secret of [jwt, 'hunter2', 'xyz', 'abc.def', 'Aa1-']) assert.ok(!out.includes(secret), `${raw} -> ${out}`);
  }
});
