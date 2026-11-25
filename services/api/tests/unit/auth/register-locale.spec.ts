/**
 * NEM-025 B2-A2a — local registration language and account-email locale.
 *
 * Real EmailService with nodemailer mocked (no email is sent); users/tokens are in-memory fakes.
 * Scenario numbers refer to the PO authorization §5.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthService } from '../../../src/auth/auth.service';
import { AuthController } from '../../../src/auth/auth.controller';
import { UsersController } from '../../../src/users/users.controller';
import { EmailService } from '../../../src/email/email.service';
import { accountEmailLocale, FR_CA_TRANSACTIONAL_READY } from '../../../src/email/locale';
import { AuthProvider } from '../../../src/users/user.entity';

jest.mock('nodemailer');
jest.mock('bcrypt', () => ({ hash: jest.fn(async (p: string) => `hashed:${p}`), compare: jest.fn() }));

const mockSendMail = jest.fn();
const SRC = path.join(__dirname, '../../../src');
const savedGate = process.env.FR_CA_ENABLED;

beforeEach(() => {
  delete process.env.FR_CA_ENABLED;
  mockSendMail.mockReset().mockResolvedValue({});
  (nodemailer.createTransport as jest.Mock).mockReset().mockReturnValue({ sendMail: mockSendMail });
});
afterAll(() => {
  if (savedGate === undefined) delete process.env.FR_CA_ENABLED;
  else process.env.FR_CA_ENABLED = savedGate;
});

/** A tiny persisted-user store: the column default `es` applies only when the insert omits uiLanguage. */
function harness(existingEmail?: string) {
  const rows = new Map<string, Record<string, unknown>>();
  const users = {
    findByEmail: jest.fn(async (e: string) => (e === existingEmail ? { id: 'old', email: e } : null)),
    findByProvider: jest.fn(async () => null),
    findById: jest.fn(async (id: string) => rows.get(id) ?? null),
    create: jest.fn(async (data: Record<string, unknown>) => {
      const row = { id: `u-${rows.size + 1}`, uiLanguage: 'es', ...data };
      rows.set(row.id, row);
      return row;
    }),
    update: jest.fn(async () => undefined),
  };
  const tokens = {
    generateEmailConfirmToken: jest.fn(async () => 'tok-confirm'),
    generateAccessToken: jest.fn(() => 'access'),
    generateRefreshToken: jest.fn(async () => 'refresh-id'),
  };
  const auth = new AuthService(users as never, tokens as never, new EmailService());
  return { auth, users, rows, tokens };
}

const lastMail = () => mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1][0];

describe('local registration language (A2a-1)', () => {
  it('1. Spanish UI → stored es, Spanish confirmation', async () => {
    const { auth, users } = harness();
    const { user } = await auth.register('Ana', 'ana@example.com', 'password123', 'es');
    expect(users.create.mock.calls[0][0]).toMatchObject({ uiLanguage: 'es' });
    expect(user.uiLanguage).toBe('es');
    expect(lastMail().subject).toBe('Confirma tu cuenta en Noetia');
    expect(lastMail().html).toContain('<html lang="es">');
  });

  it('2. English UI → stored en, English confirmation', async () => {
    const { auth, users } = harness();
    const { user } = await auth.register('Ann', 'ann@example.com', 'password123', 'en');
    expect(users.create.mock.calls[0][0]).toMatchObject({ uiLanguage: 'en' });
    expect(user.uiLanguage).toBe('en');
    expect(lastMail().subject).toBe('Confirm your Noetia account');
    expect(lastMail().html).toContain('<html lang="en">');
  });

  it('the language is set on the create call itself, not by a later corrective update', async () => {
    const { auth, users } = harness();
    await auth.register('Ann', 'ann@example.com', 'password123', 'en');
    for (const [, patch] of users.update.mock.calls as unknown as [string, Record<string, unknown>][]) {
      expect(patch).not.toHaveProperty('uiLanguage');
    }
  });

  it('3. old client omits the language → registers, insert unchanged (column default es), Spanish email', async () => {
    const { auth, users } = harness();
    const { user, accessToken } = await auth.register('Bo', 'bo@example.com', 'password123');
    expect(accessToken).toBe('access');
    expect(users.create.mock.calls[0][0]).not.toHaveProperty('uiLanguage');
    expect(user.uiLanguage).toBe('es');
    expect(lastMail().subject).toBe('Confirma tu cuenta en Noetia');
  });

  it.each(['pt', 'EN', 'fr', 'es-MX', '', '<b>', null, 42])(
    '4. unsupported %p is rejected before any lookup: nothing stored, no email',
    async (v) => {
      const { auth, users } = harness();
      await expect(auth.register('X', 'x@example.com', 'password123', v as never)).rejects.toThrow(BadRequestException);
      expect(users.findByEmail).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
    },
  );

  it('5. fr-CA is rejected whatever the French gate says, including FR_CA_ENABLED=true (F-B2A2a-1)', async () => {
    for (const gate of [undefined, 'TRUE', '1', 'yes', 'true']) {
      if (gate === undefined) delete process.env.FR_CA_ENABLED;
      else process.env.FR_CA_ENABLED = gate;
      const { auth, users } = harness();
      await expect(auth.register('X', 'x@example.com', 'password123', 'fr-CA')).rejects.toThrow(
        'Unsupported interface language',
      );
      expect(users.create).not.toHaveBeenCalled();
    }
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('5b. with FR_CA_ENABLED=true: fr-CA → 400 before lookup, nothing stored, no email; es/en still work', async () => {
    process.env.FR_CA_ENABLED = 'true';
    expect(FR_CA_TRANSACTIONAL_READY).toBe(false);
    const rejected = harness();
    await expect(rejected.auth.register('X', 'x@example.com', 'password123', 'fr-CA')).rejects.toThrow(
      BadRequestException,
    );
    expect(rejected.users.findByEmail).not.toHaveBeenCalled();
    expect(rejected.users.create).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();

    for (const [lang, subject] of [['es', 'Confirma tu cuenta en Noetia'], ['en', 'Confirm your Noetia account']]) {
      const ok = harness();
      await ok.auth.register('X', `${lang}@example.com`, 'password123', lang);
      expect(ok.users.create.mock.calls[0][0]).toMatchObject({ uiLanguage: lang });
      expect(lastMail().subject).toBe(subject);
    }
  });

  it('5c. with FR_CA_ENABLED=true, omitting the language still registers in Spanish', async () => {
    process.env.FR_CA_ENABLED = 'true';
    const { auth, users } = harness();
    const { user } = await auth.register('Bo', 'bo@example.com', 'password123');
    expect(users.create.mock.calls[0][0]).not.toHaveProperty('uiLanguage');
    expect(user.uiLanguage).toBe('es');
    expect(lastMail().subject).toBe('Confirma tu cuenta en Noetia');
  });

  it('a language never bypasses the duplicate-email rule (same 409 as before)', async () => {
    const { auth, users } = harness('taken@example.com');
    await expect(auth.register('X', 'taken@example.com', 'password123', 'en')).rejects.toThrow(ConflictException);
    expect(users.create).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('a gated or unsupported language gives the same 400 for taken and free emails (no enumeration signal)', async () => {
    const taken = harness('taken@example.com');
    const free = harness();
    const a = await taken.auth.register('X', 'taken@example.com', 'password123', 'fr-CA').catch((e) => e);
    const b = await free.auth.register('X', 'free@example.com', 'password123', 'fr-CA').catch((e) => e);
    expect(a).toBeInstanceOf(BadRequestException);
    expect(b).toBeInstanceOf(BadRequestException);
    expect((a as BadRequestException).getResponse()).toEqual((b as BadRequestException).getResponse());
  });

  it('password hashing, token issuance and confirmation status are unchanged by the language', async () => {
    const { auth, users, tokens } = harness();
    await auth.register('Ann', 'ann@example.com', 'password123', 'en');
    expect(users.create.mock.calls[0][0]).toEqual({
      name: 'Ann',
      email: 'ann@example.com',
      passwordHash: 'hashed:password123',
      provider: AuthProvider.LOCAL,
      emailConfirmed: false,
      uiLanguage: 'en',
    });
    expect(tokens.generateAccessToken).toHaveBeenCalledWith({ sub: 'u-1', email: 'ann@example.com' });
    expect(tokens.generateEmailConfirmToken).toHaveBeenCalledWith('u-1');
  });
});

describe('controller and response contract (A2a-1, scenario 6)', () => {
  it('passes the DTO language to AuthService.register', async () => {
    const user = { id: 'u-1', email: 'a@example.com', name: 'A', userType: null, emailConfirmed: false, uiLanguage: 'en' };
    const authService = { register: jest.fn(async () => ({ accessToken: 'acc', refreshTokenId: 'rt', user })) };
    const controller = new AuthController(authService as never, {} as never, {} as never);
    await controller.register(
      { name: 'A', email: 'a@example.com', password: 'password123', uiLanguage: 'en' } as never,
      { headers: {} } as never,
      { cookie: jest.fn() } as never,
    );
    expect(authService.register).toHaveBeenCalledWith('A', 'a@example.com', 'password123', 'en');
  });

  it('6. the persisted preference is what GET /users/me reports after registration', async () => {
    const { auth, rows } = harness();
    const { user } = await auth.register('Ann', 'ann@example.com', 'password123', 'en');
    const usersService = { findById: jest.fn(async (id: string) => rows.get(id)) };
    const me = await new UsersController(usersService as never).getMe({ user: { id: user.id } });
    expect(me).toMatchObject({ uiLanguage: 'en' });
    expect(me).not.toHaveProperty('passwordHash');
  });
});

describe('existing-account security emails use the canonical resolver (A2a-2)', () => {
  it.each([
    ['es', 'es'],
    ['en', 'en'],
    ['fr-CA', 'es'],
    ['pt', 'es'],
    ['EN', 'es'],
    ['', 'es'],
    [null, 'es'],
    [undefined, 'es'],
    ['"><script>', 'es'],
  ])('accountEmailLocale(%p) → %p', (stored, expected) => {
    expect(accountEmailLocale(stored)).toBe(expected);
  });

  it('11. stored fr-CA stays Spanish even with the interface gate on (readiness constant false)', () => {
    expect(accountEmailLocale('fr-CA', { env: { FR_CA_ENABLED: 'true' } as NodeJS.ProcessEnv })).toBe('es');
  });

  it('no unsafe "as \'es\' | \'en\'" casts remain on the account paths', () => {
    for (const f of ['auth/auth.service.ts', 'users/users.service.ts']) {
      const src = fs.readFileSync(path.join(SRC, f), 'utf8');
      expect(src).not.toMatch(/uiLanguage as 'es' \| 'en'/);
      expect(src).toMatch(/accountEmailLocale\(user\.uiLanguage\)/);
    }
  });
});

describe('non-interference (scenarios 12–14)', () => {
  it('12. OAuth user creation is unchanged: no language field, provider-verified email', async () => {
    const { auth, users } = harness();
    await auth.upsertOAuthUser({ provider: AuthProvider.GOOGLE, providerId: 'g-1', email: 'g@example.com', name: 'G' });
    expect(users.create.mock.calls[0][0]).toEqual({
      provider: AuthProvider.GOOGLE,
      providerId: 'g-1',
      email: 'g@example.com',
      name: 'G',
      avatarUrl: null,
      emailConfirmed: true,
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('12. OAuth method arities are unchanged', () => {
    const p = AuthService.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    expect(p.upsertOAuthUser.length).toBe(1);
    expect(p.verifyGoogleIdToken.length).toBe(1);
    expect(p.verifyFacebookToken.length).toBe(1);
    expect(p.verifyAppleIdentityToken.length).toBe(2);
  });

  it('13. gift, waitlist and subscription callers do not use the account-email resolver', () => {
    for (const f of ['gifts/gifts.service.ts', 'waitlist/waitlist.service.ts', 'subscriptions/subscriptions.service.ts', 'email/email.service.ts']) {
      const src = fs.readFileSync(path.join(SRC, f), 'utf8');
      expect(src).not.toMatch(/accountEmailLocale|resolveMessageLocale/);
    }
  });

  it('14. no external email: the SMTP transport is the jest mock', () => {
    expect(jest.isMockFunction(nodemailer.createTransport)).toBe(true);
  });
});
