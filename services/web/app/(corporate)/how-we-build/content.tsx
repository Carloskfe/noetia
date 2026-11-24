'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { howWeBuildCopy, STACK } from '@/lib/i18n/pages/how-we-build';
import { BiSection, SectionLabel, SectionTitle } from '../_components';

export default function HowWeBuildContent() {
  const { language } = useTranslation();
  const c = howWeBuildCopy[language];

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{c.label}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-3">
          {c.heroTitle}
        </h1>
        <p className="text-gray-700 text-[15px] max-w-2xl mt-4">
          {c.heroBody}
        </p>
      </section>

      {/* Philosophy */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.philosophyTitle}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {c.philosophy.map((p) => (
              <div key={p.title} className="bg-white border border-gray-100 rounded-xl p-6">
                <h3 className="font-bold text-[#0D1B2A] mb-3 text-sm">{p.title}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-functional */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.teamsTitle}</SectionTitle>
        <p className="text-gray-600 text-sm mb-8 max-w-2xl">
          {c.teamsIntro}
        </p>
        <div className="space-y-4">
          {c.teams.map((t) => (
            <div key={t.name} className="flex gap-4 items-start border border-gray-100 rounded-xl p-5">
              <span className="text-2xl shrink-0">{t.icon}</span>
              <div>
                <h3 className="font-bold text-[#0D1B2A] text-sm mb-1">{t.name}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lifecycle */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.lifecycleTitle}</SectionTitle>
          <div className="space-y-0">
            {c.lifecycle.map((item, i) => {
              return (
                <div key={item.phase} className="grid grid-cols-12 gap-4 items-start py-5 border-b border-gray-200 last:border-0">
                  <div className="col-span-1">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                  </div>
                  <div className="col-span-11">
                    <p className="font-bold text-[#0D1B2A] text-sm mb-1">{item.phase}</p>
                    <p className="text-gray-700 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.stackTitle}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {STACK.map(({ label, value }) => (
            <div key={label} className="flex gap-3 py-3 border-b border-gray-50 items-start">
              <span className="text-xs font-semibold text-gray-400 w-28 shrink-0">{label}</span>
              <span className="text-sm text-[#0D1B2A] font-medium">{value}</span>
            </div>
          ))}
        </div>
        <BiSection>{c.stackBody}</BiSection>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/careers" className="bg-[#0D1B2A] text-white rounded-xl p-8 hover:bg-gray-800 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">{c.joinLabel}</p>
            <p className="text-xl font-bold">{c.joinCta}</p>
          </Link>
          <Link href="/milestones" className="border border-gray-200 rounded-xl p-8 hover:border-indigo-300 transition group">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-3">{c.progressLabel}</p>
            <p className="text-xl font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">{c.progressCta}</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
