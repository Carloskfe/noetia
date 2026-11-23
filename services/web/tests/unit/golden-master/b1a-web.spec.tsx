// NEM-025 Checkpoint B1-A — EN/ES golden master.
//
// Captured on the UNCHANGED Checkpoint A code (PR #78 @ 8114379) before any B1-A refactor. Every
// B1-A surface is rendered in es and en; its visible text and its accessible attributes
// (aria-label, title, placeholder, alt) are stored as snapshots. After the refactor the snapshots
// must be byte-identical, except for intentional EN/ES corrections, which are made in separate,
// documented commits that update only the affected snapshot entries.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: any) => {
    const React = require('react');
    return React.createElement('img', { alt, src: typeof src === 'string' ? src : '' });
  },
}));
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/account/billing',
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({ slug: 'clasicos', id: 'club-1', sessionId: 's-1' }),
}));
jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn((path: string) => {
    if (String(path).startsWith('/collections/')) {
      return Promise.resolve({ id: 'c1', slug: 'clasicos', name: 'Clásicos', description: 'Obras maestras', bookCount: 2, books: [] });
    }
    return Promise.resolve([]);
  }),
  getEmailConfirmed: jest.fn(() => false),
  saveToken: jest.fn(),
}));
const mockLang = { current: 'es' as 'es' | 'en' | 'fr-CA' };
jest.mock('@/lib/i18n', () => {
  const actual = jest.requireActual('@/lib/i18n');
  const dicts: Record<string, unknown> = {
    es: require('@/lib/i18n/es').es,
    en: require('@/lib/i18n/en').en,
    'fr-CA': require('@/lib/i18n/fr-ca').frCA,
  };
  return {
    ...actual,
    useTranslation: () => ({ language: mockLang.current, t: dicts[mockLang.current], setLanguage: jest.fn() }),
  };
});

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import AboutContent from '@/app/(corporate)/about/content';
import CareersContent from '@/app/(corporate)/careers/content';
import CompanyContent from '@/app/(corporate)/company/content';
import ContactContent from '@/app/(corporate)/contact/content';
import HowWeBuildContent from '@/app/(corporate)/how-we-build/content';
import MilestonesContent from '@/app/(corporate)/milestones/content';
import TeamContent from '@/app/(corporate)/team/content';
import TrustContent from '@/app/(corporate)/trust/content';
import { CorporateNav } from '@/app/(corporate)/_components';
import UploadGuideContent from '@/app/(library)/upload-guide/content';
import CausasPage from '@/app/causas/page';
import { BookGrid } from '@/components/BookGrid';
import WaitlistForm from '@/components/WaitlistForm';
import EmailVerificationBanner from '@/components/EmailVerificationBanner';
import InterestsPage from '@/app/onboarding/interests/page';
import CollectionPage from '@/app/(library)/discover/collection/[slug]/page';
import PlanCard from '@/components/PlanCard';
import AccountLayout from '@/app/(account)/layout';
import AuthorPage from '@/app/(admin)/author/page';
import ClubCard from '@/components/ClubCard';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function capture() {
  const attrs: string[] = [];
  container.querySelectorAll('[aria-label],[title],[placeholder],[alt]').forEach((el) => {
    for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
      const v = el.getAttribute(a);
      if (v) attrs.push(`${el.tagName.toLowerCase()}[${a}]=${v}`);
    }
  });
  return { text: norm(container.textContent ?? ''), attrs };
}

async function render(node: React.ReactElement, lang: 'es' | 'en' | 'fr-CA') {
  mockLang.current = lang;
  await act(async () => { root.render(node); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return capture();
}

const BOOKS = [
  { id: 'b1', title: 'Don Quijote', author: 'Cervantes', coverUrl: null, category: 'classic', language: 'es' },
  { id: 'b2', title: 'Candide', author: 'Voltaire', coverUrl: null, category: 'classic', language: 'fr' },
  { id: 'b3', title: 'Meditations', author: 'Marcus Aurelius', coverUrl: null, category: 'classic', language: 'en' },
];
const PLAN = { id: 'p1', name: 'Individual', amountCents: 899, interval: 'month', tokensPerCycle: 1 } as any;
const AUTHOR_BOOKS = [
  { id: 'a1', title: 'Mi libro', author: 'Autora', category: 'fiction', isPublished: true, coverUrl: null, createdAt: '2026-11-01T00:00:00Z' },
  { id: 'a2', title: 'Borrador', author: 'Autora', category: 'fiction', isPublished: false, coverUrl: null, createdAt: '2026-11-02T00:00:00Z' },
];
const AUTHOR_ANALYTICS = {
  books: [{ id: 'a1', title: 'Mi libro', isPublished: true, readers: 4, shareCount: 2, storageMB: 12 }],
  totalReaders: 4, totalShares: 2, totalStorageMB: 12,
};
const CLUB = { id: 'c1', name: 'Club', description: null, type: 'public', memberCount: 3, coverUrl: null, activeBook: null } as any;

export const SURFACES: Array<[string, () => React.ReactElement]> = [
  ['corporate/about', () => <AboutContent />],
  ['corporate/careers', () => <CareersContent />],
  ['corporate/company', () => <CompanyContent />],
  ['corporate/contact', () => <ContactContent />],
  ['corporate/how-we-build', () => <HowWeBuildContent />],
  ['corporate/milestones', () => <MilestonesContent />],
  ['corporate/team', () => <TeamContent />],
  ['corporate/trust', () => <TrustContent />],
  ['corporate/nav', () => <CorporateNav />],
  ['upload-guide', () => <UploadGuideContent />],
  ['causas', () => <CausasPage />],
  ['book-grid', () => <BookGrid books={BOOKS} libraryBookIds={new Set(['b1'])} onAdd={() => {}} />],
  ['waitlist-form', () => <WaitlistForm />],
  ['email-verification-banner', () => <EmailVerificationBanner />],
  ['onboarding/interests', () => <InterestsPage />],
  ['discover/collection', () => <CollectionPage />],
  ['plan-card', () => <PlanCard plan={PLAN} onSelect={() => {}} />],
  ['account/layout', () => <AccountLayout><p>child</p></AccountLayout>],
  ['author-portal', () => <AuthorPage />],
  ['club-card', () => <ClubCard club={CLUB} />],
];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('access_token', 'jwt');
  global.fetch = jest.fn((url: string) => {
    const u = String(url);
    let body: unknown = [];
    if (u.includes('/authors/me/books')) body = AUTHOR_BOOKS;
    else if (u.includes('/authors/me/analytics')) body = AUTHOR_ANALYTICS;
    else if (u.includes('/authors/me/quota')) body = { tier: 'free', limit: 3, used: 1, remaining: 2 };
    return Promise.resolve({ ok: true, json: async () => body } as Response);
  }) as any;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('B1-A EN/ES golden master', () => {
  it.each(SURFACES)('%s renders the same ES and EN text and accessible attributes', async (_name, make) => {
    const es = await render(make(), 'es');
    act(() => root.unmount());
    root = createRoot(container);
    const en = await render(make(), 'en');
    expect({ es, en }).toMatchSnapshot();
  });
});
