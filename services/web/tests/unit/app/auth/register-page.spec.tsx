// NEM-025 B2-A2a — the web registration page sends the active interface language.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));
const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
const mockApiFetch = jest.fn();
jest.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  saveToken: jest.fn(),
  saveUserType: jest.fn(),
  saveEmailConfirmed: jest.fn(),
  postAuthRedirect: jest.fn(() => '/library'),
}));
const mockSocial = jest.fn(() => null);
jest.mock('@/components/SocialAuthButtons', () => ({ __esModule: true, default: () => mockSocial() }));
jest.mock('@/components/LanguagePicker', () => ({ __esModule: true, default: () => null }));
const mockLang = { current: 'es' as 'es' | 'en' | 'fr-CA' };
jest.mock('@/lib/i18n', () => {
  const actual = jest.requireActual('@/lib/i18n');
  const dicts: Record<string, unknown> = {
    es: require('@/lib/i18n/es').es,
    en: require('@/lib/i18n/en').en,
    'fr-CA': require('@/lib/i18n/fr-ca').frCA,
  };
  return { ...actual, useTranslation: () => ({ language: mockLang.current, t: dicts[mockLang.current], setLanguage: jest.fn() }) };
});

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import RegisterPage from '@/app/(auth)/register/page';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockApiFetch.mockReset().mockResolvedValue({ accessToken: 'acc', user: { userType: null, emailConfirmed: false } });
  mockSocial.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function submitAs(lang: 'es' | 'en' | 'fr-CA') {
  mockLang.current = lang;
  await act(async () => root.render(<RegisterPage />));
  const [name, email, password] = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
  await act(async () => {
    type(name, 'Ana');
    type(email, 'ana@example.com');
    type(password, 'password123');
  });
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(mockApiFetch).toHaveBeenCalledTimes(1);
  const [path, init] = mockApiFetch.mock.calls[0];
  return { path, init, body: JSON.parse(init.body) };
}

describe('RegisterPage (B2-A2a)', () => {
  it.each(['es', 'en'] as const)('%s UI → POST /auth/register carries that uiLanguage', async (lang) => {
    const { path, init, body } = await submitAs(lang);
    expect(path).toBe('/auth/register');
    expect(init.method).toBe('POST');
    expect(body).toEqual({ name: 'Ana', email: 'ana@example.com', password: 'password123', uiLanguage: lang });
  });

  it('fr-CA UI (gate on somewhere) → no uiLanguage is sent', async () => {
    const { body } = await submitAs('fr-CA');
    expect(body).toEqual({ name: 'Ana', email: 'ana@example.com', password: 'password123' });
  });

  it('OAuth entry points are rendered unchanged (SocialAuthButtons, no props)', async () => {
    await submitAs('en');
    expect(mockSocial).toHaveBeenCalled();
    expect(mockApiFetch.mock.calls.every(([p]) => p === '/auth/register')).toBe(true);
    expect(mockRouter.push).toHaveBeenCalledWith('/library');
  });
});
