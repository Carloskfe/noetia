#!/usr/bin/env node
// NEM-016 acceptance harness. See README.md. `plan`, `coverage`, `template` and
// the SQL generators make no network calls.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiClient } from './lib/client.mjs';
import { FIXTURE_AUTHOR, FIXTURE_FILE, FIXTURE_TITLE } from './lib/cases.mjs';
import { adminSql, evaluateEvidence, evidenceSql, parseEvidence } from './lib/evidence.mjs';
import { assertAdminSqlAllowed, assertTestEmail, derivePassword, GuardError, readSecretSeed, resolveTarget, writeSecretSeed } from './lib/guard.mjs';
import { allChecks, MATRIX } from './lib/matrix.mjs';
import { renderCoverage, renderReport } from './lib/report.mjs';
import { accountEmail, Ctx, runTests } from './lib/runner.mjs';
import { verifyStagingFixture } from './lib/setup.mjs';
import { loadRun, mergeManual, saveRun, setCheck } from './lib/state.mjs';

const ROLES = ['a', 'b', 'r', 'd', 'x', 'y', 'adm'];
export const FIXTURE_SHA256 = 'f52b4357a79ee38b358c4a9eb2dc51edb537a409bb601b6a01bce6968312049f';
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const args = { cmd, _: [], approve: new Set() };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--approve') for (const id of (rest[++i] ?? '').split(',')) args.approve.add(id.trim());
    else if (a === '--only') args.only = new Set((rest[++i] ?? '').split(','));
    else if (a === '--phase') args.phase = rest[++i];
    else if (a === '--label') args.label = rest[++i];
    else if (a === '--manual') args.manual = rest[++i];
    else if (a === '--out') args.out = rest[++i];
    else if (a === '--grant') args.grant = true;
    else if (a === '--revoke') args.revoke = true;
    else if (a === '--execute') args.execute = true;
    else if (a.startsWith('--')) throw new GuardError(`Unknown option ${a}`);
    else args._.push(a);
  }
  return args;
}

function context(args, run) {
  const target = resolveTarget();
  const client = new ApiClient(target);
  const seed = readSecretSeed(process.env.NEM016_SECRET_FILE);
  const ctx = new Ctx({ client, state: run.state, seed, approved: args.approve, phase: args.phase, log: (m) => console.log(m) });
  ctx.startedAt = new Date().toISOString();
  ctx.onProgress = () => saveRun(run);
  return { target, client, seed, ctx };
}

async function setupAccounts(args, run) {
  const { target, client, seed } = context(args, run);
  // Staging already has its administrator; the harness never creates another.
  for (const role of ROLES.filter((r) => r !== 'adm' || target.name !== 'staging')) {
    const email = accountEmail(run.state.runId, role);
    assertTestEmail(email);
    const password = derivePassword(seed, run.state.runId, role);
    let res = await client.request('POST', '/auth/register', { json: { name: `NEM-016 test ${role}`, email, password } });
    if (res.status === 409) res = await client.request('POST', '/auth/login', { json: { email, password } });
    if (![200, 201].includes(res.status)) throw new Error(`Account ${role}: returned ${res.status}`);
    run.state.users[role] = { id: res.body.user.id, email };
    saveRun(run);
    console.log(`account ${role}: ${email}`);
  }
  if (target.name !== 'staging') console.log('\nThe local fixture needs an admin grant. Generate the SQL with: acceptance.mjs admin-sql --grant');
}

async function setupFixture(args, run) {
  const { target, client, ctx } = context(args, run);
  if (target.name === 'staging') {
    run.state.book = await verifyStagingFixture(client);
    saveRun(run);
    console.log(`Using the existing staging fixture ${run.state.book.id}. Nothing was created or changed.`);
    return;
  }
  const reuse = process.env.NEM016_FIXTURE_BOOK_ID;
  if (reuse) {
    // GET /books/:id needs a subscription for a non-free book, so read the public list.
    const res = await client.request('GET', `/books?search=${encodeURIComponent('Cuaderno de pruebas de citas')}`);
    const found = Array.isArray(res.body) ? res.body.find((b) => b.id === reuse && b.title === FIXTURE_TITLE) : null;
    if (!found) throw new Error('NEM016_FIXTURE_BOOK_ID is not the fixture book');
    run.state.book = { id: reuse, textFileKey: found.textFileKey ?? null, reused: true };
    saveRun(run);
    console.log(`Reusing fixture ${reuse}`);
    return;
  }
  if (run.state.book) { console.log(`Fixture already recorded: ${run.state.book.id}`); return; }
  const bytes = readFileSync(join(repoRoot, FIXTURE_FILE));
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== FIXTURE_SHA256) throw new GuardError(`Fixture text changed (sha256 ${sha}); only the approved text may be uploaded`);
  const token = await ctx.login('adm');
  const me = await client.request('GET', '/users/me', { token });
  if (!me.body?.isAdmin) throw new Error('The admin account has no grant yet; run the admin-sql --grant output first');
  const listed = await client.request('GET', `/books?search=${encodeURIComponent('Cuaderno de pruebas de citas')}`);
  if (Array.isArray(listed.body) && listed.body.length) {
    throw new Error(`A fixture book already exists (${listed.body[0].id}). Set NEM016_FIXTURE_BOOK_ID to reuse it.`);
  }
  const form = new FormData();
  form.set('title', FIXTURE_TITLE);
  form.set('author', FIXTURE_AUTHOR);
  form.set('language', 'es');
  form.set('category', 'classic');
  form.set('textFile', new Blob([bytes], { type: 'text/plain' }), 'nem-016-quote-fixture.txt');
  const res = await client.request('POST', '/books', { token, form, fixtureUpload: true });
  if (res.status !== 201) throw new Error(`Fixture upload returned ${res.status}`);
  if (!res.body.isPublished || !res.body.uploadedById) throw new Error('Fixture was not published with an uploader');
  run.state.book = { id: res.body.id, textFileKey: res.body.textFileKey ?? null };
  client.fixtureBookId = res.body.id;
  saveRun(run);
  console.log(`Fixture uploaded: ${res.body.id}\nRevoke the admin grant now: acceptance.mjs admin-sql --revoke`);
}

async function cleanup(args, run) {
  const { state } = run;
  const liveShares = Object.entries(state.shares);
  const plan = [
    `Revoke ${liveShares.length} recorded share(s)`,
    state.book?.reused ? `Keep the existing fixture ${state.book.id}` : state.book && !state.book.deleted ? `Delete fixture book ${state.book.id} (needs the temporary admin grant; otherwise the book and admin account stay)` : 'No fixture book to delete',
    `Delete synthetic accounts: ${Object.entries(state.users).filter(([, u]) => !u.deleted).map(([r]) => r).join(', ') || 'none'}`,
  ];
  console.log(plan.map((p, i) => `${i + 1}. ${p}`).join('\n'));
  if (!args.execute) { console.log('\nDry run: nothing changed. Use --execute after the clean-up policy is approved.'); return; }
  const { target, client, ctx } = context(args, run);
  if (target.name === 'staging' && !args.approve.has('cleanup')) throw new GuardError('Staging clean-up needs --approve cleanup');
  const notes = [];
  const tokenOf = async (role) => { try { return await ctx.login(role); } catch { return null; } };

  let revoked = 0;
  for (const [name, s] of liveShares) {
    if (state.users[s.owner]?.deleted) continue;
    const token = await tokenOf(s.owner);
    if (!token) { notes.push(`share ${name}: no login`); continue; }
    const res = await client.request('DELETE', `/shares/${s.id}`, { token });
    if (res.status === 204) revoked++; else notes.push(`share ${name}: revoke returned ${res.status}`);
  }

  let adminUsable = false;
  if (state.book && !state.book.deleted && !state.book.reused) {
    const token = await tokenOf('adm');
    const me = token ? await client.request('GET', '/users/me', { token }) : null;
    if (me?.body?.isAdmin) {
      const del = await client.request('DELETE', `/books/${state.book.id}`, { token });
      if (del.status === 204) { state.book.deleted = true; adminUsable = true; } else notes.push(`fixture delete returned ${del.status}`);
    } else notes.push('fixture kept: no admin grant');
  } else adminUsable = true;
  saveRun(run);

  // Deleting the uploader nulls books.uploadedById, which would silently make a
  // retained fixture ineligible, so the admin account goes only with the book.
  for (const [role, u] of Object.entries(state.users)) {
    if (u.deleted) continue;
    if (role === 'adm' && !adminUsable) { notes.push('admin account kept with the fixture'); continue; }
    const token = await tokenOf(role);
    if (!token) { notes.push(`account ${role}: no login`); continue; }
    const res = await client.request('DELETE', '/users/me', { token });
    if (res.status === 204) u.deleted = true; else notes.push(`account ${role}: delete returned ${res.status}`);
  }
  state.cleanup = { summary: `Revoked ${revoked} share(s). ${notes.length ? notes.join('; ') : 'No exceptions.'}`, at: new Date().toISOString(), textFileKey: state.book?.textFileKey ?? null };
  saveRun(run);
  console.log(state.cleanup.summary);
  console.log('Left behind by design: the fixture text object in the books bucket, A19 shareCount +1, rate-limit keys until expiry.');
  console.log('Verify with: acceptance.mjs evidence-sql --label post-cleanup');
}

function plan() {
  console.log('Test  Approval  Data                 Checks (api/db/operator/manual)  Area');
  for (const t of MATRIX) {
    const n = (k) => t.checks.filter((c) => c.kind === k).length;
    console.log(`${t.id.padEnd(5)} ${(t.approval ? 'PO' : '-').padEnd(9)} ${t.data.join(',').padEnd(20)} ${`${n('api')}/${n('db')}/${n('operator')}/${n('manual')}`.padEnd(32)} ${t.area}`);
    if (t.note) console.log(`      note: ${t.note}`);
  }
}

function manualTemplate() {
  const entries = {};
  for (const c of allChecks()) if (c.kind === 'manual' || c.kind === 'operator') entries[c.id] = { status: 'NOT RUN', evidence: '', expected: c.desc };
  return `${JSON.stringify(entries, null, 2)}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = process.env.NEM016_RUN_ID;
  switch (args.cmd) {
    case 'plan': return plan();
    case 'coverage': return process.stdout.write(renderCoverage());
    case 'template': return process.stdout.write(renderReport({ template: true }));
    case 'manual-template': return process.stdout.write(manualTemplate());
    case 'new-run-id': return console.log(randomBytes(6).toString('hex'));
    case 'init-secret': writeSecretSeed(args._[0]); return console.log(`Created ${args._[0]} (mode 600). The value was not printed.`);
  }
  const run = loadRun(runId);
  switch (args.cmd) {
    case 'preflight': {
      const { client } = context(args, run);
      const health = await client.request('GET', '/health');
      const books = await client.request('GET', '/books?includeCollections=true');
      console.log(`health: ${health.status}; listed books: ${Array.isArray(books.body) ? books.body.length : 'unknown'}`);
      return;
    }
    case 'setup-accounts': await setupAccounts(args, run); return;
    case 'setup-fixture': await setupFixture(args, run); return;
    case 'run': {
      const { ctx } = context(args, run);
      if (args.phase && !['prepare', 'paused', 'after', 'stalled'].includes(args.phase)) throw new GuardError(`Unknown phase ${args.phase}`);
      await runTests(ctx, args.only ?? null);
      evaluateEvidence(run.state);
      saveRun(run);
      return;
    }
    case 'evidence-sql': return process.stdout.write(evidenceSql(run.state, args.label ?? 'final'));
    case 'ingest-evidence': {
      const snap = parseEvidence(readFileSync(args._[0], 'utf8'));
      run.state.snapshots[snap.nem016] = snap;
      evaluateEvidence(run.state);
      saveRun(run);
      return console.log(`Ingested snapshot: ${snap.nem016}`);
    }
    case 'admin-sql': {
      assertAdminSqlAllowed();
      if (!!args.grant === !!args.revoke) throw new GuardError('Use exactly one of --grant or --revoke');
      const email = accountEmail(run.state.runId, 'adm');
      assertTestEmail(email);
      return process.stdout.write(adminSql(email, !!args.grant));
    }
    case 'set-status': {
      // Operator or manual result only; automated checks can't be set by hand.
      const [id, status, ...why] = args._;
      mergeManual(run.state, { [id]: { status, evidence: why.join(' ') } });
      saveRun(run);
      return;
    }
    case 'set-local': {
      // For the local validation scripts only; refused for any other target.
      const [id, status, ...why] = args._;
      if (process.env.NEM016_TARGET !== 'local') throw new GuardError('set-local is for the local stack only');
      if (allChecks().find((c) => c.id === id)?.kind !== 'local') throw new GuardError(`${id} is not a local check`);
      setCheck(run.state, id, status, why.join(' '));
      saveRun(run);
      return;
    }
    case 'merge-manual': {
      mergeManual(run.state, JSON.parse(readFileSync(args._[0], 'utf8')));
      saveRun(run);
      return;
    }
    case 'report': {
      const body = renderReport({ state: run.state, meta: { target: process.env.NEM016_TARGET, sha: process.env.NEM016_DEPLOYED_SHA, generated: new Date().toISOString(), approved: [...args.approve].join(', ') || 'none' } });
      const out = args.out ?? join(run.dir, 'acceptance-report.md');
      writeFileSync(out, body, { mode: 0o600 });
      return console.log(`Wrote ${out}`);
    }
    case 'cleanup': await cleanup(args, run); return;
    default:
      console.error('Commands: plan, coverage, template, manual-template, new-run-id, init-secret <path>, preflight, setup-accounts, setup-fixture, run, evidence-sql, ingest-evidence <file>, admin-sql, set-status, merge-manual <file>, report, cleanup');
      process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof GuardError ? `REFUSED: ${err.message}` : `ERROR: ${err.message}`);
    process.exitCode = err instanceof GuardError ? 3 : 1;
  });
}
