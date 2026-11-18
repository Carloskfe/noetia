// /causas/terms renders the draft program terms behind a draft banner and is kept out of search indexes.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import CausasTermsDraftPage, { metadata } from '@/app/causas/terms/page';
import { CAUSAS_TERMS_DRAFT_EN, CAUSAS_TERMS_DRAFT_ES } from '@/lib/legal/causas-program-terms-draft';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(React.createElement(CausasTermsDraftPage)); });
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('/causas/terms (draft program terms)', () => {
  it('opens with a bilingual draft / not-in-effect banner before any terms text', () => {
    const banner = container.querySelector('[data-testid="draft-banner"]');
    expect(banner?.getAttribute('role')).toBe('note');
    expect(banner?.textContent).toContain('Borrador para revisión legal — no vigente');
    expect(banner?.textContent).toContain('Draft for legal review — not in effect');
    const firstArticle = container.querySelector('article');
    expect(banner!.compareDocumentPosition(firstArticle!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the full Spanish and English draft side by side with language tags', () => {
    expect(container.querySelector('article[lang="es"] pre')?.textContent).toBe(CAUSAS_TERMS_DRAFT_ES.trim());
    expect(container.querySelector('article[lang="en"] pre')?.textContent).toBe(CAUSAS_TERMS_DRAFT_EN.trim());
  });

  it('links back to /causas and offers no payment or checkout path', () => {
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/causas']);
    expect(container.querySelectorAll('button, form')).toHaveLength(0);
  });

  it('is excluded from search indexing and titled as a draft', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toMatch(/borrador/);
    expect(metadata.title).toMatch(/draft/);
  });
});
