'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { aboutCopy } from '@/lib/i18n/pages/about';
import { BiSection, PageCTA, SectionLabel, SectionTitle } from '../_components';

export default function AboutContent() {
  const { language } = useTranslation();
  const c = aboutCopy[language];

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>
          {c.label}
        </SectionLabel>
        <div className="space-y-2 mb-8">
          <h1 className="text-5xl sm:text-6xl font-bold text-[#0D1B2A] leading-none">
            {c.heroTitle}
          </h1>
          <div className="h-4" />
          <p className="text-3xl font-bold text-[#0D1B2A]">
            {c.heroSubtitle}
          </p>
        </div>
        <PageCTA
          href="/register"
          label={c.ctaPrimary}
          secondary={{ href: '/library', label: c.ctaSecondary }}
        />
      </section>

      {/* Mission + Vision */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
          <div>
            <SectionLabel>{c.missionLabel}</SectionLabel>
            <p className="text-[#0D1B2A] font-semibold text-lg leading-snug">
              {c.mission}
            </p>
          </div>
          <div>
            <SectionLabel>{c.visionLabel}</SectionLabel>
            <p className="text-[#0D1B2A] font-semibold text-lg leading-snug">
              {c.vision}
            </p>
          </div>
        </div>
      </section>

      {/* Why We Exist */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.whyTitle}</SectionTitle>
          <BiSection>{c.why}</BiSection>
        </div>
      </section>

      {/* What We Do */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.whatTitle}</SectionTitle>
        <BiSection>
          <p>{c.whatIntro}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
            {c.acts.map((a) => (
              <div key={a} className="bg-indigo-50 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 text-center">{a}</div>
            ))}
          </div>
          {c.whatBody}
        </BiSection>
      </section>

      {/* Our Approach */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.approachTitle}</SectionTitle>
          <BiSection>{c.approach}</BiSection>
        </div>
      </section>

      {/* Core Values */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle>{c.valuesTitle}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {c.values.map((v) => (
            <div key={v.title} className="border border-gray-100 rounded-xl p-6">
              <h3 className="font-bold text-[#0D1B2A] mb-3 text-sm">{v.title}</h3>
              <p className="text-gray-700 text-sm leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Company Story */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle>{c.storyTitle}</SectionTitle>
          <BiSection>{c.story}</BiSection>
        </div>
      </section>

      {/* CTA */}
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
