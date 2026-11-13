import localFont from 'next/font/local';

/**
 * Display typeface for the public site (Quiet Editorial). Playfair Display (SIL Open Font License), reused from
 * services/image-gen/fonts so the site and the quote cards share one display face. Self-hosted: no third-party
 * font request. Exposed as the CSS variable used by Tailwind's `font-display`.
 */
export const displayFont = localFont({
  src: './fonts/playfair-display.ttf',
  variable: '--font-display',
  display: 'swap',
  weight: '400 900',
});
