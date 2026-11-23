'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { CAUSAS_LINES, causasPageCopy } from '@/lib/i18n/pages/causas';

type Cause = { id: string; slug: string; name: string; description: string; statFact: string; icon: string };

export default function CausasPage() {
  const { language } = useTranslation();
  const c = causasPageCopy[language];
  const [causes, setCauses] = useState<Cause[]>([]);

  useEffect(() => {
    apiFetch('/causes').then(setCauses).catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[#0D1B2A] text-white">

      {/* Nav */}
      <nav className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-widest">NOETIA</Link>
        <Link href="/library" className="text-sm text-slate-400 hover:text-white transition">
          {c.back}
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-16 text-center">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4">
          Causas Noetia
        </p>
        <p data-testid="causas-status" className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200 mb-5">
          {c.status}
        </p>
        <p className="text-slate-400 text-base italic mb-5">
          {c.quote}
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
          {c.heroTitle}
        </h1>
        <p className="text-slate-300 text-lg leading-relaxed max-w-xl mx-auto">
          {c.heroBody}
        </p>
        <div role="note" data-testid="causas-disclosure" className="mt-8 rounded-xl border border-white/15 bg-white/5 p-4 text-left text-sm text-slate-300 max-w-xl mx-auto">
          {c.disclosure}
        </div>
      </section>

      {/* Strategic lines */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid sm:grid-cols-3 gap-5">
          {CAUSAS_LINES.map((line, i) => {
            const copy = c.lines[i];
            return (
              <div key={line.slug} className={`rounded-2xl border bg-gradient-to-b ${line.color} p-6`}>
                <span className="text-4xl block mb-4">{line.icon}</span>
                <h2 className={`text-base font-bold mb-2 ${line.accent}`}>{copy.name}</h2>
                <p className="text-slate-300 text-sm leading-relaxed">{copy.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/10 bg-white/5">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <h2 className="text-xl font-bold text-white mb-8 text-center">
            {c.howTitle}
          </h2>
          <div className="space-y-5">
            {c.how.map((text, i) => {
              const step = String(i + 1).padStart(2, '0');
              return (
              <div key={step} className="flex gap-4 items-start">
                <span className="text-xs font-bold text-emerald-400 tracking-widest w-8 shrink-0 mt-0.5">{step}</span>
                <p className="text-slate-300 text-sm leading-relaxed">{text}</p>
              </div>
            );
            })}
          </div>
        </div>
      </section>

      {/* Alliance invitation */}
      <section className="border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/30 p-8 sm:p-12 text-center">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4">
              {c.allianceEyebrow}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-snug">
              {c.allianceTitle}
            </h2>
            <p className="text-slate-300 text-base leading-relaxed max-w-xl mx-auto mb-8">
              {c.allianceBody}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              {c.criteria.map((criterion) => (
                <div key={criterion} className="flex items-center gap-2 text-sm text-slate-300">
                  <span>✅</span>
                  <span>{criterion}</span>
                </div>
              ))}
            </div>

            <a
              href={`mailto:causas@noetia.app?subject=${encodeURIComponent(c.mailSubject)}`}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl transition text-base"
            >
              {c.mailCta}
            </a>
            <p className="text-xs text-slate-500 mt-5 max-w-md mx-auto">
              {c.allianceNote}
            </p>
          </div>
        </div>
      </section>


    </main>
  );
}
