'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { companyCopy } from '@/lib/i18n/pages/company';
import { BiSection, SectionLabel, SectionTitle } from '../_components';

export default function CompanyContent() {
  const { language } = useTranslation();
  const c = companyCopy[language];

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

      {/* The New Category */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.categoryTitle}</SectionTitle>
          <BiSection>{c.category}</BiSection>
        </div>
      </section>

      {/* Four Pillars */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.pillarsTitle}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {c.pillars.map((p) => (
            <div key={p.title} className="border border-gray-100 rounded-xl p-6">
              <span className="text-3xl block mb-4">{p.icon}</span>
              <h3 className="font-bold text-[#0D1B2A] mb-3 text-sm">{p.title}</h3>
              <p className="text-gray-700 text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Transformation Loop */}
      <section className="bg-[#0D1B2A] text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <SectionLabel>{c.transformationLabel}</SectionLabel>
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 leading-snug">
            {c.transformationTitle}
          </h2>
          <div className="text-slate-300 text-[15px] space-y-4 max-w-2xl">
            {c.transformation}
          </div>
        </div>
      </section>

      {/* Areas of Operation */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.operationsTitle}</SectionTitle>
        <div className="space-y-0">
          {c.operations.map((op) => (
            <div key={op} className="py-3 border-b border-gray-100 last:border-0">
              <p className="text-[#0D1B2A] text-sm font-medium">→ {op}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Publishing + Revenue */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.publishingTitle}</SectionTitle>
          <BiSection>{c.publishing}</BiSection>
        </div>
      </section>

      {/* Future Growth */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.futureTitle}</SectionTitle>
        <div className="space-y-0">
          {c.future.map((item) => (
            <div key={item} className="py-3 border-b border-gray-100 last:border-0">
              <p className="text-[#0D1B2A] text-sm font-medium">→ {item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTAs */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {c.links.map(({ href, label, cta }) => (
            <Link key={href} href={href} className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">{label}</p>
              <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">{cta}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
