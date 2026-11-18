// PR #59 final integrated release qualification — X08 suite (2026-11-18).
// Runs against the real production build (`next start` on loopback) of the merge rehearsal tree main@a67afbd + PR #59@eefe0fb.
// Network policy (same as Checkpoint X): only BASE is allowed; every API call (relative /api/* and the baked-in
// http://localhost:4000/*) is answered by mocks; everything else is aborted. Nothing leaves the machine; no real account.
// axe-core is injected from a local file (AXE env var), never fetched.
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(`${process.env.WEB_DIR}/package.json`);
const { chromium } = require('@playwright/test');

const BASE = process.env.BASE;
const OUT = process.env.OUT;
const AXE = process.env.AXE;
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 375, height: 812 }]];
const BOOK = { id: 'book-1', title: 'Marianela', author: 'Benito Pérez Galdós', coverUrl: null, category: 'classic', language: 'es', collection: null, isFree: true, audioStreamKey: null, audioStreamUrl: null, textFileUrl: null, description: 'd' };
const PHRASES = Array.from({ length: 12 }, (_, i) => ({ index: i, text: `Frase de prueba número ${i + 1} del lector.`, startTime: i * 3, endTime: i * 3 + 3, type: 'text' }));
const CAUSES = [
  { id: 'c-animal', slug: 'bienestar-animal', name: 'Bienestar Animal', description: 'd1' },
  { id: 'c-kids', slug: 'ninez-y-juventud', name: 'Niñez y Juventud', description: 'd2' },
  { id: 'c-env', slug: 'medio-ambiente', name: 'Medio Ambiente', description: 'd3' },
];

const results = [];
const record = (id, name, pass, detail = '') => { results.push({ id, name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? '  — ' + detail : ''}`); };
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

async function newPage(browser, { lang = 'es', token = null, viewport = VIEWPORTS[0][1] } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(([lang, token]) => {
    try {
      localStorage.setItem('noetia_lang', lang);
      localStorage.setItem('noetia_reader_tutorial_seen', '1');
      if (token) localStorage.setItem('access_token', token);
    } catch {}
  }, [lang, token]);
  const page = await ctx.newPage();
  const log = [];
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === BASE && !url.pathname.startsWith('/api/')) return route.continue();
    let path = null;
    if (url.origin === BASE && url.pathname.startsWith('/api/')) path = url.pathname.slice(4);
    else if (url.origin === 'http://localhost:4000') path = url.pathname;
    if (path === null) return route.abort();
    const auth = req.headers()['authorization'] ?? null;
    log.push({ m: req.method(), p: path, auth });
    const json = (status, obj) => route.fulfill({ status, contentType: 'application/json', body: obj === undefined ? '' : JSON.stringify(obj) });
    if (path === '/causes' && req.method() === 'GET') return json(200, CAUSES);
    if (path === '/subscriptions/plans') return json(200, [{ id: 'plan-ind', name: 'Individual', amountCents: 899, interval: 'month', tokensPerCycle: 1, maxProfiles: 1 }]);
    if (path === '/subscriptions/token-packages') return json(200, [{ id: 'pkg-1', name: 'One', tokenCount: 1, amountCents: 499 }]);
    if (path === '/gifts/packages' || path === '/gift/packages') return json(200, []);
    if (path === '/auth/refresh') return json(401, { message: 'no session' });
    if (path === '/auth/login' && req.method() === 'POST') {
      const b = JSON.parse(req.postData() ?? '{}');
      if (b.password === 'correct-horse-9') return json(200, { accessToken: 'tok-valid', user: { id: 'u1', userType: 'reader', emailConfirmed: true } });
      return json(401, { message: lang === 'es' ? 'Credenciales inválidas' : 'Invalid credentials' });
    }
    if (!auth) return json(401, { message: 'Unauthorized' });
    if (path === '/library') return json(200, [BOOK]);
    if (path === '/collections') return json(200, []);
    if (path === `/books/${BOOK.id}`) return json(200, BOOK);
    if (path === `/books/${BOOK.id}/sync-map`) return json(200, { phrases: PHRASES });
    if (path === `/books/${BOOK.id}/progress`) return req.method() === 'GET' ? json(200, { phraseIndex: 0 }) : json(200, {});
    if (path === `/books/${BOOK.id}/fragments`) return json(200, []);
    if (path === `/library/${BOOK.id}`) return json(201, {});
    if (path === '/subscriptions/me') return json(200, { status: 'none' });
    if (path === '/users/me' || path === '/users/me/settings') return json(200, { id: 'u1', language: lang });
    if (path.startsWith('/stats')) return json(200, {});
    return json(404, { message: 'mock: not found' });
  });
  return { ctx, page, log, consoleErrors };
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function axeScan(page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) }));
  });
}

const COPY = {
  es: {
    status: 'Programa en preparación',
    net: '2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago',
    pending: /alianzas con organizaciones benéficas (aún )?están pendientes/,
    rule: /si no eliges ninguna, se repartirá por igual entre las tres/i,
    causesHome: ['Bienestar animal', 'Niñez y juventud', 'Medio ambiente'],
    causesPage: ['Bienestar Animal', 'Niñez y Juventud', 'Medio Ambiente'],
    disclosure: 'no se ha firmado ningún acuerdo y no se ha realizado ninguna contribución',
    company: ['Noetia opera como un canal de distribución digital para autores y editoriales', 'Lo que ofrecemos a autores:', 'Impacto social — Causas Noetia (programa en preparación; alianzas pendientes)'],
    plus: /hasta tres libros elegibles que seleccionas por sesión/, x: /hasta diez libros elegibles que seleccionas por sesión/, req: 'Requerirá una suscripción Noetia activa.', soon: 'Próximamente', mayChange: /pueden cambiar/,
    unavailable: { pricing: 'Las suscripciones y las compras de tokens aún no están disponibles.', btn: 'Aún no disponible' },
    loginErr: 'Credenciales inválidas',
  },
  en: {
    status: 'Planned program',
    net: '2.22% of eligible net receipts, after payment-processing fees',
    pending: /[Cc]haritable partnerships are pending/,
    rule: /if you don't(, it will be split| choose one, it will be split) equally among all three/,
    causesHome: ['Animal welfare', 'Children and youth', 'Environment'],
    causesPage: ['Animal Welfare', 'Children & Youth', 'Environment'],
    disclosure: 'no agreement has been signed and no contribution has been made',
    company: ['Noetia operates as a digital distribution channel for authors and publishers', 'What we offer authors:', 'Social impact — Causas Noetia (planned program; partnerships pending)'],
    plus: /up to three eligible books you select per session/, x: /up to ten eligible books you select per session/, req: 'Will require an active Noetia subscription.', soon: 'Coming Soon', mayChange: /may change/,
    unavailable: { pricing: 'Subscriptions and token purchases are not available yet.', btn: 'Not available yet' },
    loginErr: 'Invalid credentials',
  },
};
const PCT = /45 ?%|36 ?%|(^|[^\d.,])9 ?%|2[.,]22 ?%|7[.,]78 ?%/;
const axeSummary = {};

const browser = await chromium.launch(process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {});
try {
  for (const lang of ['es', 'en']) {
    const c = COPY[lang];
    for (const [vp, viewport] of VIEWPORTS) {
      const { ctx, page, consoleErrors } = await newPage(browser, { lang, viewport });

      // Homepage: Causas prominent + copy, Noetia+/NoetiaX
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      const section = page.locator('section[aria-labelledby="causas-title"]');
      const secText = norm(await section.textContent());
      const visible = await page.locator('#causas-title').isVisible();
      const badge = norm(await page.locator('[data-testid="causas-status"]').textContent());
      const h2s = await page.locator('h2').allTextContents();
      const secIndex = h2s.findIndex((t) => /Compartir también es ayudar|Sharing is also helping/.test(t));
      const homeText = norm(await page.textContent('body'));
      await section.screenshot({ path: `${OUT}/home-causas-section-${lang}-${vp}.png` });
      await page.screenshot({ path: `${OUT}/home-${lang}-${vp}.png`, fullPage: true });
      record(`X08-home-causas-${lang}-${vp}`, `homepage ${lang} ${vp}: Causas section present, visible, ${c.status} badge, net-receipts basis, partnerships pending, PO-053 rule, 3 causes; no settlement/refund detail`,
        visible && secIndex >= 0 && badge === c.status && secText.includes(c.net) && c.pending.test(secText) && c.rule.test(secText) && c.causesHome.every((x) => secText.includes(x)) && !/mensual|monthly|reembols|refund|liquidaci|settle/i.test(homeText),
        `visible=${visible} h2#=${secIndex + 1}/${h2s.length} badge="${badge}"`);
      const tiers = await page.locator('article[data-tier]').count();
      const plusT = norm(await page.locator('article[data-tier="plus"]').textContent());
      const xT = norm(await page.locator('article[data-tier="x"]').textContent());
      const tierCtl = await page.locator('article[data-tier="plus"] a, article[data-tier="plus"] button, article[data-tier="x"] a, article[data-tier="x"] button').count();
      record(`X08-home-premium-${lang}-${vp}`, `homepage ${lang} ${vp}: Noetia+/NoetiaX ${c.soon}, 3/10 books per session, active-subscription prerequisite, may-change note, no controls`,
        tiers === 3 && plusT.includes(c.soon) && xT.includes(c.soon) && c.plus.test(plusT) && c.x.test(xT) && plusT.includes(c.req) && xT.includes(c.req) && c.mayChange.test(homeText) && tierCtl === 0,
        `tiers=${tiers} premiumControls=${tierCtl}`);
      const ovHome = await overflow(page);
      if (vp === 'desktop') axeSummary[`home-${lang}`] = await axeScan(page);

      // /causas
      await page.goto(`${BASE}/causas`, { waitUntil: 'networkidle' });
      const ct = norm(await page.textContent('body'));
      const cBadge = norm(await page.locator('[data-testid="causas-status"]').textContent());
      const disc = norm(await page.locator('[data-testid="causas-disclosure"]').textContent());
      const termsLinks = await page.locator('a[href*="/causas/terms"]').count();
      const ovCausas = await overflow(page);
      await page.screenshot({ path: `${OUT}/causas-${lang}-${vp}.png`, fullPage: true });
      record(`X08-causas-${lang}-${vp}`, `/causas ${lang} ${vp}: 3 causes, ${c.status} badge, net-receipts basis, independent charities, disclosure, no terms link, no overflow`,
        c.causesPage.every((x) => ct.includes(x)) && cBadge === c.status && ct.includes(c.net) && /benéficas independientes|independent charitable organizations/.test(ct) && disc.includes(c.disclosure) && termsLinks === 0 && !/cada pago|every payment|total del pago|total payment/i.test(ct) && ovCausas <= 0,
        `badge="${cBadge}" termsLinks=${termsLinks} hOverflow=${ovCausas}px`);
      if (vp === 'desktop') axeSummary[`causas-${lang}`] = await axeScan(page);

      // /company
      await page.goto(`${BASE}/company`, { waitUntil: 'networkidle' });
      const co = norm(await page.textContent('body'));
      const ovCo = await overflow(page);
      await page.screenshot({ path: `${OUT}/company-${lang}-${vp}.png`, fullPage: true });
      record(`X08-company-${lang}-${vp}`, `/company ${lang} ${vp}: no five-percentage breakdown; qualitative business, author and Causas text kept`,
        !PCT.test(co) && !/Distribución de ingresos|Revenue distribution/.test(co) && c.company.every((x) => co.includes(x)) && ovCo <= 0,
        `percentMatch=${(co.match(PCT) || [''])[0]} hOverflow=${ovCo}px`);

      // /pricing + /gift (guest)
      await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle' });
      const pt = norm(await page.textContent('body'));
      const pBtns = page.getByRole('button', { name: c.unavailable.btn, exact: true });
      const pn = await pBtns.count();
      let pAllDisabled = pn > 0;
      for (let i = 0; i < pn; i++) pAllDisabled = pAllDisabled && (await pBtns.nth(i).isDisabled());
      const ovP = await overflow(page);
      await page.screenshot({ path: `${OUT}/pricing-${lang}-${vp}.png`, fullPage: true });
      await page.goto(`${BASE}/gift`, { waitUntil: 'networkidle' });
      const gBtn = page.getByRole('button', { name: c.unavailable.btn, exact: true });
      const gDisabled = (await gBtn.count()) >= 1 && (await gBtn.first().isDisabled());
      const ovG = await overflow(page);
      await page.screenshot({ path: `${OUT}/gift-${lang}-${vp}.png`, fullPage: true });
      record(`X08-purchase-unavailable-${lang}-${vp}`, `/pricing + /gift ${lang} ${vp}: unavailable notice; ${pn} purchase controls + gift submit disabled; Causas line uses planned/net wording`,
        pt.includes(c.unavailable.pricing) && pAllDisabled && gDisabled && pt.includes(c.net.replace(/^2[.,]22% /, '')) && ovP <= 0 && ovG <= 0,
        `pricingControls=${pn} allDisabled=${pAllDisabled} giftDisabled=${gDisabled} hOverflow=${ovP}/${ovG}px`);

      record(`X08-overflow-home-${lang}-${vp}`, `homepage ${lang} ${vp}: no horizontal overflow`, ovHome <= 0, `hOverflow=${ovHome}px`);
      record(`X08-console-${lang}-${vp}`, `public pages ${lang} ${vp}: no uncaught page errors`, !consoleErrors.some((e) => e.startsWith('pageerror')), consoleErrors.filter((e) => e.startsWith('pageerror')).slice(0, 2).join(' | '));
      await ctx.close();
    }
  }

  // /causas/terms → 404 (both languages render the same not-found)
  {
    const { ctx, page } = await newPage(browser, { lang: 'en' });
    const r = await page.goto(`${BASE}/causas/terms`, { waitUntil: 'domcontentloaded' });
    const body = norm(await page.textContent('body'));
    await page.screenshot({ path: `${OUT}/causas-terms-404.png`, fullPage: true });
    record('X08-terms-404', '/causas/terms returns HTTP 404 and shows no draft text', r.status() === 404 && !/Borrador para revisión legal|Draft for legal review|Program terms \(draft\)/.test(body), `status=${r.status()}`);
    // No public page links to it
    let linkCount = 0;
    for (const route of ['/', '/causas', '/company', '/about', '/milestones', '/pricing', '/gift', '/login']) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      linkCount += await page.locator('a[href*="/causas/terms"]').count();
    }
    record('X08-terms-nolinks', 'no public page links to /causas/terms (/, /causas, /company, /about, /milestones, /pricing, /gift, /login incl. footer)', linkCount === 0, `links=${linkCount}`);
    await ctx.close();
  }

  // Login → library → reader (mocked API), ES/EN, desktop + mobile
  for (const lang of ['es', 'en']) {
    for (const [vp, viewport] of VIEWPORTS) {
      const { ctx, page, log, consoleErrors } = await newPage(browser, { lang, viewport });
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
      await page.locator('input[type="email"]').fill('reader@example.test');
      await page.locator('input[type="password"]').fill('wrong-password-1');
      await page.locator('form button[type="submit"]').click();
      await page.getByText(COPY[lang].loginErr).waitFor({ timeout: 5000 }).catch(() => {});
      const errShown = (await page.getByText(COPY[lang].loginErr).count()) > 0;
      const stillLogin = new URL(page.url()).pathname === '/login';
      await page.locator('input[type="password"]').fill('correct-horse-9');
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL(/\/library/, { timeout: 10000 }).catch(() => {});
      const onLibrary = new URL(page.url()).pathname === '/library';
      const tokenSaved = await page.evaluate(() => localStorage.getItem('access_token'));
      await page.getByText(BOOK.title).first().waitFor({ timeout: 8000 }).catch(() => {});
      const bookShown = (await page.getByText(BOOK.title).count()) > 0;
      const ovLib = await overflow(page);
      await page.screenshot({ path: `${OUT}/library-${lang}-${vp}.png`, fullPage: false });
      record(`X08-login-library-${lang}-${vp}`, `login ${lang} ${vp}: bad password → error, stays on /login; good password → /library with token; library lists the book`,
        errShown && stillLogin && onLibrary && tokenSaved === 'tok-valid' && bookShown && ovLib <= 0,
        `errShown=${errShown} onLibrary=${onLibrary} bookShown=${bookShown} hOverflow=${ovLib}px`);

      await page.goto(`${BASE}/reader/${BOOK.id}`, { waitUntil: 'networkidle' });
      await page.getByText(PHRASES[0].text).first().waitFor({ timeout: 10000 }).catch(() => {});
      const phraseShown = (await page.getByText(PHRASES[0].text).count()) > 0;
      const titleShown = (await page.getByText(BOOK.title).count()) > 0;
      const bookCalls = log.filter((x) => x.p === `/books/${BOOK.id}` && x.auth === 'Bearer tok-valid').length;
      const ovR = await overflow(page);
      const pageErrors = consoleErrors.filter((e) => e.startsWith('pageerror'));
      await page.screenshot({ path: `${OUT}/reader-${lang}-${vp}.png`, fullPage: false });
      record(`X08-reader-${lang}-${vp}`, `reader ${lang} ${vp}: authenticated book load renders title + phrases; no uncaught errors; no overflow`,
        phraseShown && titleShown && bookCalls >= 1 && pageErrors.length === 0 && ovR <= 0,
        `phraseShown=${phraseShown} titleShown=${titleShown} authBookCalls=${bookCalls} pageErrors=${pageErrors.length} hOverflow=${ovR}px`);
      await ctx.close();
    }
  }

  // Guest reader → login redirect with next (acquisition funnel unchanged)
  {
    const { ctx, page } = await newPage(browser, { lang: 'es' });
    await page.goto(`${BASE}/reader/${BOOK.id}`, { waitUntil: 'networkidle' });
    await page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {});
    const u = new URL(page.url());
    record('X08-reader-guest', 'guest opening the reader → /login?next=/reader/<id>', u.pathname === '/login' && u.searchParams.get('next') === `/reader/${BOOK.id}`, u.pathname + u.search);
    await ctx.close();
  }
} finally {
  await browser.close();
}

fs.writeFileSync(`${OUT}/axe-violations.json`, JSON.stringify(axeSummary, null, 2));
const failed = results.filter((r) => !r.pass).length;
fs.writeFileSync(`${OUT}/x08-results.json`, JSON.stringify({ base: BASE, total: results.length, failed, results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} passed`);
for (const [k, v] of Object.entries(axeSummary)) console.log(`axe ${k}: ${v.map((x) => `${x.id}(${x.impact},${x.nodes})`).join(' ') || 'no violations'}`);
process.exit(failed ? 1 : 0);
