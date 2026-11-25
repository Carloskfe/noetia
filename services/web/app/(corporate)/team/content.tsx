'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { teamCopy } from '@/lib/i18n/pages/team';
import { SectionLabel, SectionTitle } from '../_components';

export default function TeamContent() {
  const { language } = useTranslation();
  const c = teamCopy[language];

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

      {/* Conviction */}
      <section className="bg-[#0D1B2A] text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <SectionLabel>{c.convictionLabel}</SectionLabel>
          <div className="text-slate-200 text-[15px] leading-relaxed space-y-4 max-w-2xl">
            {c.conviction}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.rolesTitle}</SectionTitle>
        <p className="text-gray-500 text-sm mb-8 max-w-2xl">
          {c.rolesIntro}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {c.roles.map((r) => {
            return (
              <div key={r.name} className="border border-gray-100 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{r.icon}</span>
                  <h3 className="font-bold text-[#0D1B2A] text-sm">{r.name}</h3>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{r.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Leadership placeholder */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.leadershipTitle}</SectionTitle>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-gray-400 text-sm">
              {c.leadershipSoon}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/careers" className="bg-[#0D1B2A] text-white rounded-xl p-8 hover:bg-gray-800 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">{c.joinLabel}</p>
            <p className="text-xl font-bold">{c.joinCta}</p>
          </Link>
          <Link href="/how-we-build" className="border border-gray-200 rounded-xl p-8 hover:border-indigo-300 transition group">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-3">{c.engineeringLabel}</p>
            <p className="text-xl font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">{c.engineeringCta}</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
