/**
 * NEM-025 B2-A2a — account-email golden master (captured on the UNCHANGED code, B2-A1 head 0f14735).
 *
 * Drives the real EmailService through the four authorized account paths (local registration, resend
 * confirmation, password reset, account-deletion farewell) with a mocked transport and frozen clock, and
 * records the complete message for every VALID stored preference (`es`, `en`) plus registration from a
 * client that sends no language. B2-A2a must reproduce every snapshot byte for byte.
 *
 * The `pre-correction record` block pins today's behaviour for INVALID or gated stored values. B2-A2a is
 * authorized to change exactly that behaviour (N-1: Spanish body + canonical `lang="es"`); the change
 * must appear as an explicit edit of those expectations, never as a regenerated snapshot.
 *
 * Nodemailer is mocked: no email is ever sent.
 */
import * as nodemailer from 'nodemailer';
import { AuthService } from '../../../src/auth/auth.service';
import { AuthController } from '../../../src/auth/auth.controller';
import { UsersService } from '../../../src/users/users.service';
import { EmailService } from '../../../src/email/email.service';
import { AuthProvider } from '../../../src/users/user.entity';

jest.mock('nodemailer');
jest.mock('bcrypt', () => ({ hash: jest.fn(async (p: string) => `hashed:${p}`), compare: jest.fn() }));

const mockSendMail = jest.fn();
const ENV_KEYS = ['SMTP_FROM', 'WEB_URL', 'FR_CA_ENABLED'] as const;
let savedEnv: Record<string, string | undefined>;

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(new Date('2026-06-15T12:00:00Z'));
});
afterAll(() => jest.useRealTimers());

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.SMTP_FROM = 'Noetia <noreply@noetia.app>';
  process.env.WEB_URL = 'https://noetia.test';
  mockSendMail.mockReset().mockResolvedValue({ messageId: 'gm' });
  (nodemailer.createTransport as jest.Mock).mockReset().mockReturnValue({ sendMail: mockSendMail });
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function lastMail() {
  expect(mockSendMail).toHaveBeenCalledTimes(1);
  return mockSendMail.mock.calls[0][0];
}

/** Real EmailService + AuthService over in-memory user/token fakes. `stored` is the user's uiLanguage. */
function harness(stored?: unknown) {
  const email = new EmailService();
  const created: Record<string, unknown>[] = [];
  const existing = {
    id: 'u-1', email: 'reader@example.com', name: 'Ana', provider: AuthProvider.LOCAL,
    emailConfirmed: false, uiLanguage: stored,
  };
  const users = {
    findByEmail: jest.fn(async (e: string) => (e === existing.email ? existing : null)),
    findById: jest.fn(async () => existing),
    create: jest.fn(async (data: Record<string, unknown>) => {
      created.push(data);
      // The column default ('es') applies only when the insert carries no uiLanguage.
      return { id: 'u-new', uiLanguage: 'es', ...data };
    }),
    update: jest.fn(async () => undefined),
  };
  const tokens = {
    generateEmailConfirmToken: jest.fn(async () => 'tok-confirm'),
    generatePasswordResetToken: jest.fn(async () => 'tok-reset'),
    generateAccessToken: jest.fn(() => 'access'),
    generateRefreshToken: jest.fn(async () => 'refresh-id'),
  };
  const auth = new AuthService(users as never, tokens as never, email);
  return { auth, users, created, existing, email };
}

function usersServiceWith(user: Record<string, unknown>) {
  const repo = { findOneBy: jest.fn(async () => user), delete: jest.fn(async () => undefined) };
  const dataSource = { manager: { query: jest.fn(async () => undefined) } };
  return new UsersService(repo as never, dataSource as never, new EmailService());
}

describe('B2-A2a golden master — valid preferences (must stay byte-identical)', () => {
  it('local registration from a client that sends no language', async () => {
    const { auth, created } = harness();
    await auth.register('Bruno', 'new@example.com', 'password123');
    expect(created).toMatchSnapshot('register/omitted/create');
    expect(lastMail()).toMatchSnapshot('register/omitted/email');
  });

  it.each(['es', 'en'])('resend confirmation, stored %s', async (lang) => {
    const { auth } = harness(lang);
    await auth.resendConfirmation('u-1');
    expect(lastMail()).toMatchSnapshot(`resend/${lang}`);
  });

  it.each(['es', 'en'])('password reset, stored %s', async (lang) => {
    const { auth } = harness(lang);
    await auth.requestPasswordReset('reader@example.com');
    expect(lastMail()).toMatchSnapshot(`password-reset/${lang}`);
  });

  it.each(['es', 'en'])('account-deletion farewell, stored %s', async (lang) => {
    await usersServiceWith({ id: 'u-1', email: 'reader@example.com', name: 'Ana', uiLanguage: lang }).deleteAccount('u-1');
    expect(lastMail()).toMatchSnapshot(`farewell/${lang}`);
  });

  it.each(['es', 'en'])('account-deletion farewell without a name, stored %s', async (lang) => {
    await usersServiceWith({ id: 'u-1', email: 'reader@example.com', name: null, uiLanguage: lang }).deleteAccount('u-1');
    expect(lastMail()).toMatchSnapshot(`farewell/no-name/${lang}`);
  });

  it.each([
    ['web', {}],
    ['mobile', { 'x-client-type': 'mobile' }],
  ])('registration response body (%s)', async (_label, headers) => {
    const user = { id: 'u-new', email: 'new@example.com', name: 'Bruno', userType: null, emailConfirmed: false, uiLanguage: 'es', passwordHash: 'x' };
    const authService = { register: jest.fn(async () => ({ accessToken: 'access', refreshTokenId: 'refresh-id', user })) };
    const controller = new AuthController(authService as never, {} as never, {} as never);
    const res = { cookie: jest.fn() };
    const out = await controller.register(
      { name: 'Bruno', email: 'new@example.com', password: 'password123' } as never,
      { headers } as never,
      res as never,
    );
    expect(out).toMatchSnapshot();
  });
});

describe('B2-A2a pre-correction record — invalid or gated stored values', () => {
  // Captured on unchanged code. N-1 (B2-D4) is authorized to change these expectations.
  const INVALID = ['pt', 'EN', 'fr', '', 'fr-CA'];

  it.each(INVALID)('resend confirmation, stored %p: Spanish body, raw lang attribute', async (v) => {
    const { auth } = harness(v);
    await auth.resendConfirmation('u-1');
    const { subject, html } = lastMail();
    expect(subject).toBe('Confirma tu cuenta en Noetia');
    expect(html).toContain(`<html lang="${v}">`);
  });

  it.each(INVALID)('password reset, stored %p: Spanish body, raw lang attribute', async (v) => {
    const { auth } = harness(v);
    await auth.requestPasswordReset('reader@example.com');
    const { subject, html } = lastMail();
    expect(subject).toBe('Recupera tu contraseña en Noetia');
    expect(html).toContain(`<html lang="${v}">`);
  });

  it.each(INVALID)('farewell, stored %p: Spanish body, raw lang attribute', async (v) => {
    await usersServiceWith({ id: 'u-1', email: 'reader@example.com', name: 'Ana', uiLanguage: v }).deleteAccount('u-1');
    const { subject, html } = lastMail();
    expect(subject).toBe('Tu cuenta de Noetia ha sido eliminada');
    expect(html).toContain(`<html lang="${v}">`);
  });

  it('registration ignores the client language: nothing is stored and the email is Spanish', async () => {
    const { auth, created } = harness();
    await (auth.register as (...a: unknown[]) => Promise<unknown>)('Bruno', 'new@example.com', 'password123', 'en');
    expect(created[0]).not.toHaveProperty('uiLanguage');
    expect(lastMail().subject).toBe('Confirma tu cuenta en Noetia');
  });
});
