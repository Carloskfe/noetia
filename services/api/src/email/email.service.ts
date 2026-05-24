import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

type Lang = 'es' | 'en';

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
    await this.send({
      to,
      subject: lang === 'en' ? 'Confirm your Noetia account' : 'Confirma tu cuenta en Noetia',
      html: this.confirmationTemplate(name, link, lang),
    });
  }

  async sendPasswordReset(to: string, name: string, token: string, lang: Lang = 'es'): Promise<void> {
    const link = `${this.webUrl}/reset-password?token=${token}`;
    await this.send({
      to,
      subject: lang === 'en' ? 'Reset your Noetia password' : 'Recupera tu contraseña en Noetia',
      html: this.passwordResetTemplate(name, link, lang),
    });
  }

  async sendFarewell(to: string, name: string, lang: Lang = 'es'): Promise<void> {
    await this.send({
      to,
      subject: lang === 'en' ? 'Your Noetia account has been deleted' : 'Tu cuenta de Noetia ha sido eliminada',
      html: this.farewellTemplate(name, lang),
    });
  }

  async sendWaitlistConfirmation(to: string, name: string, lang: Lang = 'es'): Promise<void> {
    await this.send({
      to,
      subject: lang === 'en' ? "You're on the Noetia waitlist!" : '¡Estás en la lista de espera de Noetia!',
      html: this.waitlistConfirmationTemplate(name, lang),
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
    const tokenWord = tokenCount === 1 ? 'token' : 'tokens';
    const subject = lang === 'en'
      ? `${this.escape(buyerName)} sent you ${tokenCount} Noetia ${tokenWord}`
      : `${this.escape(buyerName)} te regala ${tokenCount} ${tokenWord} en Noetia`;
    await this.send({ to, subject, html: this.giftCardTemplate(buyerName, tokenCount, message, occasionLabel, link, lang) });
  }

  async sendGiftConfirmation(to: string, buyerName: string, recipientEmail: string, tokenCount: number, lang: Lang = 'es'): Promise<void> {
    const subject = lang === 'en'
      ? `Your Noetia gift was sent to ${recipientEmail}`
      : `Tu regalo de Noetia fue enviado a ${recipientEmail}`;
    await this.send({ to, subject, html: this.giftConfirmationTemplate(buyerName, recipientEmail, tokenCount, lang) });
  }

  async sendPlanInvite(to: string, inviterName: string, planName: string, token: string, lang: Lang = 'es'): Promise<void> {
    const link = `${this.webUrl}/join?token=${token}`;
    const subject = lang === 'en'
      ? `${this.escape(inviterName)} invites you to Noetia ${this.escape(planName)}`
      : `${this.escape(inviterName)} te invita a Noetia ${this.escape(planName)}`;
    await this.send({ to, subject, html: this.planInviteTemplate(inviterName, planName, link, lang) });
  }

  async sendWaitlistInvite(to: string, name: string, lang: Lang = 'es'): Promise<void> {
    const link = `${this.webUrl}/register?email=${encodeURIComponent(to)}`;
    await this.send({
      to,
      subject: lang === 'en' ? 'Your Noetia Beta access is ready!' : '¡Tu acceso a Noetia Beta está listo!',
      html: this.waitlistInviteTemplate(name, link, lang),
    });
  }

  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...opts });
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${(err as Error).message}`);
    }
  }

  private confirmationTemplate(name: string, link: string, lang: Lang): string {
    const isEn = lang === 'en';
    return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">${isEn ? 'Read. Listen. Share.' : 'Lee. Escucha. Comparte.'}</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">${isEn ? `Welcome, ${this.escape(name)}!` : `¡Bienvenido/a, ${this.escape(name)}!`}</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            ${isEn
              ? 'Thank you for creating your account. Confirm your email address to start reading, listening, and sharing fragments.'
              : 'Gracias por crear tu cuenta. Confirma tu dirección de correo para comenzar a leer, escuchar y compartir fragmentos.'}
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:14px 32px;text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${isEn ? 'Confirm my account' : 'Confirmar mi cuenta'}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">
            ${isEn ? "If the button doesn't work, copy this link into your browser:" : 'Si el botón no funciona, copia este enlace en tu navegador:'}
          </p>
          <p style="margin:0;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>
          <p style="margin:32px 0 0;color:#CBD5E1;font-size:12px;text-align:center;">
            ${isEn ? "This link expires in 24 hours. If you didn't create this account, you can ignore this email." : 'Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.'}
          </p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. ${isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private passwordResetTemplate(name: string, link: string, lang: Lang): string {
    const isEn = lang === 'en';
    return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">${isEn ? 'Read. Listen. Share.' : 'Lee. Escucha. Comparte.'}</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">${isEn ? `Hi, ${this.escape(name)}` : `Hola, ${this.escape(name)}`}</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            ${isEn
              ? 'We received a request to reset your account password. Click the button below to create a new one.'
              : 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva.'}
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:14px 32px;text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${isEn ? 'Reset password' : 'Restablecer contraseña'}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">
            ${isEn ? "If the button doesn't work, copy this link into your browser:" : 'Si el botón no funciona, copia este enlace en tu navegador:'}
          </p>
          <p style="margin:0;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>
          <p style="margin:32px 0 0;color:#CBD5E1;font-size:12px;text-align:center;">
            ${isEn
              ? "This link expires in 1 hour. If you didn't request this change, you can ignore this email — your password will not be modified."
              : 'Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje — tu contraseña no será modificada.'}
          </p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. ${isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private waitlistConfirmationTemplate(name: string, lang: Lang): string {
    const isEn = lang === 'en';
    return `
<!DOCTYPE html><html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">${isEn ? 'Read. Listen. Share.' : 'Lee. Escucha. Comparte.'}</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">${isEn ? `You're on the list, ${this.escape(name)}!` : `¡Ya estás en la lista, ${this.escape(name)}!`}</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            ${isEn
              ? "Thank you for your interest in Noetia. We're a synchronized reading platform with audio and visual quote generation for social media sharing."
              : 'Gracias por tu interés en Noetia. Somos una plataforma de lectura sincronizada con audio y generación de citas visuales para compartir en redes sociales.'}
          </p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            ${isEn
              ? "We'll email you as soon as your beta access is available. You don't need to do anything else."
              : 'Te avisaremos por este correo en cuanto tu acceso beta esté disponible. No necesitas hacer nada más.'}
          </p>
          <div style="background:#F1F5F9;border-radius:8px;padding:20px;margin:0 0 24px;">
            <p style="margin:0 0 8px;color:#0D1B2A;font-size:14px;font-weight:600;">${isEn ? 'What is Noetia?' : '¿Qué es Noetia?'}</p>
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
              🎧 <strong>${isEn ? 'Active Listening' : 'Escucha Activa'}</strong> — ${isEn ? 'text and audio synchronized phrase by phrase.' : 'texto y audio sincronizados frase por frase.'}<br>
              ✍️ <strong>${isEn ? 'Fragments' : 'Fragmentos'}</strong> — ${isEn ? 'capture the ideas that impact you most.' : 'captura las ideas que más te impactan.'}<br>
              📲 <strong>${isEn ? 'Share' : 'Comparte'}</strong> — ${isEn ? 'create visual cards for LinkedIn, Instagram and more.' : 'crea tarjetas visuales para LinkedIn, Instagram y más.'}
            </p>
          </div>
          <p style="margin:0;color:#CBD5E1;font-size:12px;text-align:center;">© ${new Date().getFullYear()} Noetia. ${isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private waitlistInviteTemplate(name: string, link: string, lang: Lang): string {
    const isEn = lang === 'en';
    return `
<!DOCTYPE html><html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">${isEn ? 'Read. Listen. Share.' : 'Lee. Escucha. Comparte.'}</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;color:#0D1B2A;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${isEn ? 'Beta Access' : 'Acceso Beta'}</p>
          <p style="margin:0 0 16px;color:#1E293B;font-size:22px;font-weight:700;">${isEn ? `Your access is ready, ${this.escape(name)}` : `Tu acceso está listo, ${this.escape(name)}`}</p>
          <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
            ${isEn
              ? "You're one of the first readers to access Noetia. Create your account and start reading with Active Listening mode."
              : 'Eres uno de los primeros lectores en acceder a Noetia. Crea tu cuenta y empieza a leer con el modo de Escucha Activa.'}
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:16px 40px;text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${isEn ? 'Create my account →' : 'Crear mi cuenta →'}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">
            ${isEn ? "If the button doesn't work, copy this link:" : 'Si el botón no funciona, copia este enlace:'}
          </p>
          <p style="margin:0 0 32px;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>
          <p style="margin:0;color:#CBD5E1;font-size:12px;text-align:center;">© ${new Date().getFullYear()} Noetia. ${isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private farewellTemplate(name: string, lang: Lang): string {
    const isEn = lang === 'en';
    return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">${isEn ? `Until next time, ${this.escape(name)}.` : `Hasta pronto, ${this.escape(name)}.`}</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            ${isEn
              ? 'Your account has been successfully deleted. All your data — fragments, library, and preferences — has been erased from our systems.'
              : 'Tu cuenta ha sido eliminada correctamente. Todos tus datos — fragmentos, biblioteca y preferencias — han sido borrados de nuestros sistemas.'}
          </p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            ${isEn
              ? `If you changed your mind or deleted your account by mistake, you can register again at any time at <a href="${this.webUrl}/register" style="color:#0D1B2A;font-weight:600;">noetia.app</a>.`
              : `Si cambiaste de opinión o eliminaste tu cuenta por error, puedes volver a registrarte en cualquier momento en <a href="${this.webUrl}/register" style="color:#0D1B2A;font-weight:600;">noetia.app</a>.`}
          </p>
          <p style="margin:0;color:#94A3B8;font-size:13px;">
            ${isEn ? 'Thank you for being part of the Noetia community. We hope to see you again.' : 'Gracias por haber sido parte de la comunidad Noetia. Esperamos verte de nuevo.'}
          </p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. ${isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private giftCardTemplate(buyerName: string, tokenCount: number, message: string | null, occasionLabel: string | null, link: string, lang: Lang): string {
    const isEn = lang === 'en';
    return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">${isEn ? 'Read. Listen. Share.' : 'Lee. Escucha. Comparte.'}</p>
        </td></tr>
        <tr><td style="padding:40px;">
          ${occasionLabel ? `<p style="margin:0 0 4px;font-size:24px;text-align:center;">${this.escape(occasionLabel)}</p>` : ''}
          <p style="margin:0 0 16px;color:#1E293B;font-size:20px;font-weight:700;text-align:center;">
            ${isEn ? `<strong>${this.escape(buyerName)}</strong> sent you a gift` : `<strong>${this.escape(buyerName)}</strong> te envía un regalo`}
          </p>
          <div style="background:#F1F5F9;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
            <p style="margin:0 0 4px;font-size:40px;font-weight:900;color:#0D1B2A;">${tokenCount}</p>
            <p style="margin:0;font-size:16px;color:#475569;font-weight:600;">${tokenCount === 1 ? 'Noetia Token' : 'Noetia Tokens'}</p>
            <p style="margin:8px 0 0;font-size:13px;color:#94A3B8;">${isEn ? 'Each token unlocks a book of your choice' : 'Cada token desbloquea un libro de tu elección'}</p>
          </div>
          ${message ? `
          <div style="border-left:3px solid #0D1B2A;padding:12px 16px;margin:0 0 24px;background:#F8FAFC;border-radius:0 8px 8px 0;">
            <p style="margin:0;color:#475569;font-size:15px;font-style:italic;">"${this.escape(message)}"</p>
          </div>` : ''}
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:14px 32px;text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${isEn ? 'Claim my gift →' : 'Reclamar mi regalo →'}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">${isEn ? "If the button doesn't work, copy this link:" : 'Si el botón no funciona, copia este enlace:'}</p>
          <p style="margin:0;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>
          <p style="margin:32px 0 0;color:#CBD5E1;font-size:12px;text-align:center;">${isEn ? 'This gift is valid for 1 year.' : 'Este regalo es válido por 1 año.'}</p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. ${isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private giftConfirmationTemplate(buyerName: string, recipientEmail: string, tokenCount: number, lang: Lang): string {
    const isEn = lang === 'en';
    const tokenWord = tokenCount === 1 ? 'token' : 'tokens';
    return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">${isEn ? 'Your gift was sent! 🎁' : '¡Tu regalo fue enviado! 🎁'}</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            ${isEn
              ? `Hi ${this.escape(buyerName)}, we sent <strong>${tokenCount} Noetia ${tokenWord}</strong> to <strong>${this.escape(recipientEmail)}</strong>. When they claim them they'll be able to unlock books of their choice.`
              : `Hola ${this.escape(buyerName)}, enviamos <strong>${tokenCount} ${tokenWord} Noetia</strong> a <strong>${this.escape(recipientEmail)}</strong>. Cuando los reclamen podrán desbloquear libros de su elección.`}
          </p>
          <p style="margin:0;color:#94A3B8;font-size:13px;">${isEn ? 'Have questions? Write to us at hola@noetia.app' : '¿Tienes preguntas? Escríbenos a hola@noetia.app'}</p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. ${isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private planInviteTemplate(inviterName: string, planName: string, link: string, lang: Lang): string {
    const isEn = lang === 'en';
    return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">${isEn ? 'Read. Listen. Share.' : 'Lee. Escucha. Comparte.'}</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">${isEn ? "You've been invited to read together" : 'Te han invitado a leer juntos'}</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            ${isEn
              ? `<strong>${this.escape(inviterName)}</strong> is inviting you to join their <strong>${this.escape(planName)}</strong> plan on Noetia. With this plan you share tokens to unlock books, each with your own personal library.`
              : `<strong>${this.escape(inviterName)}</strong> te está invitando a unirte a su plan <strong>${this.escape(planName)}</strong> en Noetia. Con este plan comparten tokens para desbloquear libros, cada uno con su biblioteca personal.`}
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:14px 32px;text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${isEn ? 'Accept invitation →' : 'Aceptar invitación →'}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">
            ${isEn ? "If the button doesn't work, copy this link into your browser:" : 'Si el botón no funciona, copia este enlace en tu navegador:'}
          </p>
          <p style="margin:0;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>
          <p style="margin:32px 0 0;color:#CBD5E1;font-size:12px;text-align:center;">
            ${isEn ? "This link expires in 48 hours. If you weren't expecting this invitation, you can ignore this email." : 'Este enlace expira en 48 horas. Si no esperabas esta invitación, puedes ignorar este mensaje.'}
          </p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. ${isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
