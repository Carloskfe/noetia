import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Quiet Editorial brand tokens (additive). Emerald uses Tailwind's palette: emerald-400 = #34D399 (brand
      // accent on navy), emerald-700 = #047857 (accent on light surfaces).
      colors: {
        navy: { DEFAULT: '#0D1B2A', raised: '#13263A' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
