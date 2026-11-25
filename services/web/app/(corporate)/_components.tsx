'use client';

import Link from 'next/link';
import React from 'react';
import { selectableLanguages, useTranslation } from '@/lib/i18n';
import { CORPORATE_LANGUAGE_LABELS, corporateNavCopy } from '@/lib/i18n/pages/corporate-nav';

export function CorporateNav() {
  const { language, setLanguage } = useTranslation();
  const c = corporateNavCopy[language];
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold tracking-widest text-[#0D1B2A] shrink-0">
          NOETIA
        </Link>
        <div className="hidden lg:flex items-center gap-6 text-sm text-gray-500">
          {c.links.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-[#0D1B2A] transition">
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Language toggle — driven by the shared gated locale system; FR appears only when the
              French readiness gate is enabled (default: hidden). */}
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
            {selectableLanguages().map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1.5 transition ${language === lang ? 'bg-[#0D1B2A] text-white' : 'text-gray-400 hover:text-gray-700'}`}
              >
                {CORPORATE_LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
          <Link href="/login" className="hidden sm:block text-sm text-gray-500 hover:text-[#0D1B2A] transition">
            {c.signIn}
          </Link>
          <Link href="/register" className="bg-[#0D1B2A] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition">
            {c.createAccount}
          </Link>
        </div>
      </div>
    </nav>
  );
}

/** Body block for a section — content comes already resolved from a page dictionary. */
export function BiSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-gray-700 leading-relaxed space-y-4 text-[15px] max-w-3xl">
      {children}
    </div>
  );
}

/** Section H2 — content comes already resolved from a page dictionary. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl sm:text-3xl font-bold text-[#0D1B2A] leading-snug mb-8">
      {children}
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
