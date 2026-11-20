// Authentication contract for the endpoints /pricing depends on — an in-process HTTP integration test.
// REAL: JwtStrategy (Bearer-only extraction), JwtAuthGuard, EmailConfirmedGuard, CausesController,
// SubscriptionsController, cookie-parser and the global ValidationPipe, with genuinely signed JWTs over
// loopback HTTP. MOCKED: the services behind the controllers (no database, no Stripe, no network).
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import { JwtStrategy } from '../../../src/auth/jwt.strategy';
import { UsersService } from '../../../src/users/users.service';
import { CausesController } from '../../../src/causes/causes.controller';
import { CausesService } from '../../../src/causes/causes.service';
import { SubscriptionsController } from '../../../src/subscriptions/subscriptions.controller';
import { SubscriptionsService } from '../../../src/subscriptions/subscriptions.service';
import { PlansService } from '../../../src/subscriptions/plans.service';

const SECRET = 'contract-test-secret';
const PLAN_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const WITH_PREF = { id: 'u-pref', email: 'with-pref@test.invalid', emailConfirmed: true };
const NO_PREF = { id: 'u-none', email: 'no-pref@test.invalid', emailConfirmed: true };
const UNCONFIRMED = { id: 'u-unc', email: 'unconfirmed@test.invalid', emailConfirmed: false };
const USERS: Record<string, unknown> = { [WITH_PREF.id]: WITH_PREF, [NO_PREF.id]: NO_PREF, [UNCONFIRMED.id]: UNCONFIRMED };

const sign = (u: { id: string; email: string }, expiresIn: number | string = '15m') =>
  jwt.sign({ sub: u.id, email: u.email }, SECRET, { expiresIn } as jwt.SignOptions);

const subscriptionsService = {
  getSubscriptionStatus: jest.fn(async () => ({ planId: null })),
  createCheckoutSession: jest.fn(async () => ({ url: 'https://checkout.invalid/session' })),
  createTokenPackageSession: jest.fn(async () => ({ url: 'https://checkout.invalid/tokens' })),
};

let app: INestApplication;
let base: string;
const previousSecret = process.env.JWT_SECRET;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET; // read by JwtStrategy's constructor
  const moduleRef = await Test.createTestingModule({
    imports: [PassportModule],
    controllers: [CausesController, SubscriptionsController],
    providers: [
      JwtStrategy,
      { provide: UsersService, useValue: { findById: async (id: string) => USERS[id] ?? null } },
      {
        provide: CausesService,
        useValue: {
          findAllActive: async () => [{ id: 'c1', slug: 'medio-ambiente' }],
          getPreferences: async (uid: string) =>
            uid === WITH_PREF.id ? { userId: uid, cause1Id: 'c1', cause2Id: null, randomDistribution: false } : null,
          savePreferences: async (uid: string, dto: object) => ({ userId: uid, ...dto }),
        },
      },
      { provide: SubscriptionsService, useValue: subscriptionsService },
      { provide: PlansService, useValue: { findAll: async () => [{ id: PLAN_ID }], findActiveTokenPackages: async () => [] } },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});

afterAll(async () => {
  await app.close();
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

beforeEach(() => jest.clearAllMocks());

async function call(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const r = await fetch(base + path, {
    method: init.method ?? 'GET',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return { status: r.status, text: await r.text() };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const REFRESH_COOKIE_ONLY = { Cookie: 'refresh_token=u-pref:rt-1' };

// Every row has exactly 3 elements: a shorter row would make Jest pass its `done` callback as `body`.
const PROTECTED: Array<[string, string, unknown]> = [
  ['GET', '/subscriptions/me', null],
  ['GET', '/causes/preferences', null],
  ['POST', '/causes/preferences', { cause1Id: PLAN_ID }],
  ['POST', '/subscriptions/checkout', { planId: PLAN_ID }],
  ['POST', '/subscriptions/tokens/purchase', { packageId: 'k1' }],
];

describe('API auth contract used by /pricing', () => {
  it.each([['/subscriptions/plans'], ['/subscriptions/token-packages']])('public %s needs no authentication', async (path) => {
    expect((await call(path)).status).toBe(200);
  });

  it.each(PROTECTED)('%s %s rejects a request with no Authorization header (refresh cookie alone is not a JWT)', async (method, path, body) => {
    expect((await call(path, { method, body, headers: REFRESH_COOKIE_ONLY })).status).toBe(401);
  });

  it.each(PROTECTED)('%s %s accepts a valid Bearer token', async (method, path, body) => {
    expect((await call(path, { method, body, headers: bearer(sign(WITH_PREF)) })).status).toBe(200);
  });

  it.each(PROTECTED)('%s %s rejects an expired Bearer token', async (method, path, body) => {
    expect((await call(path, { method, body, headers: bearer(sign(WITH_PREF, -10)) })).status).toBe(401);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = jwt.sign({ sub: WITH_PREF.id, email: WITH_PREF.email }, 'other-secret', { expiresIn: '15m' });
    expect((await call('/causes/preferences', { headers: bearer(forged) })).status).toBe(401);
  });

  it('GET /causes/preferences returns the saved record for a user with a preference', async () => {
    const r = await call('/causes/preferences', { headers: bearer(sign(WITH_PREF)) });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toMatchObject({ cause1Id: 'c1', cause2Id: null, randomDistribution: false });
  });

  it('GET /causes/preferences answers "no preference" as 200 with an EMPTY body (the web client relies on this)', async () => {
    const r = await call('/causes/preferences', { headers: bearer(sign(NO_PREF)) });
    expect(r.status).toBe(200);
    expect(r.text).toBe('');
  });

  it('POST /subscriptions/checkout passes the authenticated user and the unchanged planId to the service', async () => {
    const r = await call('/subscriptions/checkout', { method: 'POST', body: { planId: PLAN_ID }, headers: bearer(sign(WITH_PREF)) });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toEqual({ url: 'https://checkout.invalid/session' });
    expect(subscriptionsService.createCheckoutSession).toHaveBeenCalledWith(WITH_PREF.id, PLAN_ID);
  });

  it('POST /subscriptions/tokens/purchase passes the authenticated user and packageId to the service', async () => {
    await call('/subscriptions/tokens/purchase', { method: 'POST', body: { packageId: 'k1' }, headers: bearer(sign(WITH_PREF)) });
    expect(subscriptionsService.createTokenPackageSession).toHaveBeenCalledWith(WITH_PREF.id, 'k1');
  });

  it('checkout with a valid token but an unconfirmed email is 403 (not 401) and never reaches the service', async () => {
    const r = await call('/subscriptions/checkout', { method: 'POST', body: { planId: PLAN_ID }, headers: bearer(sign(UNCONFIRMED)) });
    expect(r.status).toBe(403);
    expect(subscriptionsService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('a token for a user that no longer exists is rejected', async () => {
    const ghost = { id: 'u-deleted', email: 'gone@test.invalid' };
    expect((await call('/subscriptions/me', { headers: bearer(sign(ghost)) })).status).toBe(401);
  });

  it('POST /causes/preferences with a second cause is rejected (PO-053) even when authenticated', async () => {
    const r = await call('/causes/preferences', {
      method: 'POST',
      body: { cause1Id: PLAN_ID, cause2Id: '9b2c1e0a-1d3e-4c5f-8a6b-7c8d9e0f1a2b' },
      headers: bearer(sign(NO_PREF)),
    });
    expect(r.status).toBe(400);
  });
});
