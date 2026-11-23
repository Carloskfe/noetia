'use client';

import Link from 'next/link';
import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { uploadGuideCopy } from '@/lib/i18n/pages/upload-guide';

function Section({ id, title, icon, children }: { id?: string; title: string; icon: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
        <span className="text-xl">{icon}</span>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function Spec({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0 items-start">
      <span className="text-sm text-gray-500 w-44 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-blue-700' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-800 leading-relaxed">
      <span className="font-semibold">{label} </span>{children}
    </div>
  );
}

function Warning({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-800 leading-relaxed">
      <span className="font-semibold">{label} </span>{children}
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-gray-100 leading-loose overflow-x-auto">
      {children}
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function UploadGuideContent() {
  const { language } = useTranslation();
  const c = uploadGuideCopy[language];
  const tip   = c.tipLabel;
  const warn  = c.warnLabel;

  return (
    <main className="min-h-screen bg-gray-50 pb-24">

      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 pt-12 pb-8">
          <Link href="/author" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            {c.back}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {c.title}
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {c.intro}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Quick checklist */}
        <section className="bg-blue-600 rounded-2xl p-6 text-white">
          <h2 className="font-bold text-base mb-4">
            {c.checklistTitle}
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {c.checklist.map((item) => (
              <div key={item} className="text-blue-100">{item}</div>
            ))}
          </div>
        </section>

        {/* Process */}
        <Section title={c.processTitle} icon="🗺️">
          <div className="space-y-4">
            {c.steps.map((st) => (
              <Step key={st.n} n={st.n} title={st.title} desc={st.desc} />
            ))}
          </div>
          <div className="mt-5 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
            {c.processNote}
          </div>
        </Section>

        {/* Text */}
        <Section title={c.textTitle} icon="📄">
          <div className="mb-5">
            {c.textSpecs.map((sp) => <Spec key={sp.label} {...sp} />)}
          </div>

          <div className="mb-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">
              {c.textStructureTitle}
            </p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              {c.textStructure}
            </ul>
          </div>

          <CodeBlock>
            {c.textExample}
          </CodeBlock>

          <div className="mt-4">
            <Tip label={tip}>
              {c.textTip}
            </Tip>
          </div>
        </Section>

        {/* Cover */}
        <Section title={c.coverTitle} icon="🖼️">
          <div className="mb-5">
            {c.coverSpecs.map((sp) => <Spec key={sp.label} {...sp} />)}
          </div>
          <Tip label={tip}>
            {c.coverTip}
          </Tip>
          <div className="mt-4">
            <Warning label={warn}>
              {c.coverWarning}
            </Warning>
          </div>
        </Section>

        {/* Audio */}
        <Section title={c.audioTitle} icon="🎙️">
          <div className="mb-5">
            {c.audioSpecs.map((sp) => <Spec key={sp.label} {...sp} />)}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">
              {c.audioRecTitle}
            </p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              {c.audioRec}
            </ul>
          </div>

          <div className="mt-4">
            <Tip label={tip}>
              {c.audioTip}
            </Tip>
          </div>
        </Section>

        {/* Sync */}
        <Section id="sync" title={c.syncTitle} icon="🔗">
          <div className="flex gap-2 items-start mb-5">
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
              {c.syncBadge}
            </span>
            <p className="text-sm text-gray-600">
              {c.syncIntro}
            </p>
          </div>

          <div className="mb-5">
            {c.syncSpecs.map((sp) => <Spec key={sp.label} {...sp} />)}
          </div>

          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              {c.syncHowTitle}
            </p>
            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">A</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {c.optionATitle}
                  </p>
                  <ol className="text-sm text-gray-600 mt-1 space-y-1 list-decimal list-inside">
                    {c.optionASteps}
                  </ol>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">B</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {c.optionBTitle}
                  </p>
                  <ol className="text-sm text-gray-600 mt-1 space-y-1 list-decimal list-inside">
                    {c.optionBSteps}
                  </ol>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.optionBNote}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              {c.srtExampleTitle}
            </p>
            <CodeBlock>
              <div className="text-gray-400 mb-1">
                {c.srtExampleComment}
              </div>
              <div>&nbsp;</div>
              <div>1</div>
              <div>00:00:01,000 --&gt; 00:00:03,500</div>
              <div>{c.srtLines[0]}</div>
              <div>&nbsp;</div>
              <div>2</div>
              <div>00:00:03,700 --&gt; 00:00:06,200</div>
              <div>{c.srtLines[1]}</div>
              <div>&nbsp;</div>
              <div>3</div>
              <div>00:00:06,500 --&gt; 00:00:09,100</div>
              <div>{c.srtLines[2]}</div>
            </CodeBlock>
            <p className="text-xs text-gray-400 mt-1.5">
              {c.vttNote}
            </p>
          </div>

          <Warning label={warn}>
            {c.syncWarning}
          </Warning>
        </Section>

        {/* FAQ */}
        <Section title={c.faqTitle} icon="❓">
          <div className="space-y-5">
            {c.faq.map(({ q, a }) => (
              <div key={q} className="border-b border-gray-50 pb-5 last:border-0 last:pb-0">
                <p className="text-sm font-semibold text-gray-900 mb-1">{q}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* CTA */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-7 text-center text-white">
          <h2 className="text-lg font-bold mb-2">
            {c.ctaTitle}
          </h2>
          <p className="text-blue-100 text-sm mb-5 leading-relaxed">
            {c.ctaBody}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/author"
              className="bg-white text-blue-600 font-semibold px-7 py-3 rounded-xl hover:bg-blue-50 transition text-sm"
            >
              {c.ctaPortal}
            </Link>
            <a
              href="mailto:autores@noetia.app"
              className="bg-white/10 border border-white/30 text-white font-semibold px-7 py-3 rounded-xl hover:bg-white/20 transition text-sm"
            >
              {c.ctaContact}
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}
