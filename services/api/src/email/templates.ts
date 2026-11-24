import type { EmailCopy } from './copy';
import type { SafeHtml } from './escape';

/**
 * Shared transactional-email rendering (NEM-025 B2-A1).
 *
 * Every template reproduces the pre-B2 markup byte for byte (proven by the golden master). The two
 * historical layout variants are kept: the "standard" shell (DOCTYPE on its own line, footer row) and the
 * "compact" waitlist shell (DOCTYPE and <html> on one line, copyright inside the body, `</body></html>`).
 *
 * `htmlLang` is inserted exactly as received by the public EmailService method, as before (pre-existing
 * X-4; canonicalization is N-1, which is not authorized in B2-A1). User-provided values arrive only as
 * `SafeHtml` and are placed in text nodes, never in attributes.
 */

const HEAD = '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>';
const BODY_OPEN = `<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">`;
const P_BODY = '<p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">';
const P_HEADING = '<p style="margin:0 0 16px;color:#1E293B;font-size:18px;font-weight:600;">';
const P_LINK = '<p style="margin:0;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">';
const P_FALLBACK = '<p style="margin:0 0 8px;color:#94A3B8;font-size:13px;text-align:center;">';
const P_SMALLPRINT = '<p style="margin:32px 0 0;color:#CBD5E1;font-size:12px;text-align:center;">';

const year = () => new Date().getFullYear();

interface ShellOptions {
  htmlLang: string;
  copy: EmailCopy;
  /** Show the tagline under the NOETIA header (absent in farewell and gift confirmation). */
  tagline: boolean;
  /** Compact waitlist variant: no footer row, one-line DOCTYPE, `</body></html>`. */
  compact: boolean;
  body: string;
}

function shell({ htmlLang, copy, tagline, compact, body }: ShellOptions): string {
  const open = compact
    ? `\n<!DOCTYPE html><html lang="${htmlLang}">\n`
    : `\n<!DOCTYPE html>\n<html lang="${htmlLang}">\n`;
  const taglineRow = tagline
    ? `\n          <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">${copy.common.tagline}</p>`
    : '';
  const footerRow = compact
    ? ''
    : `
        <tr><td style="background:#F8FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:12px;">© ${year()} Noetia. ${copy.common.rightsReserved}</p>
        </td></tr>`;
  const close = compact ? '</body></html>' : '</body>\n</html>';
  return `${open}${HEAD}
${BODY_OPEN}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0D1B2A;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">NOETIA</h1>${taglineRow}
        </td></tr>
        <tr><td style="padding:40px;">
${body}
        </td></tr>${footerRow}
      </table>
    </td></tr>
  </table>
${close}`;
}

/** Multi-line paragraph: opening tag, text indented 12 spaces, closing tag. */
const block = (openTag: string, text: string) => `          ${openTag}\n            ${text}\n          </p>`;

function button(link: SafeHtml, label: string, padding: string): string {
  return `          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td style="background:#0D1B2A;border-radius:8px;padding:${padding};text-align:center;">
              <a href="${link}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${label}</a>
            </td></tr>
          </table>`;
}

const inlineCopyright = (copy: EmailCopy) =>
  `          <p style="margin:0;color:#CBD5E1;font-size:12px;text-align:center;">© ${year()} Noetia. ${copy.common.rightsReserved}</p>`;

export function renderConfirmation(copy: EmailCopy, htmlLang: string, name: SafeHtml, link: SafeHtml): string {
  const c = copy.confirmation;
  const body = [
    `          ${P_HEADING}${c.greeting(name)}</p>`,
    block(P_BODY, c.body),
    button(link, c.cta, '14px 32px'),
    block(P_FALLBACK, copy.common.linkFallbackBrowser),
    `          ${P_LINK}${link}</p>`,
    block(P_SMALLPRINT, c.expiry),
  ].join('\n');
  return shell({ htmlLang, copy, tagline: true, compact: false, body });
}

export function renderPasswordReset(copy: EmailCopy, htmlLang: string, name: SafeHtml, link: SafeHtml): string {
  const c = copy.passwordReset;
  const body = [
    `          ${P_HEADING}${c.greeting(name)}</p>`,
    block(P_BODY, c.body),
    button(link, c.cta, '14px 32px'),
    block(P_FALLBACK, copy.common.linkFallbackBrowser),
    `          ${P_LINK}${link}</p>`,
    block(P_SMALLPRINT, c.expiry),
  ].join('\n');
  return shell({ htmlLang, copy, tagline: true, compact: false, body });
}

export function renderWaitlistConfirmation(copy: EmailCopy, htmlLang: string, name: SafeHtml): string {
  const c = copy.waitlistConfirmation;
  const body = [
    `          ${P_HEADING}${c.heading(name)}</p>`,
    block(P_BODY, c.intro),
    block(P_BODY, c.notify),
    `          <div style="background:#F1F5F9;border-radius:8px;padding:20px;margin:0 0 24px;">`,
    `            <p style="margin:0 0 8px;color:#0D1B2A;font-size:14px;font-weight:600;">${c.whatIs}</p>`,
    `            <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">`,
    `              🎧 <strong>${c.activeListening}</strong> — ${c.activeListeningDesc}<br>`,
    `              ✍️ <strong>${c.fragments}</strong> — ${c.fragmentsDesc}<br>`,
    `              📲 <strong>${c.share}</strong> — ${c.shareDesc}`,
    `            </p>`,
    `          </div>`,
    inlineCopyright(copy),
  ].join('\n');
  return shell({ htmlLang, copy, tagline: true, compact: true, body });
}

export function renderWaitlistInvite(copy: EmailCopy, htmlLang: string, name: SafeHtml, link: SafeHtml): string {
  const c = copy.waitlistInvite;
  const body = [
    `          <p style="margin:0 0 8px;color:#0D1B2A;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${c.eyebrow}</p>`,
    `          <p style="margin:0 0 16px;color:#1E293B;font-size:22px;font-weight:700;">${c.heading(name)}</p>`,
    block('<p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.6;">', c.body),
    button(link, c.cta, '16px 40px'),
    block(P_FALLBACK, copy.common.linkFallbackShort),
    `          <p style="margin:0 0 32px;color:#0D1B2A;font-size:12px;text-align:center;word-break:break-all;">${link}</p>`,
    inlineCopyright(copy),
  ].join('\n');
  return shell({ htmlLang, copy, tagline: true, compact: true, body });
}

export function renderFarewell(copy: EmailCopy, htmlLang: string, name: SafeHtml, registerLink: SafeHtml): string {
  const c = copy.farewell;
  const body = [
    `          ${P_HEADING}${c.greeting(name)}</p>`,
    block(P_BODY, c.body),
    block(P_BODY, c.registerAgain(registerLink)),
    block('<p style="margin:0;color:#94A3B8;font-size:13px;">', c.thanks),
  ].join('\n');
  return shell({ htmlLang, copy, tagline: false, compact: false, body });
}

export function renderGiftCard(
  copy: EmailCopy,
  htmlLang: string,
  buyerName: SafeHtml,
  tokenCount: number,
  message: SafeHtml | null,
  occasionLabel: SafeHtml | null,
  link: SafeHtml,
): string {
  const c = copy.giftCard;
  const occasion = occasionLabel ? `<p style="margin:0 0 4px;font-size:24px;text-align:center;">${occasionLabel}</p>` : '';
  const quote = message
    ? `
          <div style="border-left:3px solid #0D1B2A;padding:12px 16px;margin:0 0 24px;background:#F8FAFC;border-radius:0 8px 8px 0;">
            <p style="margin:0;color:#475569;font-size:15px;font-style:italic;">${c.quote(message)}</p>
          </div>`
    : '';
  const body = [
    `          ${occasion}`,
    block('<p style="margin:0 0 16px;color:#1E293B;font-size:20px;font-weight:700;text-align:center;">', c.heading(buyerName)),
    `          <div style="background:#F1F5F9;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">`,
    `            <p style="margin:0 0 4px;font-size:40px;font-weight:900;color:#0D1B2A;">${tokenCount}</p>`,
    `            <p style="margin:0;font-size:16px;color:#475569;font-weight:600;">${c.tokenLabel(tokenCount)}</p>`,
    `            <p style="margin:8px 0 0;font-size:13px;color:#94A3B8;">${c.eachToken}</p>`,
    `          </div>`,
    `          ${quote}`,
    button(link, c.cta, '14px 32px'),
    `          ${P_FALLBACK}${copy.common.linkFallbackShort}</p>`,
    `          ${P_LINK}${link}</p>`,
    `          ${P_SMALLPRINT}${c.validity}</p>`,
  ].join('\n');
  return shell({ htmlLang, copy, tagline: true, compact: false, body });
}

export function renderGiftConfirmation(
  copy: EmailCopy,
  htmlLang: string,
  buyerName: SafeHtml,
  recipientEmail: SafeHtml,
  tokenCount: number,
  supportEmail: string,
): string {
  const c = copy.giftConfirmation;
  const body = [
    `          ${P_HEADING}${c.heading}</p>`,
    block(P_BODY, c.body(buyerName, tokenCount, recipientEmail)),
    `          <p style="margin:0;color:#94A3B8;font-size:13px;">${c.questions(supportEmail)}</p>`,
  ].join('\n');
  return shell({ htmlLang, copy, tagline: false, compact: false, body });
}

export function renderPlanInvite(
  copy: EmailCopy,
  htmlLang: string,
  inviterName: SafeHtml,
  planName: SafeHtml,
  link: SafeHtml,
): string {
  const c = copy.planInvite;
  const body = [
    `          ${P_HEADING}${c.heading}</p>`,
    block(P_BODY, c.body(inviterName, planName)),
    button(link, c.cta, '14px 32px'),
    block(P_FALLBACK, copy.common.linkFallbackBrowser),
    `          ${P_LINK}${link}</p>`,
    block(P_SMALLPRINT, c.expiry),
  ].join('\n');
  return shell({ htmlLang, copy, tagline: true, compact: false, body });
}
