import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EmailService } from '../../../src/email/email.service';
import * as nodemailer from 'nodemailer';

// Transport is fully mocked: no SMTP connection is ever opened and no email leaves the process.
jest.mock('nodemailer');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockCreateTransport = nodemailer.createTransport as jest.Mock;

const SMTP_ENV = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'WEB_URL'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const k of SMTP_ENV) savedEnv[k] = process.env[k];
});

beforeEach(() => {
  for (const k of SMTP_ENV) delete process.env[k];
  mockCreateTransport.mockReset();
  mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
  mockSendMail.mockReset();
  mockSendMail.mockResolvedValue({ messageId: 'test-id' });
});

afterAll(() => {
  for (const k of SMTP_ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

async function build(): Promise<EmailService> {
  const module: TestingModule = await Test.createTestingModule({ providers: [EmailService] }).compile();
  return module.get(EmailService);
}

/** The single message handed to the (mocked) transport by the last call. */
function sent(): { from: string; to: string; subject: string; html: string } {
  expect(mockSendMail).toHaveBeenCalledTimes(1);
  return mockSendMail.mock.calls[0][0];
}

const YEAR = new Date().getFullYear();
const FOOTER = { en: `© ${YEAR} Noetia. All rights reserved.`, es: `© ${YEAR} Noetia. Todos los derechos reservados.` };
const TAGLINE = { en: 'Read. Listen. Share.', es: 'Lee. Escucha. Comparte.' };

describe('EmailService', () => {
  describe('transport and sender configuration', () => {
    it('uses the local Mailhog defaults with no auth when SMTP env is unset', async () => {
      await build();
      expect(mockCreateTransport).toHaveBeenCalledWith({ host: 'mailhog', port: 1025, secure: false });
    });

    it('uses SMTP_* env, enables TLS only for SMTP_SECURE="true", and adds auth when SMTP_USER is set', async () => {
      Object.assign(process.env, {
        SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465', SMTP_SECURE: 'true',
        SMTP_USER: 'mailer', SMTP_PASS: 'synthetic-pass',
      });
      await build();
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.example.test', port: 465, secure: true,
        auth: { user: 'mailer', pass: 'synthetic-pass' },
      });
    });

    it('defaults the password to an empty string when only SMTP_USER is set, and treats other SMTP_SECURE values as false', async () => {
      Object.assign(process.env, { SMTP_USER: 'mailer', SMTP_SECURE: 'yes' });
      await build();
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'mailhog', port: 1025, secure: false, auth: { user: 'mailer', pass: '' },
      });
    });

    it('sends from SMTP_FROM and builds links from WEB_URL when configured', async () => {
      Object.assign(process.env, { SMTP_FROM: 'Noetia Test <test@noetia.test>', WEB_URL: 'https://app.noetia.test' });
      const service = await build();
      await service.sendEmailConfirmation('reader@example.test', 'Ana', 'tok1');
      const msg = sent();
      expect(msg.from).toBe('Noetia Test <test@noetia.test>');
      expect(msg.html).toContain('href="https://app.noetia.test/confirm-email?token=tok1"');
    });

    it('falls back to the default sender and localhost web URL', async () => {
      const service = await build();
      await service.sendEmailConfirmation('reader@example.test', 'Ana', 'tok1');
      const msg = sent();
      expect(msg.from).toBe('Noetia <noreply@noetia.app>');
      expect(msg.html).toContain('http://localhost:3000/confirm-email?token=tok1');
    });
  });

  describe('delivery failures', () => {
    it.each([
      ['sendEmailConfirmation', (s: EmailService) => s.sendEmailConfirmation('reader@example.test', 'Ana', 'tok')],
      ['sendPasswordReset', (s: EmailService) => s.sendPasswordReset('reader@example.test', 'Ana', 'tok')],
    ])('%s swallows transport errors and logs the failure reason instead of throwing', async (_name, call) => {
      const service = await build();
      const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      mockSendMail.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(call(service)).resolves.toBeUndefined();

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('SMTP down');
      logSpy.mockRestore();
    });
  });

  // ── One block per transactional email: exact EN/ES copy, links, language attribute, escaping ──
  describe('sendEmailConfirmation', () => {
    let service: EmailService;
    beforeEach(async () => { service = await build(); });

    it('defaults to Spanish with the exact approved copy and the confirmation link', async () => {
      await service.sendEmailConfirmation('reader@example.test', 'Carlos', 'abc123token');
      const { to, subject, html } = sent();
      expect(to).toBe('reader@example.test');
      expect(subject).toBe('Confirma tu cuenta en Noetia');
      expect(html).toContain('<html lang="es">');
      expect(html).toContain(TAGLINE.es);
      expect(html).toContain('¡Bienvenido/a, Carlos!');
      expect(html).toContain('Gracias por crear tu cuenta. Confirma tu dirección de correo para comenzar a leer, escuchar y compartir fragmentos.');
      expect(html).toContain('<a href="http://localhost:3000/confirm-email?token=abc123token"');
      expect(html).toContain('>Confirmar mi cuenta</a>');
      expect(html).toContain('Si el botón no funciona, copia este enlace en tu navegador:');
      expect(html).toContain('Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.');
      expect(html).toContain(FOOTER.es);
      expect(html).not.toContain('Confirm my account');
    });

    it('renders the exact English copy when lang is "en"', async () => {
      await service.sendEmailConfirmation('reader@example.test', 'Carlos', 'abc123token', 'en');
      const { subject, html } = sent();
      expect(subject).toBe('Confirm your Noetia account');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain(TAGLINE.en);
      expect(html).toContain('Welcome, Carlos!');
      expect(html).toContain('Thank you for creating your account. Confirm your email address to start reading, listening, and sharing fragments.');
      expect(html).toContain('>Confirm my account</a>');
      expect(html).toContain("If the button doesn't work, copy this link into your browser:");
      expect(html).toContain("This link expires in 24 hours. If you didn't create this account, you can ignore this email.");
      expect(html).toContain(FOOTER.en);
      expect(html).not.toContain('Confirmar mi cuenta');
    });

    it('escapes HTML in the user name', async () => {
      await service.sendEmailConfirmation('reader@example.test', '<script>alert(1)</script>', 'tok');
      const { html } = sent();
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });

  describe('sendPasswordReset', () => {
    let service: EmailService;
    beforeEach(async () => { service = await build(); });

    it('defaults to Spanish with the exact copy and reset link', async () => {
      await service.sendPasswordReset('reader@example.test', 'Carlos', 'resettoken123');
      const { to, subject, html } = sent();
      expect(to).toBe('reader@example.test');
      expect(subject).toBe('Recupera tu contraseña en Noetia');
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('Hola, Carlos');
      expect(html).toContain('Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva.');
      expect(html).toContain('<a href="http://localhost:3000/reset-password?token=resettoken123"');
      expect(html).toContain('>Restablecer contraseña</a>');
      expect(html).toContain('Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje — tu contraseña no será modificada.');
      expect(html).toContain(FOOTER.es);
    });

    it('renders the exact English copy', async () => {
      await service.sendPasswordReset('reader@example.test', 'Carlos', 'resettoken123', 'en');
      const { subject, html } = sent();
      expect(subject).toBe('Reset your Noetia password');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain(TAGLINE.en);
      expect(html).toContain('Hi, Carlos');
      expect(html).toContain('We received a request to reset your account password. Click the button below to create a new one.');
      expect(html).toContain('>Reset password</a>');
      expect(html).toContain("If the button doesn't work, copy this link into your browser:");
      expect(html).toContain("This link expires in 1 hour. If you didn't request this change, you can ignore this email — your password will not be modified.");
      expect(html).toContain(FOOTER.en);
    });

    it('escapes ampersands and angle brackets in the name', async () => {
      await service.sendPasswordReset('reader@example.test', 'Tom & <b>Jerry</b>', 'tok', 'en');
      expect(sent().html).toContain('Hi, Tom &amp; &lt;b&gt;Jerry&lt;/b&gt;');
    });
  });

  describe('sendFarewell', () => {
    it('defaults to Spanish, confirms deletion and links back to registration', async () => {
      process.env.WEB_URL = 'https://app.noetia.test';
      const service = await build();
      await service.sendFarewell('reader@example.test', 'Lucía');
      const { subject, html } = sent();
      expect(subject).toBe('Tu cuenta de Noetia ha sido eliminada');
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('Hasta pronto, Lucía.');
      expect(html).toContain('Tu cuenta ha sido eliminada correctamente. Todos tus datos — fragmentos, biblioteca y preferencias — han sido borrados de nuestros sistemas.');
      expect(html).toContain('Si cambiaste de opinión o eliminaste tu cuenta por error, puedes volver a registrarte en cualquier momento en <a href="https://app.noetia.test/register"');
      expect(html).toContain('Gracias por haber sido parte de la comunidad Noetia. Esperamos verte de nuevo.');
      expect(html).toContain(FOOTER.es);
    });

    it('renders the exact English copy', async () => {
      const service = await build();
      await service.sendFarewell('reader@example.test', 'Lucy', 'en');
      const { subject, html } = sent();
      expect(subject).toBe('Your Noetia account has been deleted');
      expect(html).toContain('Until next time, Lucy.');
      expect(html).toContain('Your account has been successfully deleted. All your data — fragments, library, and preferences — has been erased from our systems.');
      expect(html).toContain('If you changed your mind or deleted your account by mistake, you can register again at any time at <a href="http://localhost:3000/register"');
      expect(html).toContain('Thank you for being part of the Noetia community. We hope to see you again.');
      expect(html).toContain(FOOTER.en);
    });

    it('escapes the name', async () => {
      const service = await build();
      await service.sendFarewell('reader@example.test', '<i>x</i>', 'en');
      expect(sent().html).toContain('Until next time, &lt;i&gt;x&lt;/i&gt;.');
    });
  });

  describe('sendWaitlistConfirmation', () => {
    let service: EmailService;
    beforeEach(async () => { service = await build(); });

    it('defaults to Spanish with the canonical feature names (Escucha Activa, Fragmentos)', async () => {
      await service.sendWaitlistConfirmation('reader@example.test', 'Ana');
      const { subject, html } = sent();
      expect(subject).toBe('¡Estás en la lista de espera de Noetia!');
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('¡Ya estás en la lista, Ana!');
      expect(html).toContain('Gracias por tu interés en Noetia. Somos una plataforma de lectura sincronizada con audio y generación de citas visuales para compartir en redes sociales.');
      expect(html).toContain('Te avisaremos por este correo en cuanto tu acceso beta esté disponible. No necesitas hacer nada más.');
      expect(html).toContain('¿Qué es Noetia?');
      expect(html).toContain('<strong>Escucha Activa</strong> — texto y audio sincronizados frase por frase.');
      expect(html).toContain('<strong>Fragmentos</strong> — captura las ideas que más te impactan.');
      expect(html).toContain('<strong>Comparte</strong> — crea tarjetas visuales para LinkedIn, Instagram y más.');
      expect(html).toContain(FOOTER.es);
    });

    it('renders the exact English copy', async () => {
      await service.sendWaitlistConfirmation('reader@example.test', 'Ana', 'en');
      const { subject, html } = sent();
      expect(subject).toBe("You're on the Noetia waitlist!");
      expect(html).toContain('<html lang="en">');
      expect(html).toContain(TAGLINE.en);
      expect(html).toContain("You're on the list, Ana!");
      expect(html).toContain("Thank you for your interest in Noetia. We're a synchronized reading platform with audio and visual quote generation for social media sharing.");
      expect(html).toContain("We'll email you as soon as your beta access is available. You don't need to do anything else.");
      expect(html).toContain('What is Noetia?');
      expect(html).toContain('<strong>Active Listening</strong> — text and audio synchronized phrase by phrase.');
      expect(html).toContain('<strong>Fragments</strong> — capture the ideas that impact you most.');
      expect(html).toContain('<strong>Share</strong> — create visual cards for LinkedIn, Instagram and more.');
      expect(html).toContain(FOOTER.en);
    });

    it('escapes the name', async () => {
      await service.sendWaitlistConfirmation('reader@example.test', 'A&B', 'en');
      expect(sent().html).toContain("You're on the list, A&amp;B!");
    });
  });

  describe('sendWaitlistInvite', () => {
    let service: EmailService;
    beforeEach(async () => { service = await build(); });

    it('defaults to Spanish and pre-fills the URL-encoded recipient email in the registration link', async () => {
      await service.sendWaitlistInvite('ana+beta@example.test', 'Ana');
      const { to, subject, html } = sent();
      expect(to).toBe('ana+beta@example.test');
      expect(subject).toBe('¡Tu acceso a Noetia Beta está listo!');
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('Acceso Beta');
      expect(html).toContain('Tu acceso está listo, Ana');
      expect(html).toContain('Eres uno de los primeros lectores en acceder a Noetia. Crea tu cuenta y empieza a leer con el modo de Escucha Activa.');
      expect(html).toContain('<a href="http://localhost:3000/register?email=ana%2Bbeta%40example.test"');
      expect(html).toContain('>Crear mi cuenta →</a>');
      expect(html).toContain('Si el botón no funciona, copia este enlace:');
      expect(html).toContain(FOOTER.es);
    });

    it('renders the exact English copy', async () => {
      await service.sendWaitlistInvite('ana@example.test', 'Ana', 'en');
      const { subject, html } = sent();
      expect(subject).toBe('Your Noetia Beta access is ready!');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain(TAGLINE.en);
      expect(html).toContain('Beta Access');
      expect(html).toContain('Your access is ready, Ana');
      expect(html).toContain("You're one of the first readers to access Noetia. Create your account and start reading with Active Listening mode.");
      expect(html).toContain('>Create my account →</a>');
      expect(html).toContain("If the button doesn't work, copy this link:");
      expect(html).toContain(FOOTER.en);
    });

    it('escapes the name', async () => {
      await service.sendWaitlistInvite('ana@example.test', '<b>Ana</b>');
      expect(sent().html).toContain('Tu acceso está listo, &lt;b&gt;Ana&lt;/b&gt;');
    });
  });

  describe('sendGiftCard', () => {
    let service: EmailService;
    beforeEach(async () => { service = await build(); });

    it('Spanish, 1 token, with occasion and personal message: singular wording and the claim link', async () => {
      await service.sendGiftCard('friend@example.test', 'Marta', 1, '¡Feliz cumpleaños!', '🎂 Cumpleaños', 'claim-1');
      const { to, subject, html } = sent();
      expect(to).toBe('friend@example.test');
      expect(subject).toBe('Marta te regala 1 token en Noetia');
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('🎂 Cumpleaños</p>');
      expect(html).toContain('<strong>Marta</strong> te envía un regalo');
      expect(html).toContain('>1</p>');
      expect(html).toContain('>Noetia Token</p>');
      expect(html).toContain('Cada token desbloquea un libro de tu elección');
      expect(html).toContain('"¡Feliz cumpleaños!"');
      expect(html).toContain('<a href="http://localhost:3000/gift/claim?token=claim-1"');
      expect(html).toContain('>Reclamar mi regalo →</a>');
      expect(html).toContain('Este regalo es válido por 1 año.');
      expect(html).toContain(FOOTER.es);
    });

    it('English, 3 tokens, without occasion or message: plural wording and no message/occasion blocks', async () => {
      await service.sendGiftCard('friend@example.test', 'Marta', 3, null, null, 'claim-3', 'en');
      const { subject, html } = sent();
      expect(subject).toBe('Marta sent you 3 Noetia tokens');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<strong>Marta</strong> sent you a gift');
      expect(html).toContain('>3</p>');
      expect(html).toContain('>Noetia Tokens</p>');
      expect(html).toContain('Each token unlocks a book of your choice');
      expect(html).toContain('>Claim my gift →</a>');
      expect(html).toContain("If the button doesn't work, copy this link:");
      expect(html).toContain('This gift is valid for 1 year.');
      expect(html).toContain(FOOTER.en);
      expect(html).not.toContain('font-style:italic');                  // personal-message block omitted
      expect(html).not.toContain('font-size:24px;text-align:center;');  // occasion line omitted
    });

    it('Spanish plural subject and English singular subject', async () => {
      await service.sendGiftCard('f@example.test', 'Marta', 3, null, null, 'c');
      expect(sent().subject).toBe('Marta te regala 3 tokens en Noetia');
      mockSendMail.mockClear();
      await service.sendGiftCard('f@example.test', 'Marta', 1, null, null, 'c', 'en');
      expect(sent().subject).toBe('Marta sent you 1 Noetia token');
    });

    it('escapes buyer name (subject and body), occasion label and personal message', async () => {
      await service.sendGiftCard('f@example.test', '<Bob>', 1, '<img src=x onerror=alert(1)>', '<em>Party</em>', 'c', 'en');
      const { subject, html } = sent();
      expect(subject).toBe('&lt;Bob&gt; sent you 1 Noetia token');
      expect(html).toContain('<strong>&lt;Bob&gt;</strong> sent you a gift');
      expect(html).toContain('&lt;em&gt;Party&lt;/em&gt;');
      expect(html).toContain('"&lt;img src=x onerror=alert(1)&gt;"');
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<em>Party');
    });
  });

  describe('sendGiftConfirmation', () => {
    let service: EmailService;
    beforeEach(async () => { service = await build(); });

    it('Spanish, plural: confirms delivery to the recipient', async () => {
      await service.sendGiftConfirmation('buyer@example.test', 'Marta', 'friend@example.test', 3);
      const { to, subject, html } = sent();
      expect(to).toBe('buyer@example.test');
      expect(subject).toBe('Tu regalo de Noetia fue enviado a friend@example.test');
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('¡Tu regalo fue enviado! 🎁');
      expect(html).toContain('Hola Marta, enviamos <strong>3 tokens Noetia</strong> a <strong>friend@example.test</strong>. Cuando los reclamen podrán desbloquear libros de su elección.');
      expect(html).toContain('¿Tienes preguntas? Escríbenos a hola@noetia.app');
      expect(html).toContain(FOOTER.es);
    });

    it('English, singular', async () => {
      await service.sendGiftConfirmation('buyer@example.test', 'Marta', 'friend@example.test', 1, 'en');
      const { subject, html } = sent();
      expect(subject).toBe('Your Noetia gift was sent to friend@example.test');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('Your gift was sent! 🎁');
      expect(html).toContain("Hi Marta, we sent <strong>1 Noetia token</strong> to <strong>friend@example.test</strong>. When they claim them they'll be able to unlock books of their choice.");
      expect(html).toContain('Have questions? Write to us at hola@noetia.app');
      expect(html).toContain(FOOTER.en);
    });

    it('escapes buyer name and recipient in the body', async () => {
      await service.sendGiftConfirmation('buyer@example.test', '<M>', '<r@example.test>', 2, 'en');
      expect(sent().html).toContain('Hi &lt;M&gt;, we sent <strong>2 Noetia tokens</strong> to <strong>&lt;r@example.test&gt;</strong>.');
    });
  });

  describe('sendPlanInvite', () => {
    let service: EmailService;
    beforeEach(async () => { service = await build(); });

    it('Spanish: invite copy, plan name and join link', async () => {
      await service.sendPlanInvite('member@example.test', 'Carlos', 'Familia', 'join-tok');
      const { to, subject, html } = sent();
      expect(to).toBe('member@example.test');
      expect(subject).toBe('Carlos te invita a Noetia Familia');
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('Te han invitado a leer juntos');
      expect(html).toContain('<strong>Carlos</strong> te está invitando a unirte a su plan <strong>Familia</strong> en Noetia. Con este plan comparten tokens para desbloquear libros, cada uno con su biblioteca personal.');
      expect(html).toContain('<a href="http://localhost:3000/join?token=join-tok"');
      expect(html).toContain('>Aceptar invitación →</a>');
      expect(html).toContain('Este enlace expira en 48 horas. Si no esperabas esta invitación, puedes ignorar este mensaje.');
      expect(html).toContain(FOOTER.es);
    });

    it('English copy', async () => {
      await service.sendPlanInvite('member@example.test', 'Carlos', 'Duo', 'join-tok', 'en');
      const { subject, html } = sent();
      expect(subject).toBe('Carlos invites you to Noetia Duo');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain(TAGLINE.en);
      expect(html).toContain("You've been invited to read together");
      expect(html).toContain('<strong>Carlos</strong> is inviting you to join their <strong>Duo</strong> plan on Noetia. With this plan you share tokens to unlock books, each with your own personal library.');
      expect(html).toContain('>Accept invitation →</a>');
      expect(html).toContain("This link expires in 48 hours. If you weren't expecting this invitation, you can ignore this email.");
      expect(html).toContain(FOOTER.en);
    });

    it('escapes inviter and plan names in subject and body', async () => {
      await service.sendPlanInvite('m@example.test', '<C>', 'Duo & <x>', 't');
      const { subject, html } = sent();
      expect(subject).toBe('&lt;C&gt; te invita a Noetia Duo &amp; &lt;x&gt;');
      expect(html).toContain('<strong>&lt;C&gt;</strong> te está invitando a unirte a su plan <strong>Duo &amp; &lt;x&gt;</strong>');
    });
  });
});
