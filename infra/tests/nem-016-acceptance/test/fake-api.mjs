// In-memory stand-in for the NEM-016 API, used to show that the assertions pass
// on correct behaviour and fail on each injected defect. No network involved.
import { NEGATIVE, POSITIVE } from '../lib/cases.mjs';
import { randomUUID } from 'node:crypto';

const json = (status, body, headers = {}) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', date: new Date().toUTCString(), ...headers } });
const CANON = (t) => t.replace('[...]', '[…]');
const REASONS = new Map(Object.values(NEGATIVE).map((n) => [n.text, n.reason]));
const VALID = new Set(Object.values(POSITIVE).map((p) => CANON(p.text)));
const UNSAFE = /^(http:|file:|data:image\/svg)|\/admin$|169\.254/;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

export function fakeApi({ defects = new Set(), storage = 'http://127.0.0.1:19016' } = {}) {
  const db = { users: new Map(), byToken: new Map(), fragments: new Map(), shares: new Map(), images: new Set(), books: new Map(), counts: new Map(), calls: [] };
  const bid = randomUUID();
  db.books.set(bid, { id: bid, title: 'Seeded', uploadedById: null, isFree: true, shareCount: 0 });
  db.seededBook = bid;
  db.ineligible = randomUUID();

  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); const path = u.pathname; const method = init.method ?? 'GET';
    db.calls.push(`${method} ${url}`);
    if (u.origin === storage) return db.images.has(path) ? new Response(PNG, { status: 200 }) : new Response('x', { status: 404 });
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    const token = init.headers?.authorization?.split(' ')[1];
    const me = db.byToken.get(token);
    let m;
    if (path === '/health') return json(200, { status: 'ok' });
    if (path === '/auth/register' || path === '/auth/login') {
      const existing = db.users.get(body.email);
      if (path === '/auth/login' && (!existing || existing.password !== body.password)) return json(401, {});
      const user = existing ?? { id: randomUUID(), email: body.email, password: body.password, isAdmin: body.email.includes('-adm@') };
      db.users.set(body.email, user);
      const accessToken = `eyJfake.${randomUUID()}.sig`;
      db.byToken.set(accessToken, user);
      return json(path.endsWith('login') ? 200 : 201, { accessToken, user: { id: user.id, email: user.email } });
    }
    if (path === '/users/me' && method === 'GET') return json(200, { id: me.id, isAdmin: me.isAdmin });
    if (path === '/users/me' && method === 'DELETE') {
      for (const s of db.shares.values()) if (s.owner === me.id) { db.images.delete(s.path); db.shares.delete(s.id); }
      db.users.delete(me.email); db.byToken.delete(token);
      return json(204);
    }
    if (path === '/books' && method === 'GET') return json(200, u.searchParams.get('search') ? [] : [...db.books.values()]);
    if (path === '/books' && method === 'POST') {
      const id = randomUUID();
      db.books.set(id, { id, title: init.body.get('title'), uploadedById: me?.id ?? 'x', isPublished: true, shareCount: 0, textFileKey: 'x.txt' });
      return json(201, db.books.get(id));
    }
    if ((m = /^\/books\/([^/]+)\/sync-map$/.exec(path))) return json(200, { phrases: [{ text: 'una frase de prueba con varias palabras reales' }] });
    if ((m = /^\/books\/([^/]+)$/.exec(path))) {
      if (method === 'DELETE') {
        if (!db.books.has(m[1])) return json(404, {});
        db.books.delete(m[1]);
        if (!defects.has('bookDeleteKeepsShares')) for (const s of db.shares.values()) if (s.book === m[1]) { s.revoked = true; db.images.delete(s.path); }
        return json(204);
      }
      return json(403, {}); // SubscriptionGuard: the harness can't read a non-free book
    }
    if (path === '/fragments' && method === 'POST') {
      const id = randomUUID(); db.fragments.set(id, { id, owner: me.id, bookId: body.bookId, text: body.text });
      return json(201, { id });
    }
    if ((m = /^\/fragments\/([^/]+)\/share$/.exec(path))) {
      if (!me) return json(401, {});
      const f = db.fragments.get(m[1]);
      if (!f || (f.owner !== me.id && !defects.has('noOwnerCheck'))) return json(404, {});
      if (body.platform === 'myspace' || body.bgType === 'video' || body.textColor === 'red' || body.textScale === 9 || (body.text?.length ?? 0) > 2000) {
        if (!defects.has('noDto')) return json(400, {});
      }
      if (f.bookId === db.ineligible && !defects.has('noGate')) return json(422, { error: 'book_not_shareable' });
      const text = body.text === undefined ? f.text : body.text;
      const quote = defects.has('noCanon') ? text : CANON(text);
      const seeded = db.books.get(f.bookId)?.uploadedById === null;
      const faithful = seeded ? f.text === quote : VALID.has(CANON(text));
      if (!faithful && !defects.has('acceptAllQuotes')) return json(422, { error: 'quote_not_in_source', reason: REASONS.get(text) ?? 'not_in_source' });
      if (body.bgImage && UNSAFE.test(body.bgImage) && !body.bgImage.includes('bgstatic') && !defects.has('allowAnyBg')) return json(400, { error: 'unsupported_background_image' });
      const hash = JSON.stringify({ me: me.id, f: f.id, quote, ...body, text: undefined });
      if (!defects.has('noDedupe')) for (const s of db.shares.values()) if (s.hash === hash && !s.revoked) return json(200, { url: `http://web/s/${s.id}`, imageUrl: `${storage}${s.path}` });
      const n = (db.counts.get(me.id) ?? 0) + 1; db.counts.set(me.id, n);
      if (n > 20 && !defects.has('noRateLimit')) return json(429, { error: 'rate_limited', action: 'share_create' });
      const id = randomUUID().replace(/-/g, '').slice(0, 10);
      const imgPath = `/images/${randomUUID()}.png`;
      db.images.add(imgPath);
      db.shares.set(id, { id, owner: me.id, fragment: f.id, book: f.bookId, quote, path: imgPath, hash, revoked: false });
      if (db.books.has(f.bookId)) db.books.get(f.bookId).shareCount++;
      return json(200, { url: `http://web/s/${id}`, imageUrl: `${storage}${imgPath}` });
    }
    if ((m = /^\/fragments\/([^/]+)$/.exec(path)) && method === 'DELETE') {
      db.fragments.delete(m[1]);
      for (const s of db.shares.values()) if (s.fragment === m[1] && !defects.has('fragmentDeleteKeepsShares')) { s.revoked = true; db.images.delete(s.path); }
      return json(204);
    }
    if ((m = /^\/shares\/([^/]+)$/.exec(path))) {
      const s = db.shares.get(m[1]);
      if (method === 'DELETE') {
        if (!me) return json(401, {});
        if (!s || (s.owner !== me.id && !defects.has('anyoneRevokes'))) return json(404, {});
        s.revoked = true;
        if (!defects.has('revokeKeepsImage')) db.images.delete(s.path);
        return json(204);
      }
      if (!s || s.revoked || !db.books.has(s.book)) return json(404, {});
      return json(200, { id: s.id, quote: s.quote, ...(defects.has('leakFields') ? { createdById: s.owner } : {}) });
    }
    if (path === '/social/linkedin/publish') {
      if (!me?.socialToken && !defects.has('publishWithoutAccount') && !db.seedSocial) return json(401, { message: 'account_not_connected' });
      if (!body.imageUrl?.startsWith(`${storage}/images/`)) return json(400, { message: 'untrusted_image_source' });
      return json(404, { message: 'share_not_found' });
    }
    return json(500, { error: `fake api: no route for ${method} ${path}` });
  };
  return { db, fetchImpl };
}
