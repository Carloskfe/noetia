import type { SafeHtml } from '../escape';

/**
 * Typed transactional-email dictionary (NEM-025 B2-A1). One object per locale (`es`, `en`, `fr-CA`);
 * each dictionary is declared `satisfies EmailCopy`, so a missing key or a wrong interpolation
 * signature in any locale fails the type check.
 *
 * Conventions:
 * - Functions taking `SafeHtml` interpolate user-provided values that the caller has already escaped.
 * - Subject builders that take `SafeHtml` reproduce today's behaviour, where subjects carry the
 *   HTML-escaped form of names and plan names (pre-existing X-5, preserved; correction belongs to B2-A2).
 * - Plain `string` subject parameters are inserted raw (plain-text header), as today.
 * - Values may contain inline markup (`<strong>`) exactly where the original templates did.
 */
export interface EmailCopy {
  common: {
    tagline: string;
    rightsReserved: string;
    /** Link fallback used by confirmation, password reset and plan invite. */
    linkFallbackBrowser: string;
    /** Shorter link fallback used by gift card and waitlist invite. */
    linkFallbackShort: string;
  };
  confirmation: {
    subject: string;
    greeting: (name: SafeHtml) => string;
    body: string;
    cta: string;
    expiry: string;
  };
  passwordReset: {
    subject: string;
    greeting: (name: SafeHtml) => string;
    body: string;
    cta: string;
    expiry: string;
  };
  farewell: {
    subject: string;
    greeting: (name: SafeHtml) => string;
    body: string;
    /** `registerLink` is the server-built `<a href="{WEB_URL}/register">noetia.app</a>` anchor. */
    registerAgain: (registerLink: SafeHtml) => string;
    thanks: string;
  };
  waitlistConfirmation: {
    subject: string;
    heading: (name: SafeHtml) => string;
    intro: string;
    notify: string;
    whatIs: string;
    activeListening: string;
    activeListeningDesc: string;
    fragments: string;
    fragmentsDesc: string;
    share: string;
    shareDesc: string;
  };
  waitlistInvite: {
    subject: string;
    eyebrow: string;
    heading: (name: SafeHtml) => string;
    body: string;
    cta: string;
  };
  giftCard: {
    subject: (buyerName: SafeHtml, tokenCount: number) => string;
    heading: (buyerName: SafeHtml) => string;
    tokenLabel: (tokenCount: number) => string;
    eachToken: string;
    quote: (message: SafeHtml) => string;
    cta: string;
    validity: string;
  };
  giftConfirmation: {
    subject: (recipientEmail: string) => string;
    heading: string;
    body: (buyerName: SafeHtml, tokenCount: number, recipientEmail: SafeHtml) => string;
    questions: (supportEmail: string) => string;
  };
  planInvite: {
    subject: (inviterName: SafeHtml, planName: SafeHtml) => string;
    heading: string;
    body: (inviterName: SafeHtml, planName: SafeHtml) => string;
    cta: string;
    expiry: string;
  };
}
