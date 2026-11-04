// NEM-016 acceptance harness: safety layer. Everything that can reach a network
// goes through these checks; there is no flag that bypasses them.
import { closeSync, existsSync, openSync, readFileSync, statSync, writeSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

export class GuardError extends Error {}

// An allowlist, not a denylist: production can't be expressed as a target.
export const STAGING = Object.freeze({
  name: 'staging',
  api: 'https://staging.noetia.app/api',
  storage: 'https://storage.staging.noetia.app',
  // Records that already exist on staging. The harness only ever reads them.
  fixtureBookId: '68303e17-3a80-4f17-b3c1-8be00a66cc71',
  adminId: '4219d326-b9fc-4aa9-8d35-6ce8b9e6e787',
  adminEmail: 'nem016-admin-test@noetia.invalid',
  // Deployed before the F1 and F2 corrections, so X8 and X9 can't pass there.
  preFixSha: 'aaf708e93a8f4fff33570f0628813782c5d18ac5',
});

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const SHA_RE = /^[0-9a-f]{40}$/;
export const authorizationPhrase = (sha) => `I-HAVE-PO-AUTHORIZATION-FOR-STAGING:${sha}`;

function loopbackOrigin(raw, label) {
  let u;
  try { u = new URL(raw); } catch { throw new GuardError(`${label} is not a URL`); }
  if (!LOOPBACK.has(u.hostname)) throw new GuardError(`${label} must be a loopback address for the local target`);
  if (u.protocol !== 'http:') throw new GuardError(`${label} must use http for the local target`);
  if (u.username || u.password || u.search || u.hash) throw new GuardError(`${label} must be a bare origin`);
  return u.href.replace(/\/+$/, '');
}

/**
 * Resolves the target from the environment. `local` takes loopback URLs; `staging`
 * takes fixed URLs plus an authorization phrase naming the deployed commit. The
 * phrase is a deliberate speed bump, not proof of approval: approval itself is a
 * Product Owner decision outside this tool.
 */
export function resolveTarget(env = process.env) {
  const name = env.NEM016_TARGET;
  if (name === 'local') {
    return Object.freeze({
      name: 'local',
      api: loopbackOrigin(env.NEM016_LOCAL_API ?? '', 'NEM016_LOCAL_API'),
      storage: loopbackOrigin(env.NEM016_LOCAL_STORAGE ?? '', 'NEM016_LOCAL_STORAGE'),
    });
  }
  if (name === 'staging') {
    const sha = env.NEM016_DEPLOYED_SHA ?? '';
    if (!SHA_RE.test(sha)) throw new GuardError('NEM016_DEPLOYED_SHA must be the full 40-character commit deployed on staging');
    if (env.NEM016_PO_AUTHORIZATION !== authorizationPhrase(sha)) {
      throw new GuardError('Staging execution needs explicit Product Owner authorization. Set NEM016_PO_AUTHORIZATION only after it is given; see README.');
    }
    return STAGING;
  }
  throw new GuardError('NEM016_TARGET must be "local" or "staging"; any other target, including production, is refused');
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SLUG = '[A-Za-z0-9]{1,16}';

/** Every request the harness may make. Anything else throws before any network use. */
const ROUTES = [
  ['GET', /^\/health$/],
  ['GET', /^\/books(\?[A-Za-z0-9=&%+_.-]*)?$/],
  ['GET', new RegExp(`^/books/${UUID}/sync-map$`)],
  ['GET', /^\/users\/me$/],
  ['GET', new RegExp(`^/shares/${SLUG}$`)],
  ['POST', /^\/auth\/register$/],
  ['POST', /^\/auth\/login$/],
  ['POST', /^\/fragments$/],
  ['POST', new RegExp(`^/fragments/${UUID}/share$`)],
  ['POST', /^\/social\/linkedin\/publish$/],
  ['DELETE', new RegExp(`^/fragments/${UUID}$`)],
  ['DELETE', new RegExp(`^/shares/${SLUG}$`)],
  ['DELETE', /^\/users\/me$/],
];

/**
 * Books this run uploaded are the only ones it may delete, which keeps existing
 * books (and their eligibility and provenance) out of the harness's reach. With
 * `protectBooks` (the staging target) it can't write to any book at all.
 */
export function assertRoute(method, path, { fixtureUpload = false, deletableBookIds = [], protectBooks = false } = {}) {
  const bookWrite = (method === 'POST' && path === '/books') || (method === 'DELETE' && /^\/books\//.test(path));
  if (bookWrite && protectBooks) {
    throw new GuardError('The harness never creates or deletes books on staging');
  }
  if (method === 'POST' && path === '/books') {
    if (fixtureUpload) return;
    throw new GuardError('POST /books is only allowed for the fixture upload step');
  }
  if (method === 'DELETE' && /^\/books\//.test(path)) {
    if (deletableBookIds.some((id) => path === `/books/${id}`)) return;
    throw new GuardError('DELETE /books is only allowed for a book uploaded by this run');
  }
  if (!ROUTES.some(([m, re]) => m === method && re.test(path))) {
    throw new GuardError(`Route not on the harness allowlist: ${method} ${path.split('?')[0]}`);
  }
}

const CARD_PATH = new RegExp(`^/images/${UUID}\\.png$`, 'i');

/** Card images are fetched only from the target's own storage origin. */
export function assertImageUrl(target, url) {
  let u;
  try { u = new URL(url); } catch { throw new GuardError('image URL is not a URL'); }
  if (u.origin !== new URL(target.storage).origin || !CARD_PATH.test(u.pathname) || u.search || u.hash) {
    throw new GuardError(`Image URL is outside the target's storage origin: ${u.origin}${u.pathname}`);
  }
}

export const EMAIL_RE = /^nem016-[a-z0-9]{6,16}-(a|b|r|d|x|y|adm)@staging\.invalid$/;
export const assertTestEmail = (email) => {
  if (!EMAIL_RE.test(email)) throw new GuardError('Refusing a non-synthetic account address');
};

/** The staging admin grant already exists, and only the operator may ever change it. */
export function assertAdminSqlAllowed(env = process.env) {
  if (env.NEM016_TARGET !== 'local') throw new GuardError('admin-sql is for the local stack only; never grant or revoke staging privileges from this tool');
}

export function assertInert(value, re, label) {
  if (typeof value !== 'string' || !re.test(value)) throw new GuardError(`${label} failed validation`);
  return value;
}
export const assertUuid = (v, label = 'id') => assertInert(v, new RegExp(`^${UUID}$`), label);
export const assertSlug = (v, label = 'share id') => assertInert(v, new RegExp(`^${SLUG}$`), label);
export const assertCardKey = (v) => assertInert(v, new RegExp(`^${UUID}\\.png$`, 'i'), 'card key');

/** Secrets and run state must not be able to land in a git work tree. */
export function assertOutsideRepo(path, label) {
  let dir = resolve(path);
  for (;;) {
    if (existsSync(join(dir, '.git'))) throw new GuardError(`${label} must be outside any git repository: ${resolve(path)}`);
    const up = dirname(dir);
    if (up === dir) return;
    dir = up;
  }
}

export function writeSecretSeed(path) {
  assertOutsideRepo(path, 'secret file');
  if (existsSync(path)) throw new GuardError(`Secret file already exists: ${path}`);
  const fd = openSync(path, 'wx', 0o600);
  try { writeSync(fd, `${randomBytes(32).toString('hex')}\n`); } finally { closeSync(fd); }
}

export function readSecretSeed(path) {
  if (!path) throw new GuardError('NEM016_SECRET_FILE is required (create it with: acceptance.mjs init-secret <path>)');
  assertOutsideRepo(path, 'secret file');
  const st = statSync(path);
  if ((st.mode & 0o077) !== 0) throw new GuardError('Secret file must have mode 600');
  const seed = readFileSync(path, 'utf8').trim();
  if (!/^[0-9a-f]{64}$/.test(seed)) throw new GuardError('Secret file has an unexpected format');
  return seed;
}

/** Account passwords are derived in memory and never written anywhere. */
export const derivePassword = (seed, runId, role) =>
  `Aa1-${createHmac('sha256', seed).update(`${runId}:${role}`).digest('base64url')}`;

const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const FIELD_RE = /("?(?:password|passwordHash|accessToken|refreshToken|token|secret|authorization)"?\s*[:=]\s*)("[^"]*"|[^\s,}]+)/gi;
const DERIVED_RE = /Aa1-[A-Za-z0-9_-]{20,}/g;

/** Applied to everything recorded in results and reports. */
export function redact(text) {
  return String(text)
    .replace(JWT_RE, '[REDACTED]')
    .replace(BEARER_RE, 'Bearer [REDACTED]')
    .replace(FIELD_RE, '$1[REDACTED]')
    .replace(DERIVED_RE, '[REDACTED]');
}
