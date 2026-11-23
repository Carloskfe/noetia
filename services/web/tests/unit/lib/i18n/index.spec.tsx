import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { getStoredLanguage, LanguageProvider, useTranslation, type Language } from '@/lib/i18n';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const ENV = 'NEXT_PUBLIC_FR_CA_ENABLED';
let container: HTMLDivElement;
let root: Root;
let api: { language: Language; setLanguage: (l: Language) => void; t: any };

function Probe() {
  api = useTranslation() as any;
  return React.createElement('span', { 'data-testid': 'lang' }, api.language);
}

function mockFetch(user: unknown) {
  const fn = jest.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({ ok: true, json: async () => user } as Response),
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

async function mount() {
  await act(async () => {
    root.render(React.createElement(LanguageProvider, null, React.createElement(Probe)));
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

const patchCalls = (fn: jest.Mock) => fn.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');

describe('LanguageProvider (NEM-025 Checkpoint A)', () => {
  const prevEnv = process.env[ENV];

  beforeEach(() => {
    localStorage.clear();
    delete process.env[ENV];
    document.documentElement.lang = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (prevEnv === undefined) delete process.env[ENV];
    else process.env[ENV] = prevEnv;
  });

  describe('anonymous visitors', () => {
    it('defaults to Spanish', async () => {
      mockFetch(null);
      await mount();
      expect(api.language).toBe('es');
      expect(document.documentElement.lang).toBe('es');
    });

    it('preserves an existing English preference', async () => {
      localStorage.setItem('noetia_lang', 'en');
      await mount();
      expect(api.language).toBe('en');
      expect(api.t.common.cancel).toBe('Cancel');
    });

    it('ignores a stored fr-CA value while French is gated off', async () => {
      localStorage.setItem('noetia_lang', 'fr-CA');
      await mount();
      expect(api.language).toBe('es');
    });

    it('ignores malformed stored values', async () => {
      localStorage.setItem('noetia_lang', 'pt-BR');
      await mount();
      expect(api.language).toBe('es');
      expect(getStoredLanguage()).toBe('es');
    });

    it('applies a stored fr-CA value and French strings when the gate is enabled', async () => {
      process.env[ENV] = 'true';
      localStorage.setItem('noetia_lang', 'fr-CA');
      await mount();
      expect(api.language).toBe('fr-CA');
      expect(api.t.common.cancel).toBe('Annuler');
      expect(document.documentElement.lang).toBe('fr-CA');
    });
  });

  describe('signed-in users', () => {
    beforeEach(() => localStorage.setItem('noetia_token', 'jwt'));

    it('lets the server es/en preference win, as before', async () => {
      localStorage.setItem('noetia_lang', 'es');
      mockFetch({ uiLanguage: 'en' });
      await mount();
      expect(api.language).toBe('en');
      expect(localStorage.getItem('noetia_lang')).toBe('en');
    });

    it('does not leak a previous account’s device language when the server value is gated', async () => {
      localStorage.setItem('noetia_lang', 'en'); // left by another account on this browser
      const fetchMock = mockFetch({ uiLanguage: 'fr-CA' });
      await mount();
      expect(api.language).toBe('es');
      expect(localStorage.getItem('noetia_lang')).toBe('es');
      expect(patchCalls(fetchMock)).toHaveLength(0); // the account's stored preference is left untouched
    });

    it('keeps the device language when the server value is missing or legacy', async () => {
      localStorage.setItem('noetia_lang', 'en');
      mockFetch({ uiLanguage: 'xx' });
      await mount();
      expect(api.language).toBe('en');
    });

    it('applies a server fr-CA preference when the gate is enabled', async () => {
      process.env[ENV] = 'true';
      mockFetch({ uiLanguage: 'fr-CA' });
      await mount();
      expect(api.language).toBe('fr-CA');
    });

    it('persists an es/en change locally and to the account', async () => {
      const fetchMock = mockFetch({ uiLanguage: 'es' });
      await mount();
      await act(async () => api.setLanguage('en'));
      expect(api.language).toBe('en');
      expect(localStorage.getItem('noetia_lang')).toBe('en');
      const patches = patchCalls(fetchMock);
      expect(patches).toHaveLength(1);
      expect(JSON.parse(String((patches[0][1] as RequestInit).body))).toEqual({ uiLanguage: 'en' });
    });

    it('refuses to switch to fr-CA while gated: no state change, no storage, no API call', async () => {
      const fetchMock = mockFetch({ uiLanguage: 'es' });
      await mount();
      await act(async () => api.setLanguage('fr-CA'));
      expect(api.language).toBe('es');
      expect(localStorage.getItem('noetia_lang')).not.toBe('fr-CA');
      expect(patchCalls(fetchMock)).toHaveLength(0);
    });

    it('switches to fr-CA and syncs it when the gate is enabled', async () => {
      process.env[ENV] = 'true';
      const fetchMock = mockFetch({ uiLanguage: 'es' });
      await mount();
      await act(async () => api.setLanguage('fr-CA'));
      expect(api.language).toBe('fr-CA');
      expect(patchCalls(fetchMock)).toHaveLength(1);
    });
  });
});
