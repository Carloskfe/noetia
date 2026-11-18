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

  it('company footnotes the Causas basis without changing the published revenue split', async () => {
    const es = await render(CompanyContent, 'es');
    expect(es).toContain('2,22% → Causas Noetia*');
    expect(es).toContain('* Programa en preparación. El 2,22% se calcula sobre los ingresos netos elegibles, después de las comisiones de procesamiento de pago');
    for (const row of ['45% → Noetia', '36% → Autor', '9% → Narrador', '7,78% → Marketing']) expect(es).toContain(row);
    const en = await render(CompanyContent, 'en');
    expect(en).toContain('2.22% → Causas Noetia*');
    expect(en).toContain('* Planned program. The 2.22% is calculated on eligible net receipts, after payment-processing fees');
    for (const row of ['45% → Noetia', '36% → Author', '9% → Narrator', '7.78% → Marketing']) expect(en).toContain(row);
  });
});
