// G-1 HTTP contract — in-process integration test over loopback HTTP.
// REAL: JwtStrategy (Bearer-only), JwtAuthGuard, the global ThrottlerGuard (same 'global' throttler as AppModule),
// CheckoutStatusController and CheckoutStatusService, with genuinely signed JWTs.
// MOCKED: Stripe (retrieve only; every other method is a trap) and the three repositories (no database, no network).
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { INestApplication, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as jwt from 'jsonwebtoken';
import { JwtStrategy } from '../../../src/auth/jwt.strategy';
import { EmailConfirmedGuard } from '../../../src/auth/email-confirmed.guard';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import { UserBook } from '../../../src/library/user-book.entity';
import { CheckoutStatusController } from '../../../src/subscriptions/checkout-status.controller';
import { CheckoutStatusService } from '../../../src/subscriptions/checkout-status.service';
import { StripeProcessedEvent } from '../../../src/subscriptions/stripe-processed-event.entity';
import { Subscription } from '../../../src/subscriptions/subscription.entity';
import { UsersService } from '../../../src/users/users.service';

const trap = () => jest.fn(() => { throw new Error('must never be called'); });
const mockStripe = {
  checkout: { sessions: { retrieve: jest.fn(), create: trap(), expire: trap(), list: trap() } },
  subscriptions: { retrieve: trap(), update: trap(), cancel: trap() },
  refunds: { create: trap() },
  paymentIntents: { capture: trap() },
};
jest.mock('stripe', () => jest.fn().mockImplementation(() => mockStripe));

const SECRET = 'checkout-status-contract-secret';
const OWNER = { id: 'u-owner', email: 'owner@test.invalid', emailConfirmed: true, stripeCustomerId: 'cus_owner' };
const INTRUDER = { id: 'u-intruder', email: 'intruder@test.invalid', emailConfirmed: true, stripeCustomerId: 'cus_intruder' };
const UNCONFIRMED = { id: 'u-unc', email: 'unc@test.invalid', emailConfirmed: false, stripeCustomerId: 'cus_unc' };
const USERS: Record<string, unknown> = { [OWNER.id]: OWNER, [INTRUDER.id]: INTRUDER, [UNCONFIRMED.id]: UNCONFIRMED };
const sign = (u: { id: string; email: string }, opts: jwt.SignOptions = { expiresIn: '15m' }, secret = SECRET) =>
  jwt.sign({ sub: u.id, email: u.email }, secret, opts);

const SID = 'cs_test_a1B2c3D4e5F6g7H8i9J0kLmN';
const UNKNOWN = 'cs_test_zZ9yY8xX7wW6vV5uU4tT3sS2';
const GIFT = 'cs_test_g1G2g3G4g5G6g7G8g9G0';
const SESSIONS: Record<string, any> = {
  [SID]: { id: SID, mode: 'payment', status: 'complete', payment_status: 'paid', customer: 'cus_owner', amount_total: 999, currency: 'usd', metadata: { tokenPackageId: 'pkg-1', userId: OWNER.id } },
  [GIFT]: { id: GIFT, mode: 'payment', status: 'complete', payment_status: 'paid', customer: null, metadata: { type: 'gift', buyerUserId: '', recipientEmail: 'r@test.invalid' } },
};
const UNC_SID = 'cs_test_u1U2u3U4u5U6u7U8u9U0';
SESSIONS[UNC_SID] = { ...SESSIONS[SID], id: UNC_SID, customer: 'cus_unc', metadata: { bookId: 'b-1', userId: UNCONFIRMED.id } };

let stripeDown = false;
const writes = () => ({ save: trap(), insert: trap(), update: trap(), delete: trap(), query: trap() });
const processedRepo = { countBy: jest.fn(async () => 1), ...writes() };
const userBookRepo = { countBy: jest.fn(async () => 1), ...writes() };
const subRepo = { findOneBy: jest.fn(async () => null), ...writes() };

let app: INestApplication;
let base: string;
const previousSecret = process.env.JWT_SECRET;

async function buildApp(): Promise<{ app: INestApplication; base: string }> {
  const moduleRef = await Test.createTestingModule({
    imports: [PassportModule, ThrottlerModule.forRoot([{ name: 'global', ttl: 60_000, limit: 120 }])],
    controllers: [CheckoutStatusController],
    providers: [
      JwtStrategy,
      CheckoutStatusService,
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: ConfigService, useValue: { get: () => 'sk_test_contract' } },
      { provide: UsersService, useValue: { findById: async (id: string) => USERS[id] ?? null } },
      { provide: getRepositoryToken(Subscription), useValue: subRepo },
      { provide: getRepositoryToken(UserBook), useValue: userBookRepo },
      { provide: getRepositoryToken(StripeProcessedEvent), useValue: processedRepo },
    ],
  }).compile();
  const a = moduleRef.createNestApplication({ logger: false });
  await a.listen(0, '127.0.0.1');
  return { app: a, base: await a.getUrl() };
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  ({ app, base } = await buildApp());
});

afterAll(async () => {
  await app.close();
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

beforeEach(() => {
  stripeDown = false;
  mockStripe.checkout.sessions.retrieve.mockReset().mockImplementation(async (id: string) => {
    if (stripeDown) throw Object.assign(new Error('internal stripe detail'), { statusCode: 500, type: 'StripeConnectionError' });
    const s = SESSIONS[id];
    if (!s) throw Object.assign(new Error(`No such checkout.session: '${id}'`), { statusCode: 404, code: 'resource_missing' });
    return s;
  });
});

async function get(id: string, token?: string, at = base) {
  const r = await fetch(`${at}/subscriptions/checkout-sessions/${encodeURIComponent(id)}/status`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: r.status, text: await r.text(), cacheControl: r.headers.get('cache-control') };
}

describe('authentication (401)', () => {
  it('no JWT → 401, Stripe never called', async () => {
    expect((await get(SID)).status).toBe(401);
    expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });
  it('JWT signed with another secret → 401', async () => {
    expect((await get(SID, sign(OWNER, { expiresIn: '15m' }, 'wrong-secret'))).status).toBe(401);
  });
  it('expired JWT → 401', async () => {
    expect((await get(SID, sign(OWNER, { expiresIn: -10 }))).status).toBe(401);
  });
  it('JWT for a deleted user → 401', async () => {
    expect((await get(SID, sign({ id: 'gone', email: 'g@test.invalid' }))).status).toBe(401);
  });
  it('the session id in a cookie or query string is not a credential', async () => {
    const r = await fetch(`${base}/subscriptions/checkout-sessions/${SID}/status?access_token=${sign(OWNER)}`, { headers: { Cookie: `access_token=${sign(OWNER)}` } });
    expect(r.status).toBe(401);
  });
});

describe('the owner gets the contract response', () => {
  it('token session, paid, key present → unconfirmed (never delivered); no-store; only contract keys', async () => {
    const r = await get(SID, sign(OWNER));
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toEqual({ kind: 'tokens', checkout: 'complete', payment: 'paid', delivery: 'unconfirmed' });
    expect(r.cacheControl).toBe('no-store');
    expect(r.text).not.toMatch(/999|usd|cus_|cs_|pkg|u-owner|@/);
  });
  it('no EmailConfirmedGuard: an unconfirmed-email buyer can verify their own session', async () => {
    const r = await get(UNC_SID, sign(UNCONFIRMED));
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toEqual({ kind: 'book', checkout: 'complete', payment: 'paid', delivery: 'delivered' });
  });
});

describe('uniform 404 — identical bodies, no oracle', () => {
  it('unknown, another account\'s, anonymous gift and malformed ids all return the same 404 body', async () => {
    const token = sign(INTRUDER);
    const unknown = await get(UNKNOWN, token);
    const others = await get(SID, token);
    const gift = await get(GIFT, sign(OWNER));
    const malformed = await get('not-a-session', token);
    for (const r of [unknown, others, gift, malformed]) {
      expect(r.status).toBe(404);
      expect(r.text).toBe(unknown.text);
      expect(r.cacheControl).toBe('no-store');
    }
    expect(JSON.parse(unknown.text)).toEqual({ error: 'checkout_session_not_found' });
  });
  it('malformed id → 404 without a Stripe request', async () => {
    await get('cs_test_x', sign(OWNER));
    expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });
});

describe('failures (503) leak nothing', () => {
  it('Stripe outage → 503 with the fixed body only', async () => {
    stripeDown = true;
    const r = await get(SID, sign(OWNER));
    expect(r.status).toBe(503);
    expect(JSON.parse(r.text)).toEqual({ error: 'checkout_status_unavailable' });
    expect(r.text).not.toMatch(/stripe|internal|cs_/i);
    expect(r.cacheControl).toBe('no-store');
  });
});

describe('route table and guards', () => {
  it('exactly one checkout-session route, GET, behind JwtAuthGuard only (no EmailConfirmedGuard)', () => {
    const proto = CheckoutStatusController.prototype as any;
    const methods = Object.getOwnPropertyNames(proto).filter((m) => m !== 'constructor');
    expect(methods).toEqual(['getStatus']);
    expect(Reflect.getMetadata('path', proto.getStatus)).toBe('checkout-sessions/:id/status');
    expect(Reflect.getMetadata('method', proto.getStatus)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata('path', CheckoutStatusController)).toBe('subscriptions');
    expect(Reflect.getMetadata('__guards__', proto.getStatus)).toEqual([JwtAuthGuard]);
    expect(Reflect.getMetadata('__guards__', proto.getStatus)).not.toContain(EmailConfirmedGuard);
  });

  it('no gift-status or anonymous checkout-session route exists anywhere in the API (source audit)', () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith('.controller.ts') && files.push(p); });
    walk(join(__dirname, '../../../src'));
    const hits = files.filter((f) => /checkout-sessions/.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => f.split('/src/')[1])).toEqual(['subscriptions/checkout-status.controller.ts']);
    expect(readFileSync(files.find((f) => f.endsWith('gifts.controller.ts'))!, 'utf8')).not.toMatch(/status/i);
  });
});

describe('rate limit (30 requests/minute/IP)', () => {
  // A fresh application (fresh in-memory throttler storage), so the count is exact.
  let fresh: { app: INestApplication; base: string };
  beforeAll(async () => { fresh = await buildApp(); });
  afterAll(async () => { await fresh.app.close(); });

  it('requests 1–30 are served, the 31st → 429 (stricter than the global 120); unauthenticated calls count too', async () => {
    const token = sign(OWNER);
    const statuses: number[] = [];
    for (let i = 0; i < 20; i++) statuses.push((await get('cs_test_malformed!', token, fresh.base)).status);
    for (let i = 0; i < 10; i++) statuses.push((await get(SID, undefined, fresh.base)).status);
    const limited = await fetch(`${fresh.base}/subscriptions/checkout-sessions/${SID}/status`, { headers: { Authorization: `Bearer ${token}` } });
    statuses.push(limited.status);
    // The named 'global' throttler reports its wait in Retry-After-global (seconds); the web client reads it.
    expect(Number(limited.headers.get('retry-after-global'))).toBeGreaterThan(0);
    expect(statuses.slice(0, 20)).toEqual(Array(20).fill(404));
    expect(statuses.slice(20, 30)).toEqual(Array(10).fill(401));
    expect(statuses[30]).toBe(429);
  });
});
