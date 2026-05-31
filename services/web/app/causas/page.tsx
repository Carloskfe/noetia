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
      description: 'Apoyamos iniciativas de rescate, cuidado, rehabilitación y protección de animales en América Latina.',
      stat: 'Más de 70 millones de perros y gatos viven en condición de abandono en América Latina.',
    },
    en: {
      name: 'Animal Welfare',
      description: 'We support rescue, care, rehabilitation, and protection initiatives for animals in Latin America.',
      stat: 'More than 70 million dogs and cats live in abandonment in Latin America.',
    },
    color: 'from-amber-900/30 to-amber-950/10 border-amber-500/20',
    accent: 'text-amber-400',
  },
  {
    slug: 'ninez-y-juventud',
    icon: '📚',
    es: {
      name: 'Niñez y Juventud',
      description: 'Impulsamos proyectos que amplían el acceso a la educación, la lectura y las oportunidades para niños y jóvenes.',
      stat: '1 de cada 3 niños en América Latina no tiene acceso a libros fuera del aula escolar.',
    },
    en: {
      name: 'Children & Youth',
      description: 'We drive projects that expand access to education, reading, and opportunities for children and young people.',
      stat: '1 in 3 children in Latin America has no access to books outside the classroom.',
    },
    color: 'from-blue-900/30 to-blue-950/10 border-blue-500/20',
    accent: 'text-blue-400',
  },
  {
    slug: 'medio-ambiente',
    icon: '🌿',
    es: {
      name: 'Medio Ambiente',
      description: 'Contribuimos a proteger los ecosistemas, la biodiversidad y los recursos naturales de nuestra región.',
      stat: 'América Latina alberga el 40% de la biodiversidad del planeta, pero pierde más de 2,6 millones de hectáreas de bosque al año.',
    },
    en: {
      name: 'Environment',
      description: 'We help protect the ecosystems, biodiversity, and natural resources of our region.',
      stat: 'Latin America holds 40% of the planet\'s biodiversity, but loses more than 2.6 million hectares of forest each year.',
    },
    color: 'from-emerald-900/30 to-emerald-950/10 border-emerald-500/20',
    accent: 'text-emerald-400',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    es: 'Cada suscripción o compra en Noetia activa automáticamente tu aporte.',
    en: 'Every subscription or purchase on Noetia automatically activates your contribution.',
  },
  {
    step: '02',
    es: 'El 2,22% de ese pago se asigna a proyectos sociales reales — del total de la transacción, no de las ganancias.',
    en: '2.22% of that payment goes to real social projects — from the total transaction, not from profits.',
  },
  {
    step: '03',
    es: 'Tú decides: elige hasta dos líneas estratégicas que quieres apoyar, o distribuye tu aporte de forma aleatoria entre las tres.',
    en: 'You decide: choose up to two strategic lines to support, or distribute your contribution randomly across all three.',
  },
  {
    step: '04',
    es: 'Publicamos informes periódicos de impacto para que veas exactamente a dónde va cada peso de la comunidad.',
    en: 'We publish periodic impact reports so you can see exactly where every dollar from the community goes.',
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
            <>Construimos Noetia para compartir conocimiento. Pero creemos que compartir
              tiene que significar algo más que alcance. Por eso el{' '}
              <strong className="text-white">2,22%</strong> de cada compra en nuestra plataforma
              apoya proyectos sociales reales — desde el primer día, sin excepción,
              como parte de cómo operamos.</>
          ) : (
            <>We built Noetia to share knowledge. But we believe sharing must mean something
              more than reach. That is why{' '}
              <strong className="text-white">2.22%</strong> of every purchase on our platform
              supports real social projects — from day one, without exception,
              as part of how we operate.</>
          )}
        </p>
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
                <p className="text-slate-300 text-sm leading-relaxed mb-4">{copy.description}</p>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-slate-400 italic leading-relaxed">&ldquo;{copy.stat}&rdquo;</p>
                </div>
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
        </div>
      </section>

      {/* Alliance invitation */}
      <section className="border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/30 p-8 sm:p-12 text-center">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4">
              {l === 'es' ? 'Para organizaciones sociales' : 'For social organizations'}
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
                ? 'Buscamos aliados estratégicos en bienestar animal, niñez y juventud, y medio ambiente. Si tu organización trabaja con propósito, con transparencia y con impacto demostrable, queremos conocerte y potenciar juntos el alcance de tu trabajo.'
                : 'We seek strategic partners in animal welfare, children and youth, and environment. If your organization works with purpose, transparency, and demonstrable impact, we want to meet you and amplify the reach of your work together.'}
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

      {/* Footer strip */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span className="font-bold tracking-widest text-slate-400">NOETIA</span>
          <nav className="flex gap-6">
            <Link href="/library" className="hover:text-slate-300 transition">
              {l === 'es' ? 'Biblioteca' : 'Library'}
            </Link>
            <Link href="/pricing" className="hover:text-slate-300 transition">
              {l === 'es' ? 'Planes' : 'Plans'}
            </Link>
            <a href="mailto:info@noetia.app" className="hover:text-slate-300 transition">
              {l === 'es' ? 'Contacto' : 'Contact'}
            </a>
          </nav>
          <span>© {new Date().getFullYear()} Noetia</span>
        </div>
      </footer>

    </main>
  );
}
