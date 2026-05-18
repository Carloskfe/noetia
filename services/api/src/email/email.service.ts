import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

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

  async sendEmailConfirmation(to: string, name: string, token: string): Promise<void> {
    const link = `${this.webUrl}/confirm-email?token=${token}`;
    await this.send({
      to,
      subject: 'Confirma tu cuenta en Noetia',
      html: this.confirmationTemplate(name, link),
    });
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const link = `${this.webUrl}/reset-password?token=${token}`;
    await this.send({
      to,
      subject: 'Recupera tu contraseña en Noetia',
      html: this.passwordResetTemplate(name, link),
    });
  }

  async sendFarewell(to: string, name: string): Promise<void> {
    await this.send({
      to,
      subject: 'Tu cuenta de Noetia ha sido eliminada',
      html: this.farewellTemplate(name),
    });
  }

  async sendWaitlistConfirmation(to: string, name: string): Promise<void> {
    await this.send({
      to,
      subject: '¡Estás en la lista de espera de Noetia!',
      html: this.waitlistConfirmationTemplate(name),
    });
  }

  async sendGiftCard(
    to: string,
    buyerName: string,
    tokenCount: number,
    message: string | null,
    occasionLabel: string | null,
    claimToken: string,
  ): Promise<void> {
    const link = `${this.webUrl}/gift/claim?token=${claimToken}`;
    await this.send({
      to,
      subject: `${this.escape(buyerName)} te regala ${tokenCount} ${tokenCount === 1 ? 'token' : 'tokens'} en Noetia`,
      html: this.giftCardTemplate(buyerName, tokenCount, message, occasionLabel, link),
    });
  }

  async sendGiftConfirmation(to: string, buyerName: string, recipientEmail: string, tokenCount: number): Promise<void> {
    await this.send({
      to,
      subject: `Tu regalo de Noetia fue enviado a ${recipientEmail}`,
      html: this.giftConfirmationTemplate(buyerName, recipientEmail, tokenCount),
    });
  }

  async sendPlanInvite(to: string, inviterName: string, planName: string, token: string): Promise<void> {
    const link = `${this.webUrl}/join?token=${token}`;
    await this.send({
      to,
      subject: `${this.escape(inviterName)} te invita a Noetia ${this.escape(planName)}`,
      html: this.planInviteTemplate(inviterName, planName, link),
    });
  }

  async sendWaitlistInvite(to: string, name: string): Promise<void> {
    const link = `${this.webUrl}/register?email=${encodeURIComponent(to)}`;
    await this.send({
      to,
      subject: '¡Tu acceso a Noetia Beta está listo!',
      html: this.waitlistInviteTemplate(name, link),
    });
  }

  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...opts });
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${(err as Error).message}`);
    }
  }

  private confirmationTemplate(name: string, link: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">Lee. Escucha. Comparte.</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">¡Bienvenido/a, ${this.escape(name)}!</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Gracias por crear tu cuenta. Confirma tu dirección de correo para comenzar a leer, escuchar y compartir fragmentos.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:14px 32px;text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Confirmar mi cuenta</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">
            Si el botón no funciona, copia este enlace en tu navegador:
          </p>
          <p style="margin:0;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>
          <p style="margin:32px 0 0;color:#CBD5E1;font-size:12px;text-align:center;">
            Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.
          </p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. Todos los derechos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private passwordResetTemplate(name: string, link: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">Lee. Escucha. Comparte.</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">Hola, ${this.escape(name)}</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:14px 32px;text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Restablecer contraseña</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">
            Si el botón no funciona, copia este enlace en tu navegador:
          </p>
          <p style="margin:0;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>
          <p style="margin:32px 0 0;color:#CBD5E1;font-size:12px;text-align:center;">
            Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje — tu contraseña no será modificada.
          </p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. Todos los derechos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private waitlistConfirmationTemplate(name: string): string {
    return `
<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">Lee. Escucha. Comparte.</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">¡Ya estás en la lista, ${this.escape(name)}!</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Gracias por tu interés en Noetia. Somos una plataforma de lectura sincronizada con audio y generación de citas visuales para compartir en redes sociales.
          </p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Te avisaremos por este correo en cuanto tu acceso beta esté disponible. No necesitas hacer nada más.
          </p>
          <div style="background:#F1F5F9;border-radius:8px;padding:20px;margin:0 0 24px;">
            <p style="margin:0 0 8px;color:#0D1B2A;font-size:14px;font-weight:600;">¿Qué es Noetia?</p>
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
              🎧 <strong>Escucha Activa</strong> — texto y audio sincronizados frase por frase.<br>
              ✍️ <strong>Fragmentos</strong> — captura las ideas que más te impactan.<br>
              📲 <strong>Comparte</strong> — crea tarjetas visuales para LinkedIn, Instagram y más.
            </p>
          </div>
          <p style="margin:0;color:#CBD5E1;font-size:12px;text-align:center;">© ${new Date().getFullYear()} Noetia. Todos los derechos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private waitlistInviteTemplate(name: string, link: string): string {
    return `
<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">Lee. Escucha. Comparte.</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;color:#0D1B2A;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Acceso Beta</p>
          <p style="margin:0 0 16px;color:#1E293B;font-size:22px;font-weight:700;">Tu acceso está listo, ${this.escape(name)}</p>
          <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">
            Eres uno de los primeros lectores en acceder a Noetia. Crea tu cuenta y empieza a leer con el modo de Escucha Activa.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:16px 40px;text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Crear mi cuenta →</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">
            Si el botón no funciona, copia este enlace:
          </p>
          <p style="margin:0 0 32px;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>
          <p style="margin:0;color:#CBD5E1;font-size:12px;text-align:center;">© ${new Date().getFullYear()} Noetia. Todos los derechos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private farewellTemplate(name: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">Hasta pronto, ${this.escape(name)}.</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Tu cuenta ha sido eliminada correctamente. Todos tus datos — fragmentos, biblioteca y preferencias — han sido borrados de nuestros sistemas.
          </p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Si cambiaste de opinión o eliminaste tu cuenta por error, puedes volver a registrarte en cualquier momento en <a href="${this.webUrl}/register" style="color:#0D1B2A;font-weight:600;">noetia.app</a>.
          </p>
          <p style="margin:0;color:#94A3B8;font-size:13px;">
            Gracias por haber sido parte de la comunidad Noetia. Esperamos verte de nuevo.
          </p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. Todos los derechos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private giftCardTemplate(buyerName: string, tokenCount: number, message: string | null, occasionLabel: string | null, link: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">Lee. Escucha. Comparte.</p>
        </td></tr>
        <tr><td style="padding:40px;">
          ${occasionLabel ? `<p style="margin:0 0 4px;font-size:24px;text-align:center;">${this.escape(occasionLabel)}</p>` : ''}
          <p style="margin:0 0 16px;color:#1E293B;font-size:20px;font-weight:700;text-align:center;">
            <strong>${this.escape(buyerName)}</strong> te envía un regalo
          </p>
          <div style="background:#F1F5F9;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
            <p style="margin:0 0 4px;font-size:40px;font-weight:900;color:#0D1B2A;">${tokenCount}</p>
            <p style="margin:0;font-size:16px;color:#475569;font-weight:600;">${tokenCount === 1 ? 'Token Noetia' : 'Tokens Noetia'}</p>
            <p style="margin:8px 0 0;font-size:13px;color:#94A3B8;">Cada token desbloquea un libro de tu elección</p>
          </div>
          ${message ? `
          <div style="border-left:3px solid #0D1B2A;padding:12px 16px;margin:0 0 24px;background:#F8FAFC;border-radius:0 8px 8px 0;">
            <p style="margin:0;color:#475569;font-size:15px;font-style:italic;">"${this.escape(message)}"</p>
          </div>` : ''}
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:14px 32px;text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Reclamar mi regalo →</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">Si el botón no funciona, copia este enlace:</p>
          <p style="margin:0;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>
          <p style="margin:32px 0 0;color:#CBD5E1;font-size:12px;text-align:center;">Este regalo es válido por 1 año.</p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. Todos los derechos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private giftConfirmationTemplate(buyerName: string, recipientEmail: string, tokenCount: number): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">¡Tu regalo fue enviado! 🎁</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Hola ${this.escape(buyerName)}, enviamos <strong>${tokenCount} ${tokenCount === 1 ? 'token' : 'tokens'} Noetia</strong> a <strong>${this.escape(recipientEmail)}</strong>.
            Cuando los reclamen podrán desbloquear libros de su elección.
          </p>
          <p style="margin:0;color:#94A3B8;font-size:13px;">¿Tienes preguntas? Escríbenos a hola@noetia.app</p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. Todos los derechos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private planInviteTemplate(inviterName: string, planName: string, link: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">Lee. Escucha. Comparte.</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">Te han invitado a leer juntos</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            <strong>${this.escape(inviterName)}</strong> te está invitando a unirte a su plan <strong>${this.escape(planName)}</strong> en Noetia.
            Con este plan comparten tokens para desbloquear libros, cada uno con su biblioteca personal.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:14px 32px;text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Aceptar invitación →</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">
            Si el botón no funciona, copia este enlace en tu navegador:
          </p>
          <p style="margin:0;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>
          <p style="margin:32px 0 0;color:#CBD5E1;font-size:12px;text-align:center;">
            Este enlace expira en 48 horas. Si no esperabas esta invitación, puedes ignorar este mensaje.
          </p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${new Date().getFullYear()} Noetia. Todos los derechos reservados.</p>
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
