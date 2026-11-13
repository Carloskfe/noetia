// /causas public copy must match the PO-053 policy (one cause; equal default) and the homepage wording,
// and must not claim executed contributions, published reports, two causes or random distribution.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));
jest.mock('@/lib/api', () => ({ apiFetch: jest.fn(() => Promise.resolve([])) }));
const mockLang = { current: 'es' as 'es' | 'en' };
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ language: mockLang.current }) }));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import CausasPage from '@/app/causas/page';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
async function render(lang: 'es' | 'en') {
  mockLang.current = lang;
  await act(async () => { root.render(React.createElement(CausasPage)); });
  return norm(container.textContent ?? '');
}
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('/causas copy (PO-053)', () => {
  it.each([['es', es], ['en', en]] as const)('states the approved distribution rule, matching the homepage (%s)', async (lang, t) => {
    const text = await render(lang);
    // The homepage sentence after the commitment clause must appear verbatim on /causas.
    const rule = t.landing.causas.body.split(lang === 'es' ? 'Causas Noetia. ' : 'Causas Noetia. ')[1];
    expect(text).toContain(norm(rule));
    expect(text).toMatch(lang === 'es' ? /2,22%/ : /2\.22%/);
  });

  it.each(['es', 'en'] as const)('keeps the three approved causes (%s)', async (lang) => {
    const text = await render(lang);
    const names = lang === 'es' ? ['Bienestar Animal', 'Niñez y Juventud', 'Medio Ambiente'] : ['Animal Welfare', 'Children & Youth', 'Environment'];
    for (const n of names) expect(text).toContain(n);
  });

  it.each(['es', 'en'] as const)('makes no two-cause, random, executed-contribution or published-report claims (%s)', async (lang) => {
    const text = await render(lang);
    expect(text).not.toMatch(/aleator|random|hasta dos|up to two|primer día|day one|sin excepción|without exception|Publicamos|We publish|activa automáticamente|automatically activates|Apoyamos|We support|donad|donated/i);
  });
});
