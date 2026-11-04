// LOCAL ONLY: drives the R1 and R2 scenarios on the disposable stack, using held
// locks and the render gate for exact interleavings. Refuses any other target.
//   node race-driver.mjs r1 baseline|fix     r2 baseline|fix pause|stop
//   node race-driver.mjs perf <label>
import { execFileSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiClient } from '../lib/client.mjs';
import { GuardError, readSecretSeed, resolveTarget } from '../lib/guard.mjs';
import { POSITIVE, SOURCE_SENTENCE } from '../lib/cases.mjs';
import { Ctx, uploadDisposable } from '../lib/runner.mjs';
import { loadRun, saveRun, setCheck } from '../lib/state.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const COMPOSE = ['compose', '-f', join(here, 'docker-compose.yml')];
const GATE = 'http://127.0.0.1:15016';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const target = resolveTarget();
if (target.name !== 'local') throw new GuardError('race-driver is for the local stack only');

const run = loadRun(process.env.NEM016_RUN_ID);
const client = new ApiClient(target, { minIntervalMs: 50 });
const t = new Ctx({ client, state: run.state, seed: readSecretSeed(process.env.NEM016_SECRET_FILE), log: () => {} });
t.startedAt = new Date().toISOString();

const psql = (sql) => execFileSync('docker', [...COMPOSE, 'exec', '-T', 'db', 'psql', '-U', 'noetia', '-d', 'noetia_staging', '-tA', '-c', sql], { encoding: 'utf8' }).trim();
const gate = async (path, method = 'POST') => (await fetch(`${GATE}${path}`, { method })).json();
const inspect = (fmt) => execFileSync('docker', ['inspect', '-f', fmt, 'n16acc-storage-1'], { encoding: 'utf8' }).trim();
const docker = (...a) => execFileSync('docker', a, { stdio: 'ignore' });

const results = [];
function record(id, problems, ok, detail = '') {
  const pass = problems.length === 0;
  results.push({ id, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${pass ? ok : problems.join('; ')}${detail ? ` [${detail}]` : ''}`);
  return pass;
}

async function until(fn, what, ms = 20_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(100); }
  console.log(`  (not observed within ${ms} ms: ${what})`);
  return false;
}
const blocked = (pattern) => Number(psql(`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE '${pattern}'`)) > 0;

/** Holds EXCLUSIVE on a table in a background session: reads pass, writes wait. */
function holdTable(table) {
  const child = spawn('docker', [...COMPOSE, 'exec', '-T', '-e', 'PGAPPNAME=n16lock', 'db', 'psql', '-U', 'noetia', '-d', 'noetia_staging', '-c', `BEGIN; LOCK TABLE ${table} IN EXCLUSIVE MODE; SELECT pg_sleep(180);`], { stdio: 'ignore' });
  return {
    ready: () => until(() => psql(`SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid WHERE a.application_name = 'n16lock' AND l.mode = 'ExclusiveLock' AND l.relation = '${table}'::regclass AND l.granted`) === '1', `lock on ${table}`),
    release: () => { psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'n16lock'`); child.kill(); },
  };
}

const adminDelete = async (bookId) => client.request('DELETE', `/books/${bookId}`, { token: await t.login('adm') });
const liveOnBook = (bookId) => Number(psql(`SELECT count(*) FROM shares WHERE "bookId" = '${bookId}' AND "revokedAt" IS NULL`));
const rowsOnBook = (bookId) => Number(psql(`SELECT count(*) FROM shares WHERE "bookId" = '${bookId}'`));
const outboxFor = (url) => Number(psql(`SELECT count(*) FROM card_image_deletions WHERE "key" = '${url.split('/').pop()}'`));
const gateUrls = async () => (await gate('/state', 'GET')).urls;
const imageStatus = async (url) => (await client.image(url)).status;
const card = (role, fragment, citation) => t.share(role, fragment, { text: POSITIVE.Q1.text, citation });

/** A book, and a fragment on it, for one scenario. */
let seq = 0;
async function scene(role = 'a') {
  const bookId = await uploadDisposable(t);
  // Unique across driver processes: run state outlives each one.
  const fragment = await t.fragment(`race-${process.pid}-${seq++}`, role, bookId, SOURCE_SENTENCE);
  return { bookId, fragment };
}

async function newImagesGone(before, problems) {
  const fresh = (await gateUrls()).filter((u) => !before.includes(u));
  if (fresh.length === 0) problems.push('no image was rendered, so the scenario proved nothing');
  for (const u of fresh) {
    const code = await imageStatus(u);
    if (code !== 404) problems.push(`image ${code}`);
    if (outboxFor(u)) problems.push('outbox row remains');
  }
  return fresh;
}

const R1 = {
  async render(mode) {
    const { bookId, fragment } = await scene(); const p = []; const before = await gateUrls();
    await gate('/hold');
    const req = card('a', fragment, 'r1-render');
    await until(async () => (await gate('/state', 'GET')).waiting === 1, 'render held');
    const del = await adminDelete(bookId);
    if (del.status !== 204) p.push(`delete ${del.status}`);
    await gate('/release');
    const res = await req;
    if (res.status !== 404) p.push(`share returned ${res.status}, expected 404`);
    if (liveOnBook(bookId) !== 0) p.push(`${liveOnBook(bookId)} active share(s) survived the deletion`);
    if (rowsOnBook(bookId) !== 0) p.push(`${rowsOnBook(bookId)} row(s) remain`);
    await newImagesGone(before, p);
    return p;
  },
  async 'share-first'() {
    const { bookId, fragment } = await scene(); const p = []; const before = await gateUrls();
    const lock = holdTable('shares'); await lock.ready();
    const req = card('a', fragment, 'r1-sharefirst');
    const saving = await until(() => blocked('INSERT INTO "shares"%'), 'share save waiting');
    if (!saving) p.push('share save never reached the insert');
    const delReq = adminDelete(bookId);
    const waited = await until(() => blocked('%FOR UPDATE%'), 'delete waiting on the book lock', 5_000);
    console.log(`  delete blocked behind the share's book lock: ${waited}`);
    lock.release();
    const [res, del] = await Promise.all([req, delReq]);
    if (res.status !== 201 && res.status !== 200) p.push(`share returned ${res.status}`);
    if (del.status !== 204) p.push(`delete ${del.status}`);
    if (liveOnBook(bookId) !== 0) p.push(`${liveOnBook(bookId)} active share(s) survived the deletion`);
    await newImagesGone(before, p);
    return p;
  },
  async 'delete-first'() {
    const { bookId, fragment } = await scene(); const p = []; const before = await gateUrls();
    await gate('/hold');
    const req = card('a', fragment, 'r1-deletefirst');
    await until(async () => (await gate('/state', 'GET')).waiting === 1, 'render held');
    const lock = holdTable('fragments'); await lock.ready();
    const delReq = adminDelete(bookId);
    const deleting = await until(() => blocked('DELETE FROM "books"%') || blocked('DELETE FROM ONLY%fragments%'), 'delete in progress', 5_000);
    console.log(`  delete paused inside its transaction: ${deleting}`);
    await gate('/release');
    const waited = await until(() => blocked('%FOR KEY SHARE%'), 'save waiting on the book lock', 5_000);
    console.log(`  share save blocked behind the delete's book lock: ${waited}`);
    lock.release();
    const [res, del] = await Promise.all([req, delReq]);
    if (res.status !== 404) p.push(`share returned ${res.status}, expected 404`);
    if (del.status !== 204) p.push(`delete ${del.status}`);
    if (liveOnBook(bookId) !== 0) p.push(`${liveOnBook(bookId)} active share(s) survived the deletion`);
    if (rowsOnBook(bookId) !== 0) p.push(`${rowsOnBook(bookId)} row(s) remain`);
    await newImagesGone(before, p);
    return p;
  },
  async 'double-delete'() {
    const { bookId, fragment } = await scene(); const p = [];
    const share = await card('a', fragment, 'r1-double');
    if (!t.ok(share)) p.push(`share ${share.status}`);
    const interval = client.minIntervalMs; client.minIntervalMs = 0;
    const [a, b] = await Promise.all([adminDelete(bookId), adminDelete(bookId)]);
    client.minIntervalMs = interval;
    const codes = [a.status, b.status].sort().join(',');
    if (codes !== '204,404') p.push(`statuses ${codes}, expected 204,404`);
    if (liveOnBook(bookId) !== 0) p.push('an active share survived');
    if (share.body?.imageUrl && (await imageStatus(share.body.imageUrl)) !== 404) p.push('image still public');
    return p;
  },
  async concurrent() {
    const { bookId, fragment } = await scene(); const p = []; const before = await gateUrls();
    await gate('/hold');
    const interval = client.minIntervalMs; client.minIntervalMs = 0;
    const reqs = [1, 2, 3, 4, 5].map((i) => card('a', fragment, `r1-conc-${i}`));
    client.minIntervalMs = interval;
    await until(async () => (await gate('/state', 'GET')).waiting === 5, '5 renders held');
    const del = await adminDelete(bookId);
    if (del.status !== 204) p.push(`delete ${del.status}`);
    await gate('/release');
    const out = await Promise.all(reqs);
    const wrong = out.filter((r) => r.status !== 404).map((r) => r.status);
    if (wrong.length) p.push(`${wrong.length} of 5 shares not refused: ${wrong.join(',')}`);
    if (liveOnBook(bookId) !== 0) p.push(`${liveOnBook(bookId)} active share(s) survived`);
    if (rowsOnBook(bookId) !== 0) p.push(`${rowsOnBook(bookId)} row(s) remain`);
    const fresh = await newImagesGone(before, p);
    if (fresh.length !== 5) p.push(`${fresh.length} images rendered, expected 5`);
    return p;
  },
  async stress() {
    const p = []; let accepted = 0; let refused = 0; let rounds = 0;
    const stressBefore = await gateUrls();
    for (const role of ['b', 'x', 'y']) {
      for (let i = 0; i < 6; i++) {
        rounds++;
        const { bookId, fragment } = await scene(role);
        const interval = client.minIntervalMs; client.minIntervalMs = 0;
        const req = card(role, fragment, `r1-stress-${role}-${i}`);
        await sleep(Math.floor(Math.random() * 1500));
        const del = await adminDelete(bookId);
        client.minIntervalMs = interval;
        const res = await req;
        if (t.ok(res)) accepted++; else if (res.status === 404) refused++; else p.push(`round ${rounds}: share ${res.status}`);
        if (del.status !== 204) p.push(`round ${rounds}: delete ${del.status}`);
        if (liveOnBook(bookId) !== 0) p.push(`round ${rounds}: an active share survived`);
        if (t.ok(res) && (await until(async () => (await imageStatus(res.body.imageUrl)) === 404, 'image gone', 4000)) === false) p.push(`round ${rounds}: image still public`);
      }
    }
    await newImagesGone(stressBefore, p);
    console.log(`  ${rounds} rounds: ${accepted} shares saved before the delete and revoked by it, ${refused} refused after it`);
    return p;
  },
  async 'rollback-share'() {
    const { bookId, fragment } = await scene(); const p = []; const before = await gateUrls();
    psql(`CREATE OR REPLACE FUNCTION n16_fail() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$ LANGUAGE plpgsql; CREATE TRIGGER n16_fail_share BEFORE INSERT ON shares FOR EACH ROW EXECUTE FUNCTION n16_fail();`);
    let res;
    try { res = await card('a', fragment, 'r1-rollback'); } finally { psql('DROP TRIGGER n16_fail_share ON shares'); }
    if (res.status !== 500) p.push(`share returned ${res.status}, expected 500`);
    if (rowsOnBook(bookId) !== 0) p.push('a row remains');
    await newImagesGone(before, p);
    const again = await card('a', fragment, 'r1-rollback-after');
    if (!t.ok(again)) p.push(`share after the failure returned ${again.status}`);
    return p;
  },
  async 'rollback-delete'() {
    const { bookId, fragment } = await scene(); const p = [];
    const share = await card('a', fragment, 'r1-rollback-del');
    if (!t.ok(share)) p.push(`share ${share.status}`);
    psql(`CREATE TRIGGER n16_fail_book BEFORE DELETE ON books FOR EACH ROW EXECUTE FUNCTION n16_fail();`);
    let del;
    try { del = await adminDelete(bookId); } finally { psql('DROP TRIGGER n16_fail_book ON books'); }
    if (del.status !== 500) p.push(`delete returned ${del.status}, expected 500`);
    if (psql(`SELECT count(*) FROM books WHERE id = '${bookId}'`) !== '1') p.push('the book is gone');
    if (liveOnBook(bookId) !== 1) p.push('the share was not left live');
    if (outboxFor(share.body.imageUrl)) p.push('an outbox row remains');
    if ((await imageStatus(share.body.imageUrl)) !== 200) p.push('the image was deleted');
    const retry = await adminDelete(bookId);
    if (retry.status !== 204) p.push(`retry returned ${retry.status}`);
    if (liveOnBook(bookId) !== 0) p.push('an active share survived the retry');
    return p;
  },
  // Slow: waits for the sweep.
  async storage() {
    const { bookId, fragment } = await scene(); const p = []; const before = await gateUrls();
    await gate('/hold');
    const req = card('a', fragment, 'r1-storage');
    await until(async () => (await gate('/state', 'GET')).waiting === 1, 'render held');
    const del = await adminDelete(bookId);
    if (del.status !== 204) p.push(`delete ${del.status}`);
    docker('pause', 'n16acc-storage-1');
    const started = Date.now();
    await gate('/release');
    let res;
    try { res = await req; } finally { /* resumed below */ }
    const tookMs = Date.now() - started;
    if (res.status !== 404) p.push(`share returned ${res.status}, expected 404`);
    if (tookMs > 8000) p.push(`refusal took ${tookMs} ms`);
    if (liveOnBook(bookId) !== 0) p.push('an active share survived');
    const [url] = (await gateUrls()).filter((u) => !before.includes(u));
    const row = psql(`SELECT attempts || '|' || "lastError" FROM card_image_deletions WHERE "key" = '${url.split('/').pop()}'`);
    if (!/^1\|StorageTimeoutError$/.test(row)) p.push(`outbox row: "${row}"`);
    console.log(`  refused in ${tookMs} ms; outbox ${row}`);
    docker('unpause', 'n16acc-storage-1');
    const gone = await until(() => psql('SELECT count(*) FROM card_image_deletions') === '0', 'outbox drained', 660_000);
    if (!gone) p.push('the outbox did not drain');
    if ((await imageStatus(url)) !== 404) p.push('image still public after the sweep');
    return p;
  },
};

async function runR1(mode) {
  await gate('/release');
  const names = mode === 'baseline' ? ['render', 'share-first', 'delete-first', 'double-delete', 'concurrent', 'stress'] : Object.keys(R1);
  for (const name of names) {
    let problems;
    try { problems = await R1[name](mode); } catch (err) {
      if (err instanceof GuardError) throw err;
      problems = [`harness could not finish: ${err.message}`];
      await gate('/release').catch(() => {});
    }
    const id = `X10.${name === 'render' ? 'render' : name}`;
    record(id, problems, 'held');
    if (mode === 'fix') setCheck(run.state, id, problems.length ? 'FAIL' : 'PASS', problems.join('; ') || 'Held on real Postgres');
    saveRun(run);
  }
}

const LIMITS = { quote: 17_000, render: 32_000, publish: 12_000 };

function assertInterrupted(how) {
  const state = how === 'pause' ? inspect('{{.State.Paused}}') === 'true' : inspect('{{.State.Status}}') === 'exited';
  if (!state) throw new GuardError('Storage is not interrupted; refusing the publish case, which could reach LinkedIn');
}

async function runR2(mode, how) {
  const timeoutMs = 60_000; const out = {};
  const cold = await scene('a');
  const warm = await scene('a');
  const warmFirst = await card('a', warm.fragment, `r2-warm-${how}`);
  if (!t.ok(warmFirst)) throw new Error(`warm-up share returned ${warmFirst.status}`);
  const rowsBefore = Number(psql('SELECT count(*) FROM shares'));

  docker(how, 'n16acc-storage-1');
  const token = await t.login('a');
  const q = await client.request('POST', `/fragments/${cold.fragment}/share`, { token, timeoutMs, json: { platform: 'linkedin', text: POSITIVE.Q1.text, citation: `r2-cold-${how}` } });
  out.quote = { status: q.status || q.netError, error: q.body?.error, ms: q.ms };
  const r = await client.request('POST', `/fragments/${warm.fragment}/share`, { token, timeoutMs, json: { platform: 'linkedin', text: POSITIVE.Q1.text, citation: `r2-render-${how}` } });
  out.render = { status: r.status || r.netError, ms: r.ms };
  if (mode === 'fix') {
    assertInterrupted(how);
    const pub = await client.request('POST', '/social/linkedin/publish', { token, timeoutMs, json: { imageUrl: warmFirst.body.imageUrl } });
    out.publish = { status: pub.status || pub.netError, message: pub.body?.message, ms: pub.ms };
  }
  const rowsDuring = Number(psql('SELECT count(*) FROM shares'));
  if (how === 'pause') docker('unpause', 'n16acc-storage-1'); else docker('start', 'n16acc-storage-1');
  await until(async () => inspect('{{.State.Status}}') === 'running', 'storage running');
  await sleep(3000);
  const again = await card('a', cold.fragment, `r2-cold-after-${how}`);
  out.recovery = { status: again.status };
  console.log(`  ${how}: ${JSON.stringify(out)}`);
  if (mode === 'baseline') return out;

  const p = (cond, msg) => (cond ? [] : [msg]);
  const set = (id, problems, ok) => {
    const prev = run.state.results[id];
    const fail = problems.length > 0 || prev?.status === 'FAIL';
    setCheck(run.state, id, fail ? 'FAIL' : 'PASS', [prev?.detail, problems.join('; ') || ok].filter(Boolean).join(' | '));
    record(`${id} (${how})`, problems, ok);
  };
  set('X11.quote', [...p(q.status === 503 && q.body?.error === 'quote_source_unavailable', `got ${q.status || q.netError} ${q.body?.error ?? ''}`), ...p(q.ms <= LIMITS.quote, `took ${q.ms} ms`)], `${how}: 503 in ${q.ms} ms`);
  set('X11.render', [...p(r.status === 502, `got ${r.status || r.netError}`), ...p(r.ms <= LIMITS.render, `took ${r.ms} ms`), ...p(rowsDuring === rowsBefore, `${rowsDuring - rowsBefore} row(s) saved during the outage`)], `${how}: 502 in ${r.ms} ms`);
  set('X11.publish', [...p(out.publish.status === 502 && out.publish.message === 'image_download_failed', `got ${out.publish.status} ${out.publish.message ?? ''}`), ...p(out.publish.ms <= LIMITS.publish, `took ${out.publish.ms} ms`)], `${how}: 502 in ${out.publish.ms} ms`);
  set('X11.recovery', p(t.ok(again), `share after recovery returned ${again.status}`), `${how}: share works again`);
  saveRun(run);
  return out;
}

/** Not changed by this work: records what POST /books does on a stalled store. */
async function uploadBaseline(how) {
  const form = new FormData();
  form.set('title', 'Cuaderno de subida (medición)');
  form.set('author', 'Local');
  form.set('language', 'es');
  form.set('category', 'classic');
  form.set('textFile', new Blob(['texto']), 'x.txt');
  const token = await t.login('adm');
  docker(how, 'n16acc-storage-1');
  const res = await client.request('POST', '/books', { token, form, fixtureUpload: true, timeoutMs: 45_000 });
  if (how === 'pause') docker('unpause', 'n16acc-storage-1'); else docker('start', 'n16acc-storage-1');
  console.log(`UPLOAD ${how}: ${res.status || res.netError} after ${res.ms} ms (client limit 45000)`);
}

/** The share and delete paths, timed with normal storage. */
async function perf(label) {
  const pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))];
  const book = await scene('r');
  await card('r', book.fragment, 'perf-warm');
  const share = []; const del = [];
  for (let i = 0; i < 15; i++) {
    const res = await t.share('r', book.fragment, { text: POSITIVE.Q1.text, citation: `perf-${label}-${i}` });
    if (t.ok(res)) share.push(res.ms);
  }
  for (let i = 0; i < 8; i++) {
    const b = await uploadDisposable(t);
    const res = await adminDelete(b);
    if (res.status === 204) del.push(res.ms);
  }
  if (!share.length || !del.length) throw new Error('perf: no successful samples');
  console.log(`PERF ${label}: share p50=${pct(share, 0.5)} p95=${pct(share, 0.95)} ms (n=${share.length}); delete book p50=${pct(del, 0.5)} p95=${pct(del, 0.95)} ms (n=${del.length})`);
}

const [cmd, a, b] = process.argv.slice(2);
try {
  if (cmd === 'r1') await runR1(a);
  else if (cmd === 'r2') await runR2(a, b);
  else if (cmd === 'perf') await perf(a);
  else if (cmd === 'upload') await uploadBaseline(a);
  else throw new Error('usage: r1|r2|perf');
  saveRun(run);
} catch (err) {
  console.error(err instanceof GuardError ? `REFUSED: ${err.message}` : `ERROR: ${err.message}`);
  process.exitCode = err instanceof GuardError ? 3 : 1;
}
const failed = results.filter((r) => !r.pass).map((r) => r.id);
console.log(`DRIVER ${cmd} ${a ?? ''} ${b ?? ''}: ${results.length - failed.length} held, ${failed.length} failed${failed.length ? `: ${failed.join(', ')}` : ''}`);
