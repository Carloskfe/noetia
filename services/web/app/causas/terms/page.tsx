import Link from 'next/link';
import {
  CAUSAS_TERMS_DRAFT_EN,
  CAUSAS_TERMS_DRAFT_ES,
  CAUSAS_TERMS_DRAFT_STATUS,
} from '@/lib/legal/causas-program-terms-draft';

// Draft program terms (PO 2026-11-18). Not legally reviewed: kept out of search indexes and the sitemap, and every
// render leads with the draft banner so the page can never read as approved terms.
export const metadata = {
  title: 'Causas Noetia — Términos del programa (borrador) / Program terms (draft)',
  robots: { index: false, follow: false },
};

export default function CausasTermsDraftPage() {
  const s = CAUSAS_TERMS_DRAFT_STATUS;
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <Link href="/causas" className="text-sm text-gray-500 hover:text-gray-800">← Causas Noetia</Link>

        <div role="note" data-testid="draft-banner" className="mt-6 mb-10 rounded-xl border-2 border-amber-400 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-900">{s.es.label} · {s.en.label}</p>
          <p className="mt-2 text-sm text-amber-900" lang="es">{s.es.body}</p>
          <p className="mt-2 text-sm text-amber-900" lang="en">{s.en.body}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <article lang="es" className="text-gray-700">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Español</div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{CAUSAS_TERMS_DRAFT_ES.trim()}</pre>
          </article>
          <article lang="en" className="text-gray-700 lg:border-l lg:border-gray-100 lg:pl-8">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">English</div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{CAUSAS_TERMS_DRAFT_EN.trim()}</pre>
          </article>
        </div>
      </div>
    </main>
  );
}
