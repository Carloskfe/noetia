// Single global footer: dark tone on public navy pages, light elsewhere; legal links always present.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));
const mockPath = { current: '/' };
jest.mock('next/navigation', () => ({ usePathname: () => mockPath.current }));
jest.mock('@/lib/i18n', () => {
  const { es } = require('../../../lib/i18n/es');
  return { useTranslation: () => ({ t: es, language: 'es', setLanguage: jest.fn() }) };
});

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import Footer from '@/components/Footer';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
function render(path: string) {
  mockPath.current = path;
  act(() => { root.render(React.createElement(Footer)); });
}
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('Footer', () => {
  it.each(['/', '/causas'])('uses the dark tone on %s', (path) => {
    render(path);
    expect(container.querySelector('footer')?.getAttribute('data-tone')).toBe('dark');
  });

  it.each(['/library', '/pricing', '/legal/terms'])('uses the light tone on %s', (path) => {
    render(path);
    expect(container.querySelector('footer')?.getAttribute('data-tone')).toBe('light');
  });

  it('always includes the legal links', () => {
    render('/');
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    for (const h of ['/legal/privacy', '/legal/terms', '/legal/cookies']) expect(hrefs).toContain(h);
  });

  it('no longer shows the untranslated positioning strip', () => {
    render('/');
    expect(container.textContent).not.toContain('Knowledge Expression Platform');
  });
});
