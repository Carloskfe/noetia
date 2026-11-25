'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { CONTACT_CHANNELS, contactCopy } from '@/lib/i18n/pages/contact';
import { SectionLabel } from '../_components';

export default function ContactContent() {
  const { language } = useTranslation();
  const c = contactCopy[language];

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{c.label}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-6">
          {c.heroTitle}
        </h1>
        <p className="text-gray-700 text-[15px] max-w-xl">
          {c.heroBody}
        </p>
      </section>

      {/* Channels */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {CONTACT_CHANNELS.map(({ icon, email }, i) => {
            const ch = c.channels[i];
            return (
              <a key={email} href={`mailto:${email}`} className="group border border-gray-100 rounded-xl p-6 hover:border-indigo-300 hover:shadow-sm transition block">
                <div className="flex items-start gap-4">
                  <span className="text-2xl shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0D1B2A] text-sm mb-1">{ch.label}</p>
                    <p className="text-indigo-600 text-sm font-medium group-hover:underline truncate mb-2">{email}</p>
                    <p className="text-gray-600 text-xs leading-relaxed">{ch.use}</p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Trust */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">
            {c.trust}
          </p>
        </div>
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
