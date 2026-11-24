'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { milestonesCopy } from '@/lib/i18n/pages/milestones';
import { SectionLabel, SectionTitle } from '../_components';

export default function MilestonesContent() {
  const { language } = useTranslation();
  const c = milestonesCopy[language];

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{c.label}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-6">
          {c.heroTitle}
        </h1>
        <p className="text-gray-700 text-[15px] max-w-2xl">
          {c.heroBody}
        </p>
      </section>

      {/* Milestones */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.milestonesTitle}</SectionTitle>
        <div className="space-y-0">
          {c.milestones.map((m) => {
            return (
              <div key={m.title} className="grid grid-cols-12 gap-4 py-5 border-b border-gray-100 last:border-0 items-start">
                <div className="col-span-1 pt-0.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="col-span-11">
                  <p className="font-bold text-[#0D1B2A] text-sm">{m.title}</p>
                  <p className="text-gray-600 text-sm mt-1">{m.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ahead */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.aheadTitle}</SectionTitle>
          <div className="space-y-0">
            {c.ahead.map((item) => (
              <div key={item} className="py-3 border-b border-gray-200 last:border-0">
                <p className="text-[#0D1B2A] text-sm font-medium">→ {item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link href="/register" className="bg-[#0D1B2A] text-white rounded-xl p-6 hover:bg-gray-800 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">{c.productLabel}</p>
            <p className="font-bold">{c.productCta}</p>
          </Link>
          <Link href="/upload-guide" className="border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition group">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">{c.authorsLabel}</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">{c.authorsCta}</p>
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
