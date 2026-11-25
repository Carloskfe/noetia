'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { careersCopy } from '@/lib/i18n/pages/careers';
import { SectionLabel, SectionTitle } from '../_components';

export default function CareersContent() {
  const { language } = useTranslation();
  const c = careersCopy[language];

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{c.label}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-6">
          {c.heroTitle}
        </h1>
        <p className="text-xl text-[#0D1B2A] font-semibold max-w-2xl">
          {c.heroBody}
        </p>
      </section>

      {/* Work life */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.workTitle}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {c.work.map((w) => (
              <div key={w.title} className="bg-white border border-gray-100 rounded-xl p-6">
                <h3 className="font-bold text-[#0D1B2A] text-sm mb-2">{w.title}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.principlesTitle}</SectionTitle>
        <div className="space-y-0">
          {c.principles.map((principle, i) => (
            <div key={i} className="flex gap-4 py-4 border-b border-gray-50 last:border-0">
              <span className="text-xs font-bold text-indigo-400 shrink-0 w-6">{String(i + 1).padStart(2, '0')}</span>
              <p className="text-[#0D1B2A] text-sm">{principle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* No positions */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.positionsTitle}</SectionTitle>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-[#0D1B2A] font-semibold mb-2">
              {c.noPositions}
            </p>
            <p className="text-gray-500 text-sm mt-3">
              {c.noPositionsNote}
            </p>
          </div>
        </div>
      </section>

      {/* Talent community */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.communityTitle}</SectionTitle>
        <p className="text-gray-600 text-sm mb-6 max-w-xl">
          {c.communityBody}
        </p>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-8">
          <p className="text-sm text-gray-600 mb-4">
            {c.emailLead}{' '}
            <a href="mailto:equipo@noetia.app" className="text-indigo-600 font-semibold hover:underline">equipo@noetia.app</a>{' '}
            {c.emailTail}
          </p>
          <a href="mailto:equipo@noetia.app?subject=Talent%20community" className="inline-flex items-center gap-2 bg-[#0D1B2A] text-white font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition text-sm">
            {c.emailCta}
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/team" className="border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition group">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">{c.teamLabel}</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">{c.teamCta}</p>
          </Link>
          <Link href="/contact" className="border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition group">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">{c.contactLabel}</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">{c.contactCta}</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
