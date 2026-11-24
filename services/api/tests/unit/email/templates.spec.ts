/**
 * NEM-025 B2-A1 — shared renderer: French drafts render through the same templates (inert at runtime),
 * user values never reach HTML attributes, and the service stays Spanish/English-only in this build.
 */
import * as nodemailer from 'nodemailer';
import { EMAIL_COPY } from '../../../src/email/copy';
import { EmailService, SUPPORT_EMAIL } from '../../../src/email/email.service';
import { escapeHtml, trustedHtml } from '../../../src/email/escape';
import {
  renderConfirmation,
  renderFarewell,
  renderGiftCard,
  renderGiftConfirmation,
  renderPasswordReset,
  renderPlanInvite,
  renderWaitlistConfirmation,
  renderWaitlistInvite,
} from '../../../src/email/templates';

jest.mock('nodemailer');
const mockSendMail = jest.fn();
(nodemailer.createTransport as jest.Mock).mockImplementation(() => ({ sendMail: mockSendMail }));

const MARK = 'ZZ<b>"q" & \'x\'</b>ZZ';
const M = escapeHtml(MARK);
const LINK = trustedHtml('https://noetia.test/x?token=abc');

function renderAll(locale: 'es' | 'en' | 'fr-CA') {
  const c = EMAIL_COPY[locale];
  const anchor = trustedHtml('<a href="https://noetia.test/register" style="color:#0D1B2A;font-weight:600;">noetia.app</a>');
  return {
    confirmation: renderConfirmation(c, locale, M, LINK),
    passwordReset: renderPasswordReset(c, locale, M, LINK),
    farewell: renderFarewell(c, locale, M, anchor),
    waitlistConfirmation: renderWaitlistConfirmation(c, locale, M),
    waitlistInvite: renderWaitlistInvite(c, locale, M, LINK),
    giftCard: renderGiftCard(c, locale, M, 3, M, M, LINK),
    giftConfirmation: renderGiftConfirmation(c, locale, M, M, 1, SUPPORT_EMAIL),
    planInvite: renderPlanInvite(c, locale, M, M, LINK),
  };
}

/** All attribute values in a document. */
const attributeValues = (html: string) => [...html.matchAll(/\s[a-zA-Z-]+="([^"]*)"/g)].map((m) => m[1]);

describe('shared renderer (B2-A1)', () => {
  it.each(['es', 'en', 'fr-CA'] as const)('%s: user values appear only escaped, only in text nodes', (locale) => {
    for (const [name, html] of Object.entries(renderAll(locale))) {
      expect(`${name}: raw=${html.includes(MARK)}`).toBe(`${name}: raw=false`);
      expect(`${name}: escaped=${html.includes(M)}`).toBe(`${name}: escaped=true`);
      for (const v of attributeValues(html)) {
        expect(`${name} attr: ${v.includes('ZZ')}`).toBe(`${name} attr: false`);
      }
      expect(html).not.toContain('<b>');
    }
  });

  it('French drafts render all eight templates with French copy and canonical lang', () => {
    const fr = EMAIL_COPY['fr-CA'];
    const out = renderAll('fr-CA');
    expect(Object.keys(out)).toHaveLength(8);
    for (const html of Object.values(out)) {
      expect(html).toContain('<html lang="fr-CA">');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).not.toMatch(/Todos los derechos|All rights reserved|Si el botón|If the button/);
    }
    expect(out.confirmation).toContain(fr.confirmation.cta);
    expect(out.passwordReset).toContain(fr.passwordReset.cta);
    expect(out.farewell).toContain(fr.farewell.thanks);
    expect(out.waitlistConfirmation).toContain(fr.waitlistConfirmation.whatIs);
    expect(out.waitlistInvite).toContain(fr.waitlistInvite.eyebrow);
    expect(out.giftCard).toContain('Jetons Noetia');
    expect(out.giftCard).toContain(`«\u00A0${M}\u00A0»`);
    expect(out.giftConfirmation).toContain('1 jeton Noetia');
    expect(out.giftConfirmation).toContain(SUPPORT_EMAIL);
    expect(out.planInvite).toContain('forfait');
  });

  it('tokenized links are preserved in href and fallback text', () => {
    for (const html of [renderAll('fr-CA').confirmation, renderAll('es').planInvite]) {
      expect(html).toContain(`href="${LINK}"`);
      expect(html.split(LINK).length - 1).toBe(2);
    }
  });

  it('support address is a single unchanged constant', () => {
    expect(SUPPORT_EMAIL).toBe('hola@noetia.app');
  });
});

describe('EmailService stays ES/EN-only in this build (French inert)', () => {
  const saved = process.env.FR_CA_ENABLED;
  beforeEach(() => mockSendMail.mockReset().mockResolvedValue({}));
  afterEach(() => {
    if (saved === undefined) delete process.env.FR_CA_ENABLED;
    else process.env.FR_CA_ENABLED = saved;
  });

  it("lang 'fr-CA' with FR_CA_ENABLED=true still sends the Spanish email (pre-existing behaviour preserved)", async () => {
    process.env.FR_CA_ENABLED = 'true';
    const svc = new EmailService();
    await svc.sendPasswordReset('r@example.com', 'Ana', 'tok', 'fr-CA' as any);
    const { subject, html } = mockSendMail.mock.calls[0][0];
    expect(subject).toBe('Recupera tu contraseña en Noetia');
    expect(html).toContain('Restablecer contraseña');
    expect(html).not.toMatch(/Réinitialis|courriel|vous/);
    // At the EmailService level `<html lang>` still echoes the argument (X-4). B2-A2a normalizes in the
    // account callers instead (accountEmailLocale), so excluded gift/waitlist/invite callers are unchanged.
    expect(html).toContain('<html lang="fr-CA">');
  });

  it.each(['pt', 'EN', 'fr'])("invalid lang %p keeps today's output: Spanish body, raw lang attribute (EmailService level; N-1 lives in the account callers)", async (v) => {
    const svc = new EmailService();
    await svc.sendFarewell('r@example.com', 'Ana', v as any);
    const { subject, html } = mockSendMail.mock.calls[0][0];
    expect(subject).toBe('Tu cuenta de Noetia ha sido eliminada');
    expect(html).toContain(`<html lang="${v}">`);
  });

  it('never sends French for any template, gate on', async () => {
    process.env.FR_CA_ENABLED = 'true';
    const svc = new EmailService();
    const l = 'fr-CA' as any;
    await svc.sendEmailConfirmation('a@x.com', 'A', 't', l);
    await svc.sendPasswordReset('a@x.com', 'A', 't', l);
    await svc.sendFarewell('a@x.com', 'A', l);
    await svc.sendWaitlistConfirmation('a@x.com', 'A', l);
    await svc.sendWaitlistInvite('a@x.com', 'A', l);
    await svc.sendGiftCard('a@x.com', 'A', 1, 'm', 'o', 't', l);
    await svc.sendGiftConfirmation('a@x.com', 'A', 'b@x.com', 1, l);
    await svc.sendPlanInvite('a@x.com', 'A', 'Duo', 't', l);
    expect(mockSendMail).toHaveBeenCalledTimes(8);
    for (const [mail] of mockSendMail.mock.calls) {
      expect(`${mail.subject} ${mail.html}`).not.toMatch(/vous|jeton|courriel|Lisez/);
    }
  });
});
