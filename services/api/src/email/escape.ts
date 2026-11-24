/**
 * Typed HTML-escaping helpers for transactional email (NEM-025 B2-A1).
 *
 * `SafeHtml` is a compile-time brand: copy functions that interpolate user-provided values accept only
 * `SafeHtml`, so a raw name, gift message, occasion label, plan name or e-mail address cannot reach the
 * HTML without passing through `escapeHtml()`.
 *
 * `escapeHtml()` is byte-identical to the pre-B2 `EmailService.escape()` (escapes `&`, `<`, `>` only).
 * Quotes are NOT escaped, so user values must only ever be placed in text nodes, never in attributes.
 */
declare const safeHtmlBrand: unique symbol;
export type SafeHtml = string & { readonly [safeHtmlBrand]: true };

export function escapeHtml(value: string): SafeHtml {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') as SafeHtml;
}

/**
 * Marks server-built markup or server-generated values (links built from `WEB_URL` + a server token,
 * the farewell register anchor) as safe. Never call this on user-provided input.
 */
export function trustedHtml(value: string): SafeHtml {
  return value as SafeHtml;
}
