'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { trustCopy } from '@/lib/i18n/pages/trust';
import { BiSection, SectionLabel, SectionTitle } from '../_components';

export default function TrustContent() {
  const { language } = useTranslation();
  const c = trustCopy[language];

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
        <p className="text-[#0D1B2A] font-semibold text-sm mt-4">
          {c.heroNote}
        </p>
      </section>

      {/* Data Privacy */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.privacyTitle}</SectionTitle>
          <BiSection>{c.privacy}</BiSection>
        </div>
      </section>

      {/* Security */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.securityTitle}</SectionTitle>
        <div className="space-y-0">
          {c.security.map((item) => (
            <div key={item} className="py-3 border-b border-gray-100 last:border-0">
              <p className="text-[#0D1B2A] text-sm">✓ {item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Your Control */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.controlTitle}</SectionTitle>
          <p className="text-gray-600 text-sm mb-6">
            {c.controlIntro}
          </p>
          <div className="space-y-0">
            {c.controls.map((item) => (
              <div key={item} className="py-3 border-b border-gray-100 last:border-0">
                <p className="text-[#0D1B2A] text-sm">→ {item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reliability + AI */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.reliabilityTitle}</SectionTitle>
        <BiSection>{c.reliability}</BiSection>
      </section>

      {/* Bottom nav */}
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
