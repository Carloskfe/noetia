'use client';

import Link from 'next/link';
import React from 'react';
import { useTranslation } from '@/lib/i18n';

const NAV_LINKS = [
  { href: '/about',        es: 'Sobre Noetia',      en: 'About' },
  { href: '/company',      es: 'Empresa',            en: 'Company' },
  { href: '/how-we-build', es: 'Cómo construimos',   en: 'How we build' },
  { href: '/team',         es: 'Equipo',             en: 'Team' },
  { href: '/careers',      es: 'Carreras',           en: 'Careers' },
  { href: '/contact',      es: 'Contacto',           en: 'Contact' },
];

export function CorporateNav() {
  const { language, setLanguage } = useTranslation();
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold tracking-widest text-[#0D1B2A] shrink-0">
          NOETIA
        </Link>
        <div className="hidden lg:flex items-center gap-6 text-sm text-gray-500">
          {NAV_LINKS.map(({ href, es, en }) => (
            <Link key={href} href={href} className="hover:text-[#0D1B2A] transition">
              {language === 'es' ? es : en}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Language toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
            <button
              onClick={() => setLanguage('es')}
              className={`px-3 py-1.5 transition ${language === 'es' ? 'bg-[#0D1B2A] text-white' : 'text-gray-400 hover:text-gray-700'}`}
            >
              ES
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 transition ${language === 'en' ? 'bg-[#0D1B2A] text-white' : 'text-gray-400 hover:text-gray-700'}`}
            >
              EN
            </button>
          </div>
          <Link href="/login" className="hidden sm:block text-sm text-gray-500 hover:text-[#0D1B2A] transition">
            {language === 'es' ? 'Iniciar sesión' : 'Sign in'}
          </Link>
          <Link href="/register" className="bg-[#0D1B2A] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition">
            {language === 'es' ? 'Crear cuenta' : 'Create account'}
          </Link>
        </div>
      </div>
    </nav>
  );
}

/** Renders only the active-language side. No more side-by-side. */
export function BiSection({ es, en }: { es: React.ReactNode; en: React.ReactNode }) {
  const { language } = useTranslation();
  return (
    <div className="text-gray-700 leading-relaxed space-y-4 text-[15px] max-w-3xl">
      {language === 'es' ? es : en}
    </div>
  );
}

/** Inline text switcher — use inside any element. */
export function LangText({ es, en }: { es: React.ReactNode; en: React.ReactNode }) {
  const { language } = useTranslation();
  return <>{language === 'es' ? es : en}</>;
}

/** Section H2 + optional subline — single language. */
export function SectionTitle({ es, en }: { es: string; en: string }) {
  const { language } = useTranslation();
  return (
    <h2 className="text-2xl sm:text-3xl font-bold text-[#0D1B2A] leading-snug mb-8">
      {language === 'es' ? es : en}
    </h2>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-4">
      {children}
    </p>
  );
}

export function PageCTA({ href, label, secondary }: { href: string; label: string; secondary?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 pt-4">
      <Link href={href} className="inline-flex items-center justify-center bg-[#0D1B2A] text-white font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition text-sm">
        {label}
      </Link>
      {secondary && (
        <Link href={secondary.href} className="inline-flex items-center justify-center border border-gray-200 text-gray-600 font-medium px-6 py-3 rounded-xl hover:border-gray-400 transition text-sm">
          {secondary.label}
        </Link>
      )}
    </div>
  );
}
