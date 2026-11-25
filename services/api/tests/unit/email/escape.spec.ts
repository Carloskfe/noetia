/** NEM-025 B2-A1 — typed escaping helpers. */
import { escapeHtml, trustedHtml } from '../../../src/email/escape';

// The pre-B2 EmailService.escape(), reproduced verbatim as the oracle.
const legacyEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

describe('escapeHtml', () => {
  it.each([
    '', 'Ana', '<script>alert(1)</script>', 'a & b', '&amp;', `"quoted" 'single'`, 'José — 李 ’«»', '<<>>&&',
  ])('is byte-identical to the legacy escape for %p', (s) => {
    expect(escapeHtml(s)).toBe(legacyEscape(s));
  });

  it('escapes &, < and > (ampersand first, no double-escaping of the result order)', () => {
    expect(escapeHtml('<a&b>')).toBe('&lt;a&amp;b&gt;');
  });

  it('does not escape quotes — user values must only be placed in text nodes', () => {
    expect(escapeHtml(`"x" 'y'`)).toBe(`"x" 'y'`);
  });
});

describe('trustedHtml', () => {
  it('is an identity marker for server-built markup', () => {
    expect(trustedHtml('<a href="https://noetia.app/register">noetia.app</a>')).toBe('<a href="https://noetia.app/register">noetia.app</a>');
  });
});
