// Corporate pages: Causas Noetia is described as a COMMITMENT on every payment (PO-053). No sales have
// occurred, so no copy may claim contributions were paid, donated or automated.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));
const mockLang = { current: 'es' as 'es' | 'en' };
jest.mock('@/lib/i18n', () => {
  const { es } = require('../../../lib/i18n/es');
  const { en } = require('../../../lib/i18n/en');
  return { useTranslation: () => ({ language: mockLang.current, t: mockLang.current === 'es' ? es : en, setLanguage: jest.fn() }) };
});

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import AboutContent from '@/app/(corporate)/about/content';
import MilestonesContent from '@/app/(corporate)/milestones/content';
import CompanyContent from '@/app/(corporate)/company/content';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
async function render(C: React.ComponentType, lang: 'es' | 'en') {
  mockLang.current = lang;
  await act(async () => { root.render(React.createElement(C)); });
  return norm(container.textContent ?? '');
}
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const FORBIDDEN = /donad|donated|automáticamente|automatically|primer día|day one|apoya causas|supports social causes|cada compra|every purchase/i;

describe('Corporate Causas copy (PO-053 commitment tense)', () => {
  it.each([
    ['about', AboutContent],
    ['milestones', MilestonesContent],
    ['company', CompanyContent],
  ] as const)('%s makes no executed-contribution claim (es/en)', async (_n, C) => {
    for (const lang of ['es', 'en'] as const) {
      const text = await render(C, lang);
      expect(text).not.toMatch(FORBIDDEN);
    }
  });

  it('about states the commitment and the three causes', async () => {
    expect(await render(AboutContent, 'es')).toContain('Destinamos el 2,22% de cada pago a Causas Noetia: bienestar animal, niñez y juventud, y medio ambiente.');
    expect(await render(AboutContent, 'en')).toContain('We commit 2.22% of every payment to Causas Noetia: animal welfare, children and youth, and the environment.');
  });

  it('milestones records a commitment, not a donation', async () => {
    expect(await render(MilestonesContent, 'es')).toContain('Compromiso del 2,22% de cada pago con Causas Noetia');
    expect(await render(MilestonesContent, 'en')).toContain('A 2.22% commitment of every payment to Causas Noetia');
  });
});
