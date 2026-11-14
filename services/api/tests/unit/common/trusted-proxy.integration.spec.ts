// G1-I1 trusted proxy — in-process HTTP integration (design §10 fixture "H").
// REAL: applyTrustedProxy (same call as main.ts), Express trust evaluation, @nestjs/throttler 6.5.0 with the API's
// 'global' throttler (120/min), the real CheckoutStatusController (@Throttle 30/min) + JwtStrategy + JwtAuthGuard.
// The server listens like main.ts (no host → dual-stack `::`), so IPv4 clients appear as `::ffff:a.b.c.d`.
// Clients originate from distinct loopback addresses (Linux routes all of 127/8 to `lo`):
//   127.0.0.2 = "Traefik" (the trusted peer), 127.0.0.3 = an internal container calling the API directly.
// MOCKED: Stripe (never reached: malformed session ids are rejected before any Stripe call) and repositories.
import http from 'http';
import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { SkipThrottle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as jwt from 'jsonwebtoken';
import { JwtStrategy } from '../../../src/auth/jwt.strategy';
import { applyTrustedProxy } from '../../../src/common/trusted-proxy';
import { UserBook } from '../../../src/library/user-book.entity';
import { CheckoutStatusController } from '../../../src/subscriptions/checkout-status.controller';
import { CheckoutStatusService } from '../../../src/subscriptions/checkout-status.service';
import { StripeProcessedEvent } from '../../../src/subscriptions/stripe-processed-event.entity';
import { Subscription } from '../../../src/subscriptions/subscription.entity';
import { UsersService } from '../../../src/users/users.service';

const stripeRetrieve = jest.fn();
jest.mock('stripe', () => jest.fn().mockImplementation(() => ({ checkout: { sessions: { retrieve: stripeRetrieve } } })));

@Controller('diag')
class DiagController {
  @Get('whoami') @SkipThrottle({ global: true })
  whoami(@Req() req: any) { return { ip: req.ip, socket: req.socket.remoteAddress }; }
  @Get('other') // inherits the global 120/min like every other API route
  other() { return { ok: true }; }
}

const SECRET = 'trusted-proxy-integration-secret';
const USER = { id: 'u-1', email: 'u1@test.invalid', emailConfirmed: true, stripeCustomerId: 'cus_1' };
const STATUS = '/subscriptions/checkout-sessions/not-a-session/status'; // malformed → 404 without Stripe
const TRAEFIK = '127.0.0.2';
const INTERNAL = '127.0.0.3';
const quiet = { log: () => undefined, warn: () => undefined };

let app: INestApplication;
let port: number;
const previousSecret = process.env.JWT_SECRET;

async function boot(trustedCidrs: string | undefined) {
  process.env.JWT_SECRET = SECRET;
  const moduleRef = await Test.createTestingModule({
    imports: [PassportModule, ThrottlerModule.forRoot([{ name: 'global', ttl: 60_000, limit: 120 }])], // = app.module.ts
    controllers: [CheckoutStatusController, DiagController],
    providers: [
      JwtStrategy,
      CheckoutStatusService,
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: ConfigService, useValue: { get: () => 'sk_test_integration' } },
      { provide: UsersService, useValue: { findById: async (id: string) => (id === USER.id ? USER : null) } },
      { provide: getRepositoryToken(Subscription), useValue: { findOneBy: jest.fn() } },
      { provide: getRepositoryToken(UserBook), useValue: { countBy: jest.fn() } },
      { provide: getRepositoryToken(StripeProcessedEvent), useValue: { countBy: jest.fn() } },
    ],
  }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  applyTrustedProxy(app as NestExpressApplication, trustedCidrs, quiet); // exactly as main.ts
  await app.listen(0); // like main.ts: no host → dual-stack
  port = (app.getHttpServer().address() as { port: number }).port;
}

afterEach(async () => {
  await app?.close();
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

type Res = { status: number; body: string; headers: http.IncomingHttpHeaders };
function call(path: string, opts: { from: string; host?: string; xff?: string; token?: string }): Promise<Res> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (opts.xff !== undefined) headers['X-Forwarded-For'] = opts.xff;
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const req = http.request({ host: opts.host ?? '127.0.0.1', port, path, localAddress: opts.from, headers, agent: false }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode!, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}
async function burst(n: number, path: string, opts: (i: number) => { from: string; host?: string; xff?: string; token?: string }) {
  const out: Res[] = [];
  for (let i = 1; i <= n; i++) out.push(await call(path, opts(i))); // sequential, like real polling
  return out;
}
const statuses = (rs: Res[]) => rs.map((r) => r.status);
const whoami = async (opts: { from: string; host?: string; xff?: string }) => JSON.parse((await call('/diag/whoami', opts)).body);
const token = () => jwt.sign({ sub: USER.id, email: USER.email }, SECRET, { expiresIn: '15m' });
const TOKEN = token();

describe('trusted peer (Traefik) → per-client attribution', () => {
  beforeEach(() => boot(`${TRAEFIK}/32`));

  it('T-I1-01: two external clients behind the trusted peer get independent 30/min buckets', async () => {
    const a = await burst(30, STATUS, () => ({ from: TRAEFIK, xff: '203.0.113.10', token: TOKEN }));
    const b = await burst(30, STATUS, () => ({ from: TRAEFIK, xff: '203.0.113.20', token: TOKEN }));
    expect(statuses(a).every((s) => s === 404)).toBe(true); // reached the route: not throttled
    expect(statuses(b).every((s) => s === 404)).toBe(true); // B unaffected by A's 30
    expect((await call(STATUS, { from: TRAEFIK, xff: '203.0.113.10', token: TOKEN })).status).toBe(429); // A's own 31st
  });

  it('T-I1-02: per-client exhaustion — 1–30 pass, the 31st is 429; headers track the client\'s own bucket', async () => {
    const rs = await burst(31, STATUS, () => ({ from: TRAEFIK, xff: '198.51.100.7', token: TOKEN }));
    expect(statuses(rs).slice(0, 30).every((s) => s === 404)).toBe(true);
    expect(rs[30].status).toBe(429);
    expect(rs.slice(0, 30).map((r) => Number(r.headers['x-ratelimit-remaining-global']))).toEqual(Array.from({ length: 30 }, (_, i) => 29 - i));
    expect(rs[0].headers['x-ratelimit-limit-global']).toBe('30');
    expect(Number(rs[30].headers['retry-after-global'])).toBeGreaterThan(0);
  });

  it('req.ip is the forwarded client; with several entries only the RIGHTMOST (the one Traefik appends) is used', async () => {
    expect(await whoami({ from: TRAEFIK, xff: '203.0.113.10' })).toEqual({ ip: '203.0.113.10', socket: `::ffff:${TRAEFIK}` });
    expect((await whoami({ from: TRAEFIK, xff: '6.6.6.6, 203.0.113.10' })).ip).toBe('203.0.113.10');
  });

  it('no X-Forwarded-For from the trusted peer → attributed to the peer itself', async () => {
    expect((await whoami({ from: TRAEFIK })).ip).toBe(`::ffff:${TRAEFIK}`);
  });

  it('the 120/min routes are per client too (and a separate bucket from the 30/min route)', async () => {
    await burst(30, STATUS, () => ({ from: TRAEFIK, xff: '203.0.113.10', token: TOKEN }));
    const other = await burst(60, '/diag/other', () => ({ from: TRAEFIK, xff: '203.0.113.10' }));
    expect(statuses(other).every((s) => s === 200)).toBe(true);
    expect(other[0].headers['x-ratelimit-limit-global']).toBe('120');
  });
});

describe('T-I1-04: direct internal access (the Checkpoint I E5 regression)', () => {
  beforeEach(() => boot(`${TRAEFIK}/32`));

  it('an untrusted peer\'s X-Forwarded-For is ignored: req.ip = its TCP address', async () => {
    expect(await whoami({ from: INTERNAL, xff: '203.0.113.99' })).toEqual({ ip: `::ffff:${INTERNAL}`, socket: `::ffff:${INTERNAL}` });
    expect((await whoami({ from: INTERNAL, xff: `${TRAEFIK}, 203.0.113.99` })).ip).toBe(`::ffff:${INTERNAL}`);
  });

  it('rotating forged headers cannot evade the limit: the 31st is 429', async () => {
    const rs = await burst(31, STATUS, (i) => ({ from: INTERNAL, xff: `8.8.8.${i}`, token: TOKEN }));
    expect(statuses(rs).slice(0, 30).every((s) => s === 404)).toBe(true);
    expect(rs[30].status).toBe(429);
  });

  it('an internal peer cannot consume an external client\'s allowance by forging that client\'s address', async () => {
    await burst(31, STATUS, () => ({ from: INTERNAL, xff: '203.0.113.10', token: TOKEN }));
    const real = await burst(30, STATUS, () => ({ from: TRAEFIK, xff: '203.0.113.10', token: TOKEN }));
    expect(statuses(real).every((s) => s === 404)).toBe(true);
  });
});

describe('T-I1-08: stale or invalid configuration fails safe (immediate-peer tracking)', () => {
  it('a valid range that excludes the actual proxy peer → forwarded headers ignored → shared bucket', async () => {
    await boot('127.0.0.9/32');
    expect((await whoami({ from: TRAEFIK, xff: '203.0.113.10' })).ip).toBe(`::ffff:${TRAEFIK}`);
    await burst(20, STATUS, () => ({ from: TRAEFIK, xff: '203.0.113.10', token: TOKEN }));
    const b = await burst(11, STATUS, () => ({ from: TRAEFIK, xff: '203.0.113.20', token: TOKEN }));
    expect(b[10].status).toBe(429); // 31st overall: the pre-G1-I1 shared-bucket behaviour, never wider trust
  });

  it.each([undefined, '', 'true', 'loopback', 'uniquelocal', '1', '10.0.0.0/8', '127.0.0.0/8', 'nonsense'])(
    'TRUSTED_PROXY_CIDRS=%p → the app boots and trusts nobody', async (raw) => {
      await boot(raw);
      expect((await whoami({ from: TRAEFIK, xff: '203.0.113.10' })).ip).toBe(`::ffff:${TRAEFIK}`);
      expect((await whoami({ from: INTERNAL, xff: '203.0.113.10' })).ip).toBe(`::ffff:${INTERNAL}`);
    });
});

describe('T-I1-09: IPv4 / IPv6 peers on the dual-stack listener', () => {
  beforeEach(() => boot(`${TRAEFIK}/32`));

  it('an IPv4-mapped peer (::ffff:127.0.0.2) matches the IPv4 CIDR 127.0.0.2/32', async () => {
    const r = await whoami({ from: TRAEFIK, xff: '203.0.113.10' });
    expect(r.socket).toBe(`::ffff:${TRAEFIK}`);
    expect(r.ip).toBe('203.0.113.10');
  });

  it('an IPv6 peer (::1) does not match an IPv4 range: its forwarded header is ignored', async () => {
    const r = await whoami({ from: '::1', host: '::1', xff: '203.0.113.10' });
    expect(r).toEqual({ ip: '::1', socket: '::1' });
  });

  it('an IPv6 client address forwarded by the trusted peer becomes the tracker (documented: per-/128)', async () => {
    expect((await whoami({ from: TRAEFIK, xff: '2001:db8::42' })).ip).toBe('2001:db8::42');
  });
});

describe('T-I1-10: authentication is independent of forwarded-header trust', () => {
  beforeEach(() => boot(`${TRAEFIK}/32`));

  it.each([
    ['trusted peer, forged client', TRAEFIK, '203.0.113.10'],
    ['trusted peer, claims to be the proxy itself', TRAEFIK, TRAEFIK],
    ['untrusted peer, forged client', INTERNAL, '203.0.113.10'],
    ['untrusted peer, claims loopback', INTERNAL, '127.0.0.1'],
  ])('%s → still 401 without a JWT', async (_l, from, xff) => {
    expect((await call('/subscriptions/checkout-sessions/cs_test_a1B2c3D4e5F6g7H8i9J0/status', { from, xff })).status).toBe(401);
  });

  it('a valid JWT is required and sufficient exactly as before (malformed id → uniform 404, no Stripe call)', async () => {
    const r = await call(STATUS, { from: TRAEFIK, xff: '203.0.113.10', token: token() });
    expect(r.status).toBe(404);
    expect(JSON.parse(r.body)).toEqual({ error: 'checkout_session_not_found' });
    expect(r.headers['cache-control']).toBe('no-store');
    expect(stripeRetrieve).not.toHaveBeenCalled();
  });
});
