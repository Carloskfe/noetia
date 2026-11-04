// Automated acceptance checks. Expected values come from the NEM-016 matrix and
// were confirmed against the implementation (sharing.*, quote-integrity.*).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GuardError, STAGING, assertTestEmail, derivePassword } from './guard.mjs';
import { DISPOSABLE_TITLE, FIXTURE_AUTHOR, FIXTURE_FILE, NEGATIVE, POSITIVE, SOURCE_SENTENCE, TINY_PNG_DATA_URI, UNSAFE_BACKGROUNDS } from './cases.mjs';
import { findTest, MATRIX } from './matrix.mjs';
import { setCheck } from './state.mjs';

const TOKEN_MAX_AGE_MS = 10 * 60_000; // access tokens live 15 minutes
const WINDOW_S = 600; // SHARE_CREATE_LIMIT window
const SHARE_URL_RE = /\/s\/([A-Za-z0-9]{1,16})$/;
const NEEDS_FIXTURE = new Set(['A1','A2','A3','A4','A5','A6','A7','A8b','A9','A10','A11','A12','A14b','A15','X1','X2','X3','X4','X5','X8','X9']);
const BOUND_MS_DEFAULT = 8_000; // 5 s storage deadline plus request overhead

export const accountEmail = (runId, role) => `nem016-${runId}-${role}@staging.invalid`;

export class Ctx {
  constructor({ client, state, seed, env = process.env, approved = new Set(), phase = null, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} }) {
    Object.assign(this, { client, state, seed, env, approved, phase, sleep, log, tokens: new Map() });
    client.deletableBookIds = [state.book, ...(state.disposableBooks ?? [])].filter((b) => b && !b.reused).map((b) => b.id);
  }

  pass(id, detail = '') { setCheck(this.state, id, 'PASS', detail); }
  fail(id, detail) { setCheck(this.state, id, 'FAIL', detail); }
  verdict(id, problems, okDetail = '') {
    if (problems.length) this.fail(id, problems.join('; ')); else this.pass(id, okDetail);
  }

  async login(role, { force = false } = {}) {
    const cached = this.tokens.get(role);
    if (cached && !force && Date.now() - cached.at < TOKEN_MAX_AGE_MS) return cached.token;
    if (role === 'adm' && this.client.target.name === 'staging') throw new GuardError('The harness never logs in as the staging administrator');
    const email = accountEmail(this.state.runId, role);
    assertTestEmail(email);
    const res = await this.client.request('POST', '/auth/login', { json: { email, password: derivePassword(this.seed, this.state.runId, role) } });
    if (res.status !== 200 || !res.body?.accessToken) throw new Error(`login for role ${role} returned ${res.status}`);
    this.tokens.set(role, { token: res.body.accessToken, at: Date.now() });
    return res.body.accessToken;
  }

  async fragment(key, role, bookId, text) {
    const known = this.state.fragments[key];
    if (known) return known.id;
    const res = await this.client.request('POST', '/fragments', { token: await this.login(role), json: { bookId, text } });
    if (res.status !== 201) throw new Error(`fragment ${key} returned ${res.status}`);
    this.state.fragments[key] = { id: res.body.id, owner: role, bookId };
    return res.body.id;
  }

  async share(role, fragmentId, body, { name, expect } = {}) {
    const res = await this.client.request('POST', `/fragments/${fragmentId}/share`, { token: await this.login(role), json: { platform: 'linkedin', ...body } });
    const m = res.status === 200 || res.status === 201 ? SHARE_URL_RE.exec(res.body?.url ?? '') : null;
    if (m) {
      res.shareId = m[1];
      if (name) this.state.shares[name] = { id: m[1], imageUrl: res.body.imageUrl, owner: role, fragmentId, ...expect };
    }
    return res;
  }

  publicShare(id) { return this.client.request('GET', `/shares/${id}`); }

  async expectGone(name, problems) {
    const s = this.state.shares[name];
    const page = await this.publicShare(s.id);
    if (page.status !== 404) problems.push(`${name}: share page returned ${page.status}`);
    const img = await this.client.image(s.imageUrl);
    if (img.status !== 404) problems.push(`${name}: image returned ${img.status}`);
  }

  ok(res) { return res.status === 200 || res.status === 201; }
}

const fragA = (t) => t.fragment('fA', 'a', t.state.book.id, SOURCE_SENTENCE);
// Supplemental cards use their own account so they don't consume A's 20-card budget.
const fragX = (t) => t.fragment('fX', 'x', t.state.book.id, SOURCE_SENTENCE);

const T = {
  async A1(t) {
    const fA = await fragA(t);
    const res = await t.share('b', fA, { text: POSITIVE.Q1.text });
    t.verdict('A1.api', res.status === 404 ? [] : [`expected 404, got ${res.status}`], '404');
  },

  async A2(t) {
    const fA = await fragA(t); const problems = [];
    for (const q of ['Q1', 'Q2', 'Q3']) {
      const res = await t.share('a', fA, { text: POSITIVE[q].text }, { name: q, expect: { source: 'text_file', spans: POSITIVE[q].spans } });
      if (!t.ok(res) || !res.shareId) { problems.push(`${q}: returned ${res.status} ${res.body?.reason ?? ''}`.trim()); continue; }
      const img = await t.client.image(res.body.imageUrl);
      if (img.status !== 200 || !img.png) problems.push(`${q}: image returned ${img.status}, png=${img.png}`);
      const page = await t.publicShare(res.shareId);
      if (page.status !== 200 || page.body?.quote !== POSITIVE[q].text) problems.push(`${q}: snapshot mismatch (page ${page.status})`);
    }
    t.verdict('A2.api', problems, 'Q1–Q3 accepted; PNG and snapshot verified');
  },

  async A3(t) { await negatives(t, 'A3.api', ['N1', 'N2', 'N3']); },

  async A4(t) {
    const fA = await fragA(t); const problems = [];
    const r4 = await t.share('a', fA, { text: POSITIVE.Q4.text }, { name: 'Q4', expect: { source: 'text_file', spans: 2 } });
    const r5 = await t.share('a', fA, { text: POSITIVE.Q5.text });
    const r6 = await t.share('a', fA, { text: POSITIVE.Q6.text }, { name: 'Q6', expect: { source: 'text_file', spans: 2 } });
    for (const [q, r] of [['Q4', r4], ['Q5', r5], ['Q6', r6]]) if (!t.ok(r)) problems.push(`${q}: returned ${r.status} ${r.body?.reason ?? ''}`.trim());
    if (t.ok(r4) && t.ok(r5)) {
      if (r4.body.url !== r5.body.url) problems.push('Q4 and Q5 gave different URLs');
      const page = await t.publicShare(r5.shareId);
      if (!page.body?.quote?.includes('[…]') || page.body.quote.includes('[...]')) problems.push('Q5 is not stored with the […] marker');
    }
    t.verdict('A4.api', problems, 'Q4–Q6 accepted; Q5 canonicalized and de-duplicated with Q4');
  },

  async A5(t) { await negatives(t, 'A5.api', ['N4', 'N5', 'N6', 'N7', 'N8', 'N9']); },

  async A6(t) {
    const fA = await fragA(t); const problems = [];
    const preset = t.env.NEM016_PRESET_BG_URL ?? (t.client.target.name === 'staging' ? 'https://noetia.app/backgrounds/imagen-7.jpg' : null);
    if (!preset) throw new Error('NEM016_PRESET_BG_URL is required for the local target');
    for (const [name, bgImage] of [['A6-data', TINY_PNG_DATA_URI], ['A6-preset', preset]]) {
      const res = await t.share('a', fA, { text: POSITIVE.Q1.text, bgType: 'image', bgImage }, { name });
      if (!t.ok(res)) { problems.push(`${name}: returned ${res.status} ${res.body?.error ?? ''}`.trim()); continue; }
      const img = await t.client.image(res.body.imageUrl);
      if (img.status !== 200 || !img.png) problems.push(`${name}: image returned ${img.status}`);
    }
    t.verdict('A6.api', problems, 'data URI and preset accepted');
  },

  async A7(t) {
    const fA = await fragA(t); const problems = [];
    for (const bgImage of UNSAFE_BACKGROUNDS) {
      const res = await t.share('a', fA, { text: POSITIVE.Q1.text, bgType: 'image', bgImage });
      if (res.status !== 400 || res.body?.error !== 'unsupported_background_image') problems.push(`${bgImage.slice(0, 40)}: ${res.status} ${res.body?.error ?? ''}`.trim());
    }
    t.verdict('A7.api', problems, `${UNSAFE_BACKGROUNDS.length}/${UNSAFE_BACKGROUNDS.length} refused`);
  },

  async A8(t) {
    const res = await t.client.request('POST', '/social/linkedin/publish', { token: await t.login('a'), json: { imageUrl: 'https://example.invalid/x.png' } });
    const msg = JSON.stringify(res.body ?? {});
    t.verdict('A8.api', res.status === 401 && msg.includes('account_not_connected') ? [] : [`got ${res.status} ${msg.slice(0, 80)}`], '401 account_not_connected');
  },

  async A8b(t) {
    if (t.env.NEM016_A8B_TOKEN_SEEDED !== '1') return setCheck(t.state, 'A8b.api', 'BLOCKED', 'Fake LinkedIn token not seeded for account A (NEM016_A8B_TOKEN_SEEDED=1)');
    const fA = await fragA(t); const problems = [];
    const fB = await t.fragment('fB', 'b', t.state.book.id, SOURCE_SENTENCE);
    const bCard = await t.share('b', fB, { text: POSITIVE.Q1.text }, { name: 'a8b-b' });
    const gone = await t.share('a', fA, { text: POSITIVE.Q1.text, citation: 'a8b' }, { name: 'a8b-revoked' });
    if (!t.ok(bCard) || !t.ok(gone)) return t.fail('A8b.api', `setup cards returned ${bCard.status}/${gone.status}`);
    const del = await t.client.request('DELETE', `/shares/${gone.shareId}`, { token: await t.login('a') });
    if (del.status !== 204) return t.fail('A8b.api', `revoke returned ${del.status}`);
    const uuid = '00000000-0000-4000-8000-000000000000';
    const cases = [
      [`https://example.invalid/images/${uuid}.png`, 400, 'untrusted_image_source'],
      [`http://storage:9000/images/${uuid}.png`, 400, 'untrusted_image_source'],
      [bCard.body.imageUrl, 404, 'share_not_found'],
      [gone.body.imageUrl, 404, 'share_not_found'],
    ];
    // Safety: A's own live card is the one path that would call LinkedIn.
    const ownLive = Object.values(t.state.shares).filter((s) => s.owner === 'a' && s !== t.state.shares['a8b-revoked']).map((s) => s.imageUrl);
    for (const [imageUrl, status, code] of cases) {
      if (ownLive.includes(imageUrl)) throw new GuardError("A8b must never publish the caller's own live card");
      const res = await t.client.request('POST', '/social/linkedin/publish', { token: await t.login('a'), json: { imageUrl } });
      const msg = JSON.stringify(res.body ?? {});
      if (res.status !== status || !msg.includes(code)) problems.push(`expected ${status} ${code}, got ${res.status}`);
    }
    t.verdict('A8b.api', problems, '4/4 refused before any publisher call');
  },

  async A9(t) {
    const fA = await fragA(t); const problems = [];
    const body = { text: POSITIVE.Q1.text, textAlign: 'right' };
    const first = await t.share('a', fA, body, { name: 'a9' });
    const second = await t.share('a', fA, body);
    const third = await t.share('a', fA, body);
    if (![first, second, third].every((r) => t.ok(r))) problems.push(`statuses ${first.status}/${second.status}/${third.status}`);
    else if (new Set([first.body.url, second.body.url, third.body.url]).size !== 1) problems.push('URLs differ');
    t.verdict('A9.api', problems, 'one URL');
  },

  async A10(t) {
    const fA = await fragA(t); const problems = [];
    const res = await t.share('a', fA, { text: POSITIVE.Q1.text, textBold: true }, { name: 'a10' });
    if (!t.ok(res)) return t.fail('A10.api', `share returned ${res.status}`);
    const b = await t.client.request('DELETE', `/shares/${res.shareId}`, { token: await t.login('b') });
    if (b.status !== 404) problems.push(`B's revoke returned ${b.status}`);
    const still = await t.publicShare(res.shareId);
    if (still.status !== 200) problems.push(`share not live after B's attempt: ${still.status}`);
    const a = await t.client.request('DELETE', `/shares/${res.shareId}`, { token: await t.login('a') });
    if (a.status !== 204) problems.push(`A's revoke returned ${a.status}`);
    await t.expectGone('a10', problems);
    t.verdict('A10.api', problems, 'B refused; A revoked; page and image 404');
  },

  async A11(t) {
    const phase = t.phase;
    if (!['prepare', 'paused', 'after'].includes(phase)) {
      return setCheck(t.state, 'A11.prepare', 'BLOCKED', 'Operator-driven: run with --phase prepare, then paused, then after');
    }
    if (phase === 'prepare') {
      const fA = await fragA(t);
      const res = await t.share('a', fA, { text: POSITIVE.Q1.text, textItalic: true, textAlign: 'left' }, { name: 'a11' });
      return t.verdict('A11.prepare', t.ok(res) ? [] : [`share returned ${res.status}`], res.shareId ?? '');
    }
    const s = t.state.shares.a11;
    if (!s) return setCheck(t.state, 'A11.paused', 'BLOCKED', 'Run --phase prepare first');
    if (phase === 'paused') {
      const problems = [];
      const timeoutMs = Number(t.env.NEM016_A11_TIMEOUT_MS ?? 180_000);
      const del = await t.client.request('DELETE', `/shares/${s.id}`, { token: await t.login('a'), timeoutMs });
      t.state.a11.revokeMs = del.ms;
      if (del.status !== 204) problems.push(`revoke returned ${del.status || del.netError} after ${del.ms} ms`);
      const page = await t.publicShare(s.id);
      if (page.status !== 404) problems.push(`share page returned ${page.status}`);
      return t.verdict('A11.paused', problems, `revoke took ${del.ms} ms; share 404`);
    }
    const img = await t.client.image(s.imageUrl);
    t.verdict('A11.after', img.status === 404 ? [] : [`image returned ${img.status}`], 'image 404');
  },

  async A12(t) {
    const problems = []; const book = t.state.book.id;
    const f = await t.fragment('fDel', 'a', book, SOURCE_SENTENCE);
    const one = await t.share('a', f, { text: POSITIVE.Q1.text }, { name: 'a12-1' });
    const two = await t.share('a', f, { text: POSITIVE.Q3.text }, { name: 'a12-2' });
    if (!t.ok(one) || !t.ok(two)) {
      t.fail('A12.fragment', `setup shares returned ${one.status}/${two.status}`);
    } else {
      const del = await t.client.request('DELETE', `/fragments/${f}`, { token: await t.login('a') });
      if (del.status !== 204) problems.push(`delete returned ${del.status}`);
      await t.expectGone('a12-1', problems);
      await t.expectGone('a12-2', problems);
      t.verdict('A12.fragment', problems, 'shares and images 404');
    }

    const acc = [];
    const fD = await t.fragment('fD', 'd', book, SOURCE_SENTENCE);
    const d = await t.share('d', fD, { text: POSITIVE.Q1.text }, { name: 'a12-d' });
    if (!t.ok(d)) return t.fail('A12.account', `setup share returned ${d.status}`);
    const del = await t.client.request('DELETE', '/users/me', { token: await t.login('d') });
    if (del.status !== 204) acc.push(`delete returned ${del.status}`);
    else t.state.users.d.deleted = true;
    await t.expectGone('a12-d', acc);
    const relogin = await t.client.request('POST', '/auth/login', { json: { email: accountEmail(t.state.runId, 'd'), password: derivePassword(t.seed, t.state.runId, 'd') } });
    if (relogin.status !== 401) acc.push(`login after deletion returned ${relogin.status}`);
    t.verdict('A12.account', acc, 'account, share and image gone; login refused');
  },

  async A14(t) {
    const id = t.env.NEM016_INELIGIBLE_BOOK_ID;
    if (!id) return setCheck(t.state, 'A14.api', 'BLOCKED', 'No book below the gate supplied (NEM016_INELIGIBLE_BOOK_ID)');
    const f = await t.fragment('fI', 'a', id, 'NEM-016 test fragment');
    const res = await t.share('a', f, {});
    t.verdict('A14.api', res.status === 422 && res.body?.error === 'book_not_shareable' ? [] : [`got ${res.status} ${res.body?.error ?? ''}`.trim()], '422 book_not_shareable');
  },

  async A15(t) {
    const f = await t.fragment('fR', 'r', t.state.book.id, SOURCE_SENTENCE);
    const budget = Number(t.env.NEM016_A15_BUDGET_S ?? 240);
    const health = await t.client.request('GET', '/health');
    const serverNow = () => Math.floor(Date.parse(health.date ?? new Date().toUTCString()) / 1000);
    const remaining = WINDOW_S - (serverNow() % WINDOW_S);
    if (remaining < budget) { t.log(`A15: waiting ${remaining + 3}s for a fresh rate-limit window`); await t.sleep((remaining + 3) * 1000); }

    const problems = []; const windows = new Set();
    const body = (i) => ({ text: POSITIVE.Q1.text, textScale: Number((0.5 + i * 0.05).toFixed(2)) });
    let first = null;
    for (let i = 0; i < 20; i++) {
      const res = await t.share('r', f, body(i), { name: `a15-${i}` });
      if (res.date) windows.add(Math.floor(Date.parse(res.date) / 1000 / WINDOW_S));
      if (!t.ok(res)) problems.push(`card ${i + 1} returned ${res.status}`);
      if (i === 0) first = res;
    }
    const over = await t.share('r', f, body(20));
    if (over.date) windows.add(Math.floor(Date.parse(over.date) / 1000 / WINDOW_S));
    if (windows.size > 1) return setCheck(t.state, 'A15.api', 'NOT RUN', 'Inconclusive: the run crossed a rate-limit window; re-run with a fresh account');
    if (over.status !== 429 || over.body?.error !== 'rate_limited') problems.push(`card 21 returned ${over.status} ${over.body?.error ?? ''}`.trim());
    const again = await t.share('r', f, body(0));
    if (!t.ok(again) || again.body?.url !== first?.body?.url) problems.push(`repeat of card 1 returned ${again.status}`);
    t.verdict('A15.api', problems, '20 accepted; 21st limited; re-use not charged');
  },

  async A19(t) {
    const token = await t.login('a');
    const found = await seededExcerpt(t, token);
    if (!found) return setCheck(t.state, 'A19.api', 'BLOCKED', 'No eligible seeded book with sync-map phrases was found');
    const { bookId, excerpt, altered } = found; const problems = [];
    const f = await t.fragment('f19', 'a', bookId, excerpt);
    const good = await t.share('a', f, { text: excerpt }, { name: 'a19', expect: { source: 'sync_map' } });
    if (!t.ok(good)) problems.push(`excerpt returned ${good.status} ${good.body?.reason ?? good.body?.error ?? ''}`.trim());
    const bad = await t.share('a', f, { text: altered });
    if (bad.status !== 422 || bad.body?.error !== 'quote_not_in_source') problems.push(`changed word returned ${bad.status}`);
    t.state.a19 = { bookId };
    t.verdict('A19.api', problems, `book ${bookId}: excerpt accepted, changed word refused`);
  },

  async X1(t) {
    const fA = await fragA(t); const problems = [];
    const cases = { platform: { platform: 'myspace' }, bgType: { bgType: 'video' }, textColor: { textColor: 'red' }, textScale: { textScale: 9 }, text: { text: 'x'.repeat(2001) } };
    for (const [k, body] of Object.entries(cases)) {
      const res = await t.share('a', fA, body);
      if (res.status !== 400) problems.push(`${k}: returned ${res.status}`);
    }
    t.verdict('X1.api', problems, '5/5 refused with 400');
  },

  async X2(t) {
    const fA = await fragA(t); const problems = [];
    const share = await t.client.request('POST', `/fragments/${fA}/share`, { json: { platform: 'linkedin' } });
    if (share.status !== 401) problems.push(`share returned ${share.status}`);
    const del = await t.client.request('DELETE', '/shares/doesnotexist');
    if (del.status !== 401) problems.push(`revoke returned ${del.status}`);
    t.verdict('X2.api', problems, '401 on both');
  },

  async X3(t) {
    const fX = await fragX(t);
    const res = await t.share('x', fX, { text: POSITIVE.Q1.text, textAlign: 'center' }, { name: 'x3' });
    if (!t.ok(res)) return t.fail('X3.api', `share returned ${res.status}`);
    const page = await t.publicShare(res.shareId);
    const leaked = ['createdById', 'fragmentId', 'quoteProvenance', 'configHash', 'revokedAt', 'platform'].filter((k) => page.body && k in page.body);
    t.verdict('X3.api', page.status === 200 && leaked.length === 0 ? [] : [`status ${page.status}; exposed: ${leaked.join(',')}`], 'public page has no private fields');
  },

  async X4(t) {
    const fX = await fragX(t); const problems = [];
    const body = { text: POSITIVE.Q3.text, textItalic: true };
    const interval = t.client.minIntervalMs; t.client.minIntervalMs = 0;
    let all;
    try { all = await Promise.all([1, 2, 3].map((i) => t.share('x', fX, body, i === 1 ? { name: 'x4' } : {}))); } finally { t.client.minIntervalMs = interval; }
    if (!all.every((r) => t.ok(r))) problems.push(`statuses ${all.map((r) => r.status).join('/')}`);
    const urls = new Set(all.map((r) => r.body?.url));
    if (urls.size !== 1) problems.push(`${urls.size} distinct URLs`);
    t.verdict('X4.api', problems, 'one URL');
  },

  async X5(t) {
    const fX = await fragX(t); const problems = []; const token = await t.login('x');
    const body = { text: POSITIVE.Q3.text, textBold: true };
    const first = await t.share('x', fX, body, { name: 'x5-1' });
    if (!t.ok(first)) return t.fail('X5.api', `share returned ${first.status}`);
    for (const n of [1, 2]) {
      const del = await t.client.request('DELETE', `/shares/${first.shareId}`, { token });
      if (del.status !== 204) problems.push(`revoke ${n} returned ${del.status}`);
    }
    const second = await t.share('x', fX, body, { name: 'x5-2' });
    if (!t.ok(second) || second.body?.url === first.body.url) problems.push(`re-share returned ${second.status}, same URL=${second.body?.url === first.body.url}`);
    t.verdict('X5.api', problems, 'idempotent revoke; new URL after revocation');
  },

  async X8(t) {
    const local = t.client.target.name !== 'staging';
    if (t.env.NEM016_DEPLOYED_SHA === STAGING.preFixSha) return setCheck(t.state, 'X8.prepare', 'BLOCKED', 'The deployed commit predates the F1 correction');
    if (!local) setCheck(t.state, 'X8.book', 'BLOCKED', 'The harness never deletes books on staging');
    const bound = Number(t.env.NEM016_BOUND_MS ?? BOUND_MS_DEFAULT);
    const timeoutMs = Number(t.env.NEM016_STALL_TIMEOUT_MS ?? 60_000);
    if (!['prepare', 'stalled', 'after'].includes(t.phase)) {
      return setCheck(t.state, 'X8.prepare', 'BLOCKED', 'Operator-driven: run with --phase prepare, then stalled, then after');
    }
    const timed = (d, what) => (d.status === 204 && d.ms <= bound ? [] : [`${what}: ${d.status || d.netError} after ${d.ms} ms (limit ${bound})`]);

    if (t.phase === 'prepare') {
      const problems = []; const book = t.state.book.id;
      const fX = await t.fragment('fX8', 'x', book, SOURCE_SENTENCE);
      const fDel = await t.fragment('fX8del', 'x', book, SOURCE_SENTENCE);
      const fY = await t.fragment('fX8y', 'y', book, SOURCE_SENTENCE);
      const cards = [['x', fX, 'x8-rev'], ['x', fDel, 'x8-f1'], ['x', fDel, 'x8-f2'], ['y', fY, 'x8-a1'], ['y', fY, 'x8-a2']];
      if (local) {
        const adminBook = await uploadDisposable(t);
        t.state.x8Book = adminBook;
        const fB = await t.fragment('fX8b', 'x', adminBook, SOURCE_SENTENCE);
        cards.push(['x', fB, 'x8-b1'], ['x', fB, 'x8-b2']);
      }
      for (const [role, frag, name] of cards) {
        const res = await t.share(role, frag, { text: POSITIVE.Q1.text, citation: name }, { name });
        if (!t.ok(res)) problems.push(`${name}: returned ${res.status}`);
      }
      return t.verdict('X8.prepare', problems, `${cards.length} shares live`);
    }

    if (t.phase === 'stalled') {
      const sx = t.state.shares;
      if (!sx['x8-rev']) return setCheck(t.state, 'X8.revoke', 'BLOCKED', 'Run --phase prepare first');
      const pageGone = async (names, problems) => {
        for (const n of names) { const p = await t.publicShare(sx[n].id); if (p.status !== 404) problems.push(`${n}: page ${p.status}`); }
      };
      const tokenX = await t.login('x'); const tokenY = await t.login('y');
      const rev = await t.client.request('DELETE', `/shares/${sx['x8-rev'].id}`, { token: tokenX, timeoutMs });
      const revP = timed(rev, 'revoke'); await pageGone(['x8-rev'], revP);
      t.verdict('X8.revoke', revP, `204 after ${rev.ms} ms`);

      const again = await t.client.request('DELETE', `/shares/${sx['x8-rev'].id}`, { token: tokenX, timeoutMs });
      t.verdict('X8.repeat', timed(again, 'repeat revoke'), `204 after ${again.ms} ms`);

      const frag = await t.client.request('DELETE', `/fragments/${t.state.fragments.fX8del.id}`, { token: tokenX, timeoutMs });
      const fragP = timed(frag, 'fragment delete'); await pageGone(['x8-f1', 'x8-f2'], fragP);
      t.verdict('X8.fragment', fragP, `204 after ${frag.ms} ms`);

      const acc = await t.client.request('DELETE', '/users/me', { token: tokenY, timeoutMs });
      if (acc.status === 204) t.state.users.y.deleted = true;
      const accP = timed(acc, 'account delete'); await pageGone(['x8-a1', 'x8-a2'], accP);
      t.verdict('X8.account', accP, `204 after ${acc.ms} ms`);

      if (local) {
        const del = await t.client.request('DELETE', `/books/${t.state.x8Book}`, { token: await t.login('adm'), timeoutMs });
        const bookP = timed(del, 'book delete'); await pageGone(['x8-b1', 'x8-b2'], bookP);
        t.verdict('X8.book', bookP, `204 after ${del.ms} ms`);
      }
      return;
    }

    const problems = [];
    for (const [name, s] of Object.entries(t.state.shares)) {
      if (!name.startsWith('x8-')) continue;
      const img = await t.client.image(s.imageUrl);
      if (img.status !== 404) problems.push(`${name}: image ${img.status}`);
    }
    t.verdict('X8.recovered', problems, 'All affected images 404');
  },

  async X9(t) {
    if (t.client.target.name === 'staging') {
      setCheck(t.state, 'X9.api', 'BLOCKED', 'The harness never deletes books on staging; needs an approved disposable book');
      return;
    }
    const problems = []; const admin = await t.login('adm');
    const fKeep = await fragX(t);
    const keep = await t.share('x', fKeep, { text: POSITIVE.Q1.text, citation: 'x9-keep' }, { name: 'x9-keep' });
    if (!t.ok(keep)) return t.fail('X9.api', `share on the other book returned ${keep.status}`);

    const withShares = await uploadDisposable(t);
    const f = await t.fragment('fX9', 'x', withShares, SOURCE_SENTENCE);
    for (const name of ['x9-1', 'x9-2', 'x9-3']) {
      const res = await t.share('x', f, { text: POSITIVE.Q1.text, citation: name }, { name });
      if (!t.ok(res)) problems.push(`${name}: returned ${res.status}`);
    }
    // One already revoked share must not be queued or fail the delete.
    const pre = await t.client.request('DELETE', `/shares/${t.state.shares['x9-3'].id}`, { token: await t.login('x') });
    if (pre.status !== 204) problems.push(`pre-revoke returned ${pre.status}`);

    const del = await t.client.request('DELETE', `/books/${withShares}`, { token: admin });
    if (del.status !== 204) problems.push(`delete returned ${del.status}`);
    for (const n of ['x9-1', 'x9-2', 'x9-3']) await t.expectGone(n, problems);
    const repeat = await t.client.request('DELETE', `/books/${withShares}`, { token: admin });
    if (repeat.status !== 404) problems.push(`repeat delete returned ${repeat.status}`);

    const noShares = await uploadDisposable(t);
    const empty = await t.client.request('DELETE', `/books/${noShares}`, { token: admin });
    if (empty.status !== 204) problems.push(`no-share book delete returned ${empty.status}`);

    const live = await t.publicShare(keep.shareId);
    if (live.status !== 200) problems.push(`other book's share page returned ${live.status}`);
    const liveImg = await t.client.image(keep.body.imageUrl);
    if (liveImg.status !== 200) problems.push(`other book's image returned ${liveImg.status}`);
    t.verdict('X9.api', problems, 'Shares withdrawn with the book; repeat delete 404; other book untouched');
  },

  // Keep last: it deletes the fixture every other test depends on.
  async A14b(t) {
    if (t.client.target.name === 'staging') return setCheck(t.state, 'A14b.api', 'BLOCKED', 'The staging fixture must not be deleted');
    let admin;
    try {
      admin = await t.login('adm');
      const me = await t.client.request('GET', '/users/me', { token: admin });
      if (!me.body?.isAdmin) return setCheck(t.state, 'A14b.api', 'BLOCKED', 'The temporary admin grant is not in place');
    } catch (err) { return setCheck(t.state, 'A14b.api', 'BLOCKED', err.message); }
    const fX = await fragX(t); const problems = [];
    const res = await t.share('x', fX, { text: POSITIVE.Q1.text, citation: 'a14b' }, { name: 'a14b' });
    if (!t.ok(res)) return t.fail('A14b.api', `share returned ${res.status}`);
    const del = await t.client.request('DELETE', `/books/${t.state.book.id}`, { token: admin });
    if (del.status !== 204) problems.push(`delete returned ${del.status}`);
    else t.state.book.deleted = true;
    const page = await t.publicShare(res.shareId);
    if (page.status !== 404) problems.push(`share page returned ${page.status}`);
    const img = await t.client.image(res.body.imageUrl);
    if (img.status !== 404) problems.push(`card image returned ${img.status}`);
    t.verdict('A14b.api', problems, 'share page and image 404 after fixture deletion');
  },
};

/** Local only: a second copy of the approved text, so deleting it spares the fixture. */
export async function uploadDisposable(t) {
  const admin = await t.login('adm');
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  const form = new FormData();
  form.set('title', DISPOSABLE_TITLE);
  form.set('author', FIXTURE_AUTHOR);
  form.set('language', 'es');
  form.set('category', 'classic');
  form.set('textFile', new Blob([readFileSync(join(repoRoot, FIXTURE_FILE))], { type: 'text/plain' }), 'disposable.txt');
  const res = await t.client.request('POST', '/books', { token: admin, form, fixtureUpload: true });
  if (res.status !== 201) throw new Error(`disposable book upload returned ${res.status}`);
  (t.state.disposableBooks ??= []).push({ id: res.body.id });
  t.client.deletableBookIds.push(res.body.id);
  return res.body.id;
}

async function negatives(t, checkId, ids) {
  const fA = await fragA(t); const problems = [];
  for (const n of ids) {
    const res = await t.share('a', fA, { text: NEGATIVE[n].text });
    if (res.status !== 422 || res.body?.error !== 'quote_not_in_source' || res.body?.reason !== NEGATIVE[n].reason) {
      problems.push(`${n}: expected 422 ${NEGATIVE[n].reason}, got ${res.status} ${res.body?.reason ?? res.body?.error ?? ''}`.trim());
    }
  }
  t.verdict(checkId, problems, `${ids.length}/${ids.length} refused with the expected reason`);
}

const WORDY = /^[\p{L}\p{N} ,;.'’-]+$/u;

export function buildExcerpt(phrases) {
  const ok = (phrases ?? []).filter((p) => !p.exception && WORDY.test(p.text ?? '') && p.text.trim().split(/\s+/).length >= 6);
  if (!ok.length) return null;
  const excerpt = ok[Math.floor(ok.length / 2)].text.trim();
  const words = excerpt.split(/\s+/);
  words[Math.floor(words.length / 2)] = 'zzqxv';
  return { excerpt, altered: words.join(' ') };
}

async function seededExcerpt(t, token) {
  let ids = t.env.NEM016_ELIGIBLE_BOOK_ID ? [t.env.NEM016_ELIGIBLE_BOOK_ID] : null;
  if (!ids) {
    const list = await t.client.request('GET', '/books?isFree=true&limit=50');
    ids = (Array.isArray(list.body) ? list.body : []).filter((b) => !b.uploadedById).map((b) => b.id).slice(0, 5);
  }
  for (const bookId of ids) {
    const map = await t.client.request('GET', `/books/${bookId}/sync-map`, { token });
    const built = map.status === 200 ? buildExcerpt(map.body?.phrases) : null;
    if (built) return { bookId, ...built };
  }
  return null;
}

/** Runs tests in matrix order, keeping A14b (which deletes the fixture) last. */
export async function runTests(t, only = null) {
  const order = [...MATRIX.filter((x) => x.id !== 'A14b'), findTest('A14b')].filter((x) => T[x.id]);
  let unhealthy = false;
  for (const test of order) {
    if (only && !only.has(test.id)) continue;
    const apiChecks = test.checks.filter((c) => c.kind === 'api').map((c) => c.id);
    const block = (why) => apiChecks.forEach((id) => setCheck(t.state, id, 'BLOCKED', why));
    if (unhealthy) { block('Stopped: target failed its health check'); continue; }
    if (test.approval && !t.approved.has(test.id)) { block('Awaiting explicit Product Owner approval (--approve)'); continue; }
    if (NEEDS_FIXTURE.has(test.id) && (!t.state.book || t.state.book.deleted)) { block('Fixture book not available'); continue; }
    t.log(`${test.id} ${test.area}`);
    try {
      await T[test.id](t);
    } catch (err) {
      if (err instanceof GuardError) throw err;
      const open = apiChecks.find((id) => !t.state.results[id] || t.state.results[id].at < t.startedAt) ?? apiChecks[0];
      t.fail(open, `Harness could not finish the test: ${err.message}`);
    }
    t.onProgress?.();
    const health = await t.client.request('GET', '/health');
    if (health.status !== 200) unhealthy = true;
  }
  return { unhealthy };
}
