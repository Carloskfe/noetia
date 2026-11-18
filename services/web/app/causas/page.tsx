'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

type Cause = { id: string; slug: string; name: string; description: string; statFact: string; icon: string };

const STRATEGIC_LINES = [
  {
    slug: 'bienestar-animal',
    icon: '🐾',
    es: {
      name: 'Bienestar Animal',
      description: 'Enfoque previsto: iniciativas de rescate, cuidado, rehabilitación y protección de animales en América Latina.',
    },
    en: {
      name: 'Animal Welfare',
      description: 'Planned focus: rescue, care, rehabilitation and protection initiatives for animals in Latin America.',
    },
    color: 'from-amber-900/30 to-amber-950/10 border-amber-500/20',
    accent: 'text-amber-400',
  },
  {
    slug: 'ninez-y-juventud',
    icon: '📚',
    es: {
      name: 'Niñez y Juventud',
      description: 'Enfoque previsto: proyectos que amplían el acceso a la educación, la lectura y las oportunidades para niños y jóvenes.',
    },
    en: {
      name: 'Children & Youth',
      description: 'Planned focus: projects that expand access to education, reading and opportunities for children and young people.',
    },
    color: 'from-blue-900/30 to-blue-950/10 border-blue-500/20',
    accent: 'text-blue-400',
  },
  {
    slug: 'medio-ambiente',
    icon: '🌿',
    es: {
      name: 'Medio Ambiente',
      description: 'Enfoque previsto: la protección de los ecosistemas, la biodiversidad y los recursos naturales de nuestra región.',
    },
    en: {
      name: 'Environment',
      description: 'Planned focus: protecting the ecosystems, biodiversity and natural resources of our region.',
    },
    color: 'from-emerald-900/30 to-emerald-950/10 border-emerald-500/20',
    accent: 'text-emerald-400',
  },
];

// Planned-program wording (PO 2026-11-18). Settlement and refund detail lives in the draft program terms.
const CAUSAS_CHOICE_RULE = {
  es: 'Podrás elegir una causa para recibir esa asignación. Si no eliges ninguna, se repartirá por igual entre las tres.',
  en: 'You\'ll be able to choose one cause to receive that allocation. If you don\'t choose one, it will be split equally among all three.',
};

const HOW_IT_WORKS = [
  {
    step: '01',
    es: 'Cuando el programa comience, planeamos destinar el 2,22% de los ingresos netos elegibles: lo que Noetia recibe después de las comisiones de procesamiento de pago.',
    en: 'Once the program starts, we plan to allocate 2.22% of eligible net receipts: what Noetia receives after payment-processing fees.',
  },
  {
    step: '02',
    es: CAUSAS_CHOICE_RULE.es,
    en: CAUSAS_CHOICE_RULE.en,
  },
  {
    step: '03',
    es: 'La asignación irá a organizaciones benéficas independientes, no a causas operadas por Noetia.',
    en: 'The allocation will go to independent charitable organizations, not to causes operated by Noetia.',
  },
];

const ALLIANCE_CRITERIA = [
  {
    es: 'Trabajo en una de las tres líneas estratégicas',
    en: 'Work within one of the three strategic lines',
  },
  {
    es: 'Operación en América Latina',
    en: 'Operation in Latin America',
  },
  {
    es: 'Impacto documentado y transparente',
    en: 'Documented and transparent impact',
  },
];

export default function CausasPage() {
  const { language } = useTranslation();
  const l = language;
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
          {l === 'es' ? '← Biblioteca' : '← Library'}
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-16 text-center">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4">
          Causas Noetia
        </p>
        <p data-testid="causas-status" className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200 mb-5">
          {l === 'es' ? 'Programa en preparación' : 'Planned program'}
        </p>
        <p className="text-slate-400 text-base italic mb-5">
          {l === 'es' ? '"Creemos que compartir es una forma de ayudar."' : '"We believe sharing is a form of helping."'}
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
          {l === 'es' ? (
            <>Compartir aquí mueve<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                más que páginas.
              </span>
            </>
          ) : (
            <>Sharing here moves<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                more than pages.
              </span>
            </>
          )}
        </h1>
        <p className="text-slate-300 text-lg leading-relaxed max-w-xl mx-auto">
          {l === 'es' ? (
            <>Construimos Noetia para compartir conocimiento, y creemos que compartir
              tiene que significar algo más que alcance. Causas Noetia es un programa en
              preparación: planeamos destinar el <strong className="text-white">2,22%</strong> de
              los ingresos netos elegibles, después de las comisiones de procesamiento de pago, a
              organizaciones benéficas independientes en tres causas.</>
          ) : (
            <>We built Noetia to share knowledge, and we believe sharing must mean something
              more than reach. Causas Noetia is a planned program: we plan to allocate{' '}
              <strong className="text-white">2.22%</strong> of eligible net receipts, after
              payment-processing fees, to independent charitable organizations across three causes.</>
          )}
        </p>
        <div role="note" data-testid="causas-disclosure" className="mt-8 rounded-xl border border-white/15 bg-white/5 p-4 text-left text-sm text-slate-300 max-w-xl mx-auto">
          {l === 'es'
            ? 'Causas Noetia aún no ha comenzado. Las alianzas con organizaciones benéficas están pendientes: no se ha firmado ningún acuerdo y no se ha realizado ninguna contribución. Nombraremos a las organizaciones solo después de firmar los acuerdos.'
            : 'Causas Noetia has not started yet. Charitable partnerships are pending: no agreement has been signed and no contribution has been made. We will name organizations only after agreements are signed.'}
        </div>
      </section>

      {/* Strategic lines */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid sm:grid-cols-3 gap-5">
          {STRATEGIC_LINES.map((line) => {
            const copy = l === 'es' ? line.es : line.en;
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
            {l === 'es' ? '¿Cómo funciona?' : 'How does it work?'}
          </h2>
          <div className="space-y-5">
            {HOW_IT_WORKS.map(({ step, es, en }) => (
              <div key={step} className="flex gap-4 items-start">
                <span className="text-xs font-bold text-emerald-400 tracking-widest w-8 shrink-0 mt-0.5">{step}</span>
                <p className="text-slate-300 text-sm leading-relaxed">{l === 'es' ? es : en}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm">
            <Link href="/causas/terms" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
              {l === 'es' ? 'Términos del programa (borrador, pendiente de revisión legal)' : 'Program terms (draft, pending legal review)'}
            </Link>
          </p>
        </div>
      </section>

      {/* Alliance invitation */}
      <section className="border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/30 p-8 sm:p-12 text-center">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4">
              {l === 'es' ? 'Para organizaciones benéficas' : 'For charitable organizations'}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-snug">
              {l === 'es' ? (
                <>¿Tu proyecto genera cambio real<br className="hidden sm:block" /> en América Latina?</>
              ) : (
                <>Does your project generate real change<br className="hidden sm:block" /> in Latin America?</>
              )}
            </h2>
            <p className="text-slate-300 text-base leading-relaxed max-w-xl mx-auto mb-8">
              {l === 'es'
                ? 'Buscamos organizaciones benéficas independientes en bienestar animal, niñez y juventud, y medio ambiente para las primeras alianzas del programa. Si tu organización trabaja con propósito, con transparencia y con impacto demostrable, queremos conocerte.'
                : 'We are looking for independent charitable organizations in animal welfare, children and youth, and the environment for the program\'s first partnerships. If your organization works with purpose, transparency, and demonstrable impact, we want to meet you.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              {ALLIANCE_CRITERIA.map(({ es, en }) => (
                <div key={es} className="flex items-center gap-2 text-sm text-slate-300">
                  <span>✅</span>
                  <span>{l === 'es' ? es : en}</span>
                </div>
              ))}
            </div>

            <a
              href={`mailto:causas@noetia.app?subject=${encodeURIComponent(l === 'es' ? 'Propuesta de alianza estratégica — Causas Noetia' : 'Strategic alliance proposal — Causas Noetia')}`}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl transition text-base"
            >
              {l === 'es' ? 'Escribenos a causas@noetia.app' : 'Write to causas@noetia.app'}
            </a>
            <p className="text-xs text-slate-500 mt-5 max-w-md mx-auto">
              {l === 'es'
                ? 'Evaluamos cada propuesta con base en transparencia, impacto documentado y alineación con nuestra comunidad de lectores.'
                : 'We evaluate each proposal based on transparency, documented impact, and alignment with our reader community.'}
            </p>
          </div>
        </div>
      </section>


    </main>
  );
}
