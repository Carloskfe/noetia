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

const FORBIDDEN = /donad|donated|automáticamente|automatically|primer día|day one|apoya causas|supports social causes|cada compra|every purchase|cada pago|every payment/i;

describe('Corporate Causas copy (planned program, PO 2026-11-18)', () => {
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

  it('about describes the planned program, its basis, independent charities and pending partnerships', async () => {
    const es = await render(AboutContent, 'es');
    expect(es).toContain('Con Causas Noetia, un programa en preparación, planeamos destinar el 2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago, a organizaciones benéficas independientes en bienestar animal, niñez y juventud, y medio ambiente.');
    expect(es).toContain('Las alianzas aún están pendientes.');
    const en = await render(AboutContent, 'en');
    expect(en).toContain('Through Causas Noetia, a planned program, we plan to allocate 2.22% of eligible net receipts, after payment-processing fees, to independent charitable organizations in animal welfare, children and youth, and the environment.');
    expect(en).toContain('Partnerships are pending.');
  });

  it('milestones records a planned program, not a donation', async () => {
    expect(await render(MilestonesContent, 'es')).toContain('Programa en preparación: el 2,22% de los ingresos netos elegibles');
    expect(await render(MilestonesContent, 'en')).toContain('A planned program: 2.22% of eligible net receipts, after payment-processing fees');
  });

  it('company shows no revenue-allocation percentages (mixed bases under the new Causas policy; PO 2026-11-18)', async () => {
    for (const lang of ['es', 'en'] as const) {
      const text = await render(CompanyContent, lang);
      expect(text).not.toMatch(/45 ?%|36 ?%|\b9 ?%|2[.,]22 ?%|7[.,]78 ?%/);
      expect(text).not.toMatch(/Distribución de ingresos|Revenue distribution|→ (Noetia|Autor|Author|Narrador|Narrator|Marketing|Causas Noetia)/);
    }
  });

  it('company keeps the qualitative business, author and Causas social-impact descriptions', async () => {
    const es = await render(CompanyContent, 'es');
    expect(es).toContain('Noetia opera como un canal de distribución digital para autores y editoriales');
    expect(es).toContain('Lo que ofrecemos a autores:');
    expect(es).toContain('Impacto social — Causas Noetia (programa en preparación; alianzas pendientes)');
    const en = await render(CompanyContent, 'en');
    expect(en).toContain('Noetia operates as a digital distribution channel for authors and publishers');
    expect(en).toContain('What we offer authors:');
    expect(en).toContain('Social impact — Causas Noetia (planned program; partnerships pending)');
  });
});
