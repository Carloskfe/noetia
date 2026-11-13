// Landing page: full-ecosystem presentation with non-interactive premium availability labels.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: any) => {
    const React = require('react');
    return React.createElement('img', { src, alt });
  },
}));

const mockLang = { current: 'es' as 'es' | 'en' };
const mockSetLanguage = jest.fn((l: 'es' | 'en') => { mockLang.current = l; });
jest.mock('@/lib/i18n', () => {
  const { en } = require('../../../lib/i18n/en');
  const { es } = require('../../../lib/i18n/es');
  return {
    useTranslation: () => ({ t: mockLang.current === 'es' ? es : en, language: mockLang.current, setLanguage: mockSetLanguage }),
  };
});

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import LandingContent from '@/app/LandingContent';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(lang: 'es' | 'en' = 'es'): void {
  mockLang.current = lang;
  act(() => { root.render(React.createElement(LandingContent)); });
}
const tier = (name: string) => container.querySelector(`[data-tier="${name}"]`) as HTMLElement;
const hrefs = (el: ParentNode) => Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockSetLanguage.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('LandingContent — ecosystem tiers', () => {
  it.each([['es', es], ['en', en]] as const)('shows Noetia as available and both premium tiers as coming soon (%s)', (lang, t) => {
    render(lang);
    expect(tier('noetia').textContent).toContain(t.landing.eco.available);
    expect(tier('plus').textContent).toContain(t.landing.eco.comingSoon);
    expect(tier('x').textContent).toContain(t.landing.eco.comingSoon);
    expect(t.landing.eco.comingSoon).toBe(lang === 'es' ? 'Próximamente' : 'Coming Soon');
  });

  it('gives premium tiers no link or button (no upgrade, checkout or activation path)', () => {
    render('en');
    for (const name of ['plus', 'x']) {
      expect(tier(name).querySelectorAll('a, button')).toHaveLength(0);
    }
  });

  it('keeps an account action for the available Noetia tier', () => {
    render('en');
    expect(hrefs(tier('noetia'))).toEqual(['/register']);
  });

  it('describes the approved research limits and subscription prerequisite', () => {
    render('en');
    expect(tier('plus').textContent).toMatch(/up to three eligible books/);
    expect(tier('x').textContent).toMatch(/up to ten eligible books/);
    expect(tier('plus').textContent).toContain(en.landing.eco.plus.requirement);
  });

  it('never links anywhere to checkout, billing or premium activation', () => {
    render('es');
    const all = hrefs(container);
    expect(all.some((h) => /checkout|billing|subscribe|upgrade|plus|noetiax/i.test(h ?? ''))).toBe(false);
  });

  it('does not advertise unapproved conceptual capabilities or prices', () => {
    render('en');
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/matrix|matriz|\$\d/i);
  });
});

describe('LandingContent — Causas Noetia', () => {
  it.each([['es', es], ['en', en]] as const)('keeps the 2.22%% commitment and the approved one-cause / equal-default wording (%s)', (lang, t) => {
    render(lang);
    const text = container.textContent ?? '';
    expect(text).toContain(t.landing.causas.body);
    expect(text).toMatch(lang === 'es' ? /2,22%/ : /2\.22%/);
    for (const c of t.landing.causas.causes) expect(text).toContain(c.title);
  });

  it('uses commitment wording, not executed-contribution claims', () => {
    for (const t of [es, en]) {
      expect(t.landing.causas.body).not.toMatch(/donad|donated|aleator|random|dos causas|two causes/i);
    }
  });
});

describe('LandingContent — navigation and footer', () => {
  it('has product-focused navigation with sign-in and account actions', () => {
    render('es');
    const all = hrefs(container);
    for (const h of ['#como-funciona', '#ecosistema', '/library', '/pricing', '/login', '/register']) expect(all).toContain(h);
    expect(all).not.toContain('/careers');
  });

  it('renders no footer of its own (the global footer is the only one)', () => {
    render('es');
    expect(container.querySelector('footer')).toBeNull();
  });

  it('opens and closes the mobile menu, including with Escape', () => {
    render('en');
    const open = container.querySelector('button[aria-controls="landing-menu"]') as HTMLButtonElement;
    expect(open.getAttribute('aria-expanded')).toBe('false');
    act(() => { open.click(); });
    const menu = container.querySelector('#landing-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(hrefs(menu)).toEqual(expect.arrayContaining(['/login', '/register']));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(container.querySelector('#landing-menu')).toBeNull();
  });

  it('switches language through the existing i18n provider', () => {
    render('es');
    const enBtn = Array.from(container.querySelectorAll('button[aria-pressed]')).find((b) => b.textContent === 'EN') as HTMLButtonElement;
    act(() => { enBtn.click(); });
    expect(mockSetLanguage).toHaveBeenCalledWith('en');
  });
});
