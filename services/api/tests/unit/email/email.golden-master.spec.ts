/**
 * NEM-025 Checkpoint B2-A1 — EmailService golden master.
 *
 * Captured on the UNCHANGED pre-refactor EmailService (Checkpoint A, 8114379) and committed before any
 * implementation change. The refactor must reproduce every snapshot byte for byte: sender, recipient,
 * subject and HTML for all eight templates, in Spanish, English and the default (no `lang`) form,
 * plus name / gift / token-count / message / occasion / escaping / Unicode variations.
 *
 * Nodemailer is mocked (no email is ever sent) and the clock is frozen (the footer prints the year).
 */
import * as nodemailer from 'nodemailer';
import { Logger } from '@nestjs/common';
import { EmailService } from '../../../src/email/email.service';

jest.mock('nodemailer');

const mockSendMail = jest.fn();
const mockCreateTransport = nodemailer.createTransport as jest.Mock;

type Lang = 'es' | 'en' | undefined;
const LANGS: Lang[] = ['es', 'en', undefined];
const label = (l: Lang) => l ?? 'default';

// Hostile and Unicode inputs used for the escaping fixtures.
const HOSTILE_NAME = `Ana & <b>"Bo"</b> 'C'`;
const HOSTILE_MESSAGE = `<script>alert("x")</script> & más 'gracias'`;
const HOSTILE_OCCASION = '🎂 <i>Cumpleaños</i> & más';
const HOSTILE_PLAN = 'Duo & <Family> "Plus"';
const HOSTILE_EMAIL = 'a&b<c>@example.com';
const UNICODE_NAME = 'José Ñúñez — 李小龍 ’«»';

const ENV_KEYS = ['SMTP_FROM', 'WEB_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS'] as const;
let savedEnv: Record<string, string | undefined>;

function lastMail() {
  expect(mockSendMail).toHaveBeenCalledTimes(1);
  return mockSendMail.mock.calls[0][0];
}

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
  mockCreateTransport.mockReset().mockReturnValue({ sendMail: mockSendMail });
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('EmailService golden master (B2-A1)', () => {
  describe.each(LANGS)('lang=%s', (lang) => {
    let svc: EmailService;
    beforeEach(() => { svc = new EmailService(); });

    it('confirmation', async () => {
      await svc.sendEmailConfirmation('reader@example.com', 'Ana', 'tok-confirm-123', lang as any);
      expect(lastMail()).toMatchSnapshot(`confirmation/${label(lang)}`);
    });

    it('password reset', async () => {
      await svc.sendPasswordReset('reader@example.com', 'Ana', 'tok-reset-456', lang as any);
      expect(lastMail()).toMatchSnapshot(`password-reset/${label(lang)}`);
    });

    it('farewell', async () => {
      await svc.sendFarewell('reader@example.com', 'Ana', lang as any);
      expect(lastMail()).toMatchSnapshot(`farewell/${label(lang)}`);
    });

    it('waitlist confirmation', async () => {
      await svc.sendWaitlistConfirmation('reader@example.com', 'Ana', lang as any);
      expect(lastMail()).toMatchSnapshot(`waitlist-confirmation/${label(lang)}`);
    });

    it('waitlist invite (email with + is URL-encoded in the link)', async () => {
      await svc.sendWaitlistInvite('lector+beta@example.com', 'Ana', lang as any);
      expect(lastMail()).toMatchSnapshot(`waitlist-invite/${label(lang)}`);
    });

    it.each([
      ['1-token+message+occasion', 1, 'Feliz cumpleaños', '🎂 Cumpleaños'],
      ['3-tokens-plain', 3, null, null],
      ['1-token+message', 1, 'Para ti', null],
      ['3-tokens+occasion', 3, null, '🎓 Graduación'],
    ] as const)('gift card %s', async (variant, count, message, occasion) => {
      await svc.sendGiftCard('friend@example.com', 'Bruno', count, message, occasion, 'claim-tok-789', lang as any);
      expect(lastMail()).toMatchSnapshot(`gift-card/${variant}/${label(lang)}`);
    });

    it.each([[1], [3]])('gift confirmation %i token(s)', async (count) => {
      await svc.sendGiftConfirmation('buyer@example.com', 'Bruno', 'friend@example.com', count, lang as any);
      expect(lastMail()).toMatchSnapshot(`gift-confirmation/${count}/${label(lang)}`);
    });

    it('plan invite', async () => {
      await svc.sendPlanInvite('invitee@example.com', 'Carla', 'Duo', 'invite-tok-321', lang as any);
      expect(lastMail()).toMatchSnapshot(`plan-invite/${label(lang)}`);
    });

    it('escaping: hostile user values in every template', async () => {
      const out: Record<string, unknown> = {};
      const run = async (key: string, fn: () => Promise<void>) => {
        mockSendMail.mockClear();
        await fn();
        out[key] = lastMail();
      };
      await run('confirmation', () => svc.sendEmailConfirmation('r@example.com', HOSTILE_NAME, 't', lang as any));
      await run('password-reset', () => svc.sendPasswordReset('r@example.com', HOSTILE_NAME, 't', lang as any));
      await run('farewell', () => svc.sendFarewell('r@example.com', HOSTILE_NAME, lang as any));
      await run('waitlist-confirmation', () => svc.sendWaitlistConfirmation('r@example.com', HOSTILE_NAME, lang as any));
      await run('waitlist-invite', () => svc.sendWaitlistInvite('r&x@example.com', HOSTILE_NAME, lang as any));
      await run('gift-card', () =>
        svc.sendGiftCard('f@example.com', HOSTILE_NAME, 3, HOSTILE_MESSAGE, HOSTILE_OCCASION, 'c', lang as any));
      await run('gift-confirmation', () =>
        svc.sendGiftConfirmation('b@example.com', HOSTILE_NAME, HOSTILE_EMAIL, 1, lang as any));
      await run('plan-invite', () => svc.sendPlanInvite('i@example.com', HOSTILE_NAME, HOSTILE_PLAN, 't', lang as any));
      expect(out).toMatchSnapshot(`escaping/${label(lang)}`);
    });

    it('unicode names and messages pass through unchanged', async () => {
      await svc.sendGiftCard('f@example.com', UNICODE_NAME, 1, 'Ça va? — ¡Qué bien! 📚', null, 'c', lang as any);
      expect(lastMail()).toMatchSnapshot(`unicode/${label(lang)}`);
    });
  });

  describe('transport and sender', () => {
    it('defaults sender, web URL and transport when env is unset', async () => {
      for (const k of ENV_KEYS) delete process.env[k];
      const svc = new EmailService();
      await svc.sendEmailConfirmation('r@example.com', 'Ana', 'tok');
      expect(mockCreateTransport.mock.calls[0][0]).toMatchSnapshot('transport/defaults');
      expect(lastMail()).toMatchSnapshot('confirmation/env-defaults');
    });

    it('configured SMTP auth and secure transport', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'secret-pass';
      new EmailService();
      expect(mockCreateTransport.mock.calls[0][0]).toMatchSnapshot('transport/configured');
    });

    it('SMTP user without password uses empty password', () => {
      process.env.SMTP_USER = 'user';
      new EmailService();
      expect(mockCreateTransport.mock.calls[0][0].auth).toEqual({ user: 'user', pass: '' });
    });

    it('a transport failure is swallowed and logged once, with no token or HTML in the log', async () => {
      const errSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      mockSendMail.mockRejectedValueOnce(new Error('SMTP down'));
      const svc = new EmailService();
      await expect(svc.sendPasswordReset('r@example.com', 'Ana', 'secret-reset-token', 'en')).resolves.toBeUndefined();
      expect(errSpy).toHaveBeenCalledTimes(1);
      const logged = errSpy.mock.calls[0].map(String).join(' ');
      expect(logged).toMatchSnapshot('transport/failure-log');
      expect(logged).not.toContain('secret-reset-token');
      expect(logged).not.toContain('<html');
      errSpy.mockRestore();
    });
  });
});
