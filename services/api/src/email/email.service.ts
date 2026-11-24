import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { EMAIL_COPY, EmailCopy } from './copy';
import { escapeHtml, trustedHtml } from './escape';
import { dispatchCopyLocale } from './locale';
import {
  renderConfirmation,
  renderFarewell,
  renderGiftCard,
  renderGiftConfirmation,
  renderPasswordReset,
  renderPlanInvite,
  renderWaitlistConfirmation,
  renderWaitlistInvite,
} from './templates';

type Lang = 'es' | 'en';

/** Support address shown in the gift confirmation. Single constant; value unchanged (PR #75 governs any rename). */
export const SUPPORT_EMAIL = 'hola@noetia.app';

/**
 * Selects the dictionary for a public method's `lang` argument. Behaviour-preserving (NEM-025 B2-A1):
 * `'en'` → English, anything else → Spanish; French is unreachable while FR_CA_TRANSACTIONAL_READY is false.
 */
function copyFor(lang: unknown): EmailCopy {
  return EMAIL_COPY[dispatchCopyLocale(lang)];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly webUrl: string;

  constructor() {
    this.from = process.env.SMTP_FROM ?? 'Noetia <noreply@noetia.app>';
    this.webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'mailhog',
      port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } }
        : {}),
    });
  }

  async sendEmailConfirmation(to: string, name: string, token: string, lang: Lang = 'es'): Promise<void> {
    const link = `${this.webUrl}/confirm-email?token=${token}`;
    const copy = copyFor(lang);
    await this.send({
      to,
      subject: copy.confirmation.subject,
      html: renderConfirmation(copy, lang, escapeHtml(name), trustedHtml(link)),
    });
  }

  async sendPasswordReset(to: string, name: string, token: string, lang: Lang = 'es'): Promise<void> {
    const link = `${this.webUrl}/reset-password?token=${token}`;
    const copy = copyFor(lang);
    await this.send({
      to,
      subject: copy.passwordReset.subject,
      html: renderPasswordReset(copy, lang, escapeHtml(name), trustedHtml(link)),
    });
  }

  async sendFarewell(to: string, name: string, lang: Lang = 'es'): Promise<void> {
    const copy = copyFor(lang);
    const registerLink = trustedHtml(`<a href="${this.webUrl}/register" style="color:#0D1B2A;font-weight:600;">noetia.app</a>`);
    await this.send({
      to,
      subject: copy.farewell.subject,
      html: renderFarewell(copy, lang, escapeHtml(name), registerLink),
    });
  }

  async sendWaitlistConfirmation(to: string, name: string, lang: Lang = 'es'): Promise<void> {
    const copy = copyFor(lang);
    await this.send({
      to,
      subject: copy.waitlistConfirmation.subject,
      html: renderWaitlistConfirmation(copy, lang, escapeHtml(name)),
    });
  }

  async sendGiftCard(
    to: string,
    buyerName: string,
    tokenCount: number,
    message: string | null,
    occasionLabel: string | null,
    claimToken: string,
    lang: Lang = 'es',
  ): Promise<void> {
    const link = `${this.webUrl}/gift/claim?token=${claimToken}`;
    const copy = copyFor(lang);
    const buyer = escapeHtml(buyerName);
    await this.send({
      to,
      subject: copy.giftCard.subject(buyer, tokenCount),
      html: renderGiftCard(
        copy,
        lang,
        buyer,
        tokenCount,
        message ? escapeHtml(message) : null,
        occasionLabel ? escapeHtml(occasionLabel) : null,
        trustedHtml(link),
      ),
    });
  }

  async sendGiftConfirmation(to: string, buyerName: string, recipientEmail: string, tokenCount: number, lang: Lang = 'es'): Promise<void> {
    const copy = copyFor(lang);
    await this.send({
      to,
      subject: copy.giftConfirmation.subject(recipientEmail),
      html: renderGiftConfirmation(copy, lang, escapeHtml(buyerName), escapeHtml(recipientEmail), tokenCount, SUPPORT_EMAIL),
    });
  }

  async sendPlanInvite(to: string, inviterName: string, planName: string, token: string, lang: Lang = 'es'): Promise<void> {
    const link = `${this.webUrl}/join?token=${token}`;
    const copy = copyFor(lang);
    const inviter = escapeHtml(inviterName);
    const plan = escapeHtml(planName);
    await this.send({
      to,
      subject: copy.planInvite.subject(inviter, plan),
      html: renderPlanInvite(copy, lang, inviter, plan, trustedHtml(link)),
    });
  }

  async sendWaitlistInvite(to: string, name: string, lang: Lang = 'es'): Promise<void> {
    const link = `${this.webUrl}/register?email=${encodeURIComponent(to)}`;
    const copy = copyFor(lang);
    await this.send({
      to,
      subject: copy.waitlistInvite.subject,
      html: renderWaitlistInvite(copy, lang, escapeHtml(name), trustedHtml(link)),
    });
  }

  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...opts });
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${(err as Error).message}`);
    }
  }
}
