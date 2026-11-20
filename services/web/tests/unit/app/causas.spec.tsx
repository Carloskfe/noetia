// /causas public copy: PO-053 rule (one cause; equal default) in the planned-program language of the PO decisions of
// 2026-11-18 (eligible net receipts after processing fees; independent charities; partnerships pending). The
// unfinished program terms are NOT published by the app (PO publication-boundary decision, 2026-11-18). It must not claim executed contributions, signed partnerships, published reports, two causes or random
// distribution, nor keep the superseded "total payment" basis.
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
  it.each(['es', 'en'] as const)('discloses a planned program on eligible net receipts after processing fees (%s)', async (lang) => {
    const text = await render(lang);
    expect(container.querySelector('[data-testid="causas-status"]')?.textContent?.trim()).toBe(lang === 'es' ? 'Programa en preparación' : 'Planned program');
    expect(text).toContain(lang === 'es'
      ? 'Causas Noetia es un programa en preparación: planeamos destinar el 2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago, a organizaciones benéficas independientes'
      : 'Causas Noetia is a planned program: we plan to allocate 2.22% of eligible net receipts, after payment-processing fees, to independent charitable organizations');
  });

  it.each(['es', 'en'] as const)('discloses that partnerships are pending and nothing has been contributed (%s)', async (lang) => {
    await render(lang);
    const note = norm(container.querySelector('[data-testid="causas-disclosure"]')?.textContent ?? '');
    expect(note).toContain(lang === 'es' ? 'Las alianzas con organizaciones benéficas están pendientes' : 'Charitable partnerships are pending');
    expect(note).toContain(lang === 'es' ? 'no se ha realizado ninguna contribución' : 'no contribution has been made');
  });

  it.each(['es', 'en'] as const)('states the PO-053 one-cause / equal-default rule in future tense (%s)', async (lang) => {
    const text = await render(lang);
    expect(text).toContain(lang === 'es'
      ? 'Podrás elegir una causa para recibir esa asignación. Si no eliges ninguna, se repartirá por igual entre las tres.'
      : "You'll be able to choose one cause to receive that allocation. If you don't choose one, it will be split equally among all three.");
  });

  it.each(['es', 'en'] as const)('does not link to unfinished program terms (%s)', async (lang) => {
    const text = await render(lang);
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes('/causas/terms'))).toBe(false);
    expect(text).not.toMatch(/Términos del programa|Program terms|borrador|draft/i);
  });

  it.each(['es', 'en'] as const)('drops the superseded every-payment / total-payment basis (%s)', async (lang) => {
    const text = await render(lang);
    expect(text).not.toMatch(/cada pago|every payment|total del pago|total payment|Destinamos el|We commit/i);
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

  it.each(['es', 'en'] as const)('shows no unsourced statistics on the cause cards (%s)', async (lang) => {
    const text = await render(lang);
    expect(text).not.toMatch(/70 millones|70 million|1 de cada 3|1 in 3|40%|2,6 millones|2\.6 million/);
  });
});
