'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type Cause = {
  id: string;
  slug: string;
  name: string;
  description: string;
  statFact: string;
  icon: string;
};

const STRATEGIC_LINES = [
  {
    slug: 'bienestar-animal',
    icon: '🐾',
    name: 'Bienestar Animal',
    description: 'Apoyamos iniciativas de rescate, cuidado, rehabilitación y protección de animales en América Latina.',
    stat: 'Más de 70 millones de perros y gatos viven en condición de abandono en América Latina.',
    color: 'from-amber-900/30 to-amber-950/10 border-amber-500/20',
    accent: 'text-amber-400',
  },
  {
    slug: 'ninez-y-juventud',
    icon: '📚',
    name: 'Niñez y Juventud',
    description: 'Impulsamos proyectos que amplían el acceso a la educación, la lectura y las oportunidades para niños y jóvenes.',
    stat: '1 de cada 3 niños en América Latina no tiene acceso a libros fuera del aula escolar.',
    color: 'from-blue-900/30 to-blue-950/10 border-blue-500/20',
    accent: 'text-blue-400',
  },
  {
    slug: 'medio-ambiente',
    icon: '🌿',
    name: 'Medio Ambiente',
    description: 'Contribuimos a proteger los ecosistemas, la biodiversidad y los recursos naturales de nuestra región.',
    stat: 'América Latina alberga el 40% de la biodiversidad del planeta, pero pierde más de 2,6 millones de hectáreas de bosque al año.',
    color: 'from-emerald-900/30 to-emerald-950/10 border-emerald-500/20',
    accent: 'text-emerald-400',
  },
];

export default function CausasPage() {
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
          ← Biblioteca
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-16 text-center">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4">
          Causas Noetia
        </p>
        <p className="text-slate-400 text-base italic mb-5">
          "Creemos que compartir es una forma de ayudar."
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
          Compartir aquí mueve<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
            más que páginas.
          </span>
        </h1>
        <p className="text-slate-300 text-lg leading-relaxed max-w-xl mx-auto">
          Construimos Noetia para compartir conocimiento. Pero creemos que compartir
          tiene que significar algo más que alcance. Por eso el{' '}
          <strong className="text-white">2,22%</strong> de cada compra en nuestra plataforma
          apoya proyectos sociales reales — desde el primer día, sin excepción,
          como parte de cómo operamos.
        </p>
      </section>

      {/* Strategic lines */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid sm:grid-cols-3 gap-5">
          {STRATEGIC_LINES.map((line) => (
            <div
              key={line.slug}
              className={`rounded-2xl border bg-gradient-to-b ${line.color} p-6`}
            >
              <span className="text-4xl block mb-4">{line.icon}</span>
              <h2 className={`text-base font-bold mb-2 ${line.accent}`}>{line.name}</h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">{line.description}</p>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-slate-400 italic leading-relaxed">"{line.stat}"</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/10 bg-white/5">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <h2 className="text-xl font-bold text-white mb-8 text-center">¿Cómo funciona?</h2>
          <div className="space-y-5">
            {[
              { step: '01', text: 'Cada suscripción o compra en Noetia activa automáticamente tu aporte.' },
              { step: '02', text: 'El 2,22% de ese pago se asigna a proyectos sociales reales — del total de la transacción, no de las ganancias.' },
              { step: '03', text: 'Tú decides: elige hasta dos líneas estratégicas que quieres apoyar, o distribuye tu aporte de forma aleatoria entre las tres.' },
              { step: '04', text: 'Publicamos informes periódicos de impacto para que veas exactamente a dónde va cada peso de la comunidad.' },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-4 items-start">
                <span className="text-xs font-bold text-emerald-400 tracking-widest w-8 shrink-0 mt-0.5">{step}</span>
                <p className="text-slate-300 text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alliance invitation — main CTA for social organizations */}
      <section className="border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/30 p-8 sm:p-12 text-center">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4">
              Para organizaciones sociales
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-snug">
              ¿Tu proyecto genera cambio real<br className="hidden sm:block" /> en América Latina?
            </h2>
            <p className="text-slate-300 text-base leading-relaxed max-w-xl mx-auto mb-8">
              Buscamos aliados estratégicos en bienestar animal, niñez y juventud, y medio ambiente.
              Si tu organización trabaja con propósito, con transparencia y con impacto demostrable,
              queremos conocerte y potenciar juntos el alcance de tu trabajo.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              {[
                { icon: '✅', text: 'Trabajo en una de las tres líneas estratégicas' },
                { icon: '✅', text: 'Operación en América Latina' },
                { icon: '✅', text: 'Impacto documentado y transparente' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-sm text-slate-300">
                  <span>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <a
              href="mailto:causas@noetia.app?subject=Propuesta%20de%20alianza%20estrat%C3%A9gica%20%E2%80%94%20Causas%20Noetia"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl transition text-base"
            >
              Escribenos a causas@noetia.app
            </a>
            <p className="text-xs text-slate-500 mt-5 max-w-md mx-auto">
              Evaluamos cada propuesta con base en transparencia, impacto documentado y alineación
              con nuestra comunidad de lectores. Los programas aliados se comunican públicamente
              a través de nuestros informes de impacto.
            </p>
          </div>
        </div>
      </section>

      {/* Footer strip */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span className="font-bold tracking-widest text-slate-400">NOETIA</span>
          <nav className="flex gap-6">
            <Link href="/library" className="hover:text-slate-300 transition">Biblioteca</Link>
            <Link href="/pricing" className="hover:text-slate-300 transition">Planes</Link>
            <a href="mailto:info@noetia.app" className="hover:text-slate-300 transition">Contacto</a>
          </nav>
          <span>© {new Date().getFullYear()} Noetia</span>
        </div>
      </footer>

    </main>
  );
}
