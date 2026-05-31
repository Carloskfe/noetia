'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { LangText, SectionLabel, SectionTitle } from '../_components';

const ROLES = [
  { icon: '🎯', es: { name: 'Producto', desc: 'Estrategia, priorización, especificaciones y coherencia de la visión. Conecta lo que los usuarios necesitan con lo que el equipo construye.' }, en: { name: 'Product', desc: 'Strategy, prioritization, specifications, and vision coherence. Connects what users need with what the team builds.' } },
  { icon: '⚙️', es: { name: 'Ingeniería backend', desc: 'API, sincronización texto-audio, suscripciones, autenticación e integraciones con servicios externos.' }, en: { name: 'Backend engineering', desc: 'API, text-audio synchronization, subscriptions, authentication, and integrations with external services.' } },
  { icon: '🖥️', es: { name: 'Ingeniería frontend', desc: 'Web (Next.js), móvil (React Native). Velocidad, accesibilidad y coherencia entre plataformas.' }, en: { name: 'Frontend engineering', desc: 'Web (Next.js), mobile (React Native). Speed, accessibility, and cross-platform consistency.' } },
  { icon: '🔧', es: { name: 'Infraestructura', desc: 'DevOps, CI/CD, monitoreo, gestión de secretos y seguridad operacional de la plataforma en producción.' }, en: { name: 'Infrastructure', desc: 'DevOps, CI/CD, monitoring, secrets management, and operational security of the production platform.' } },
  { icon: '📚', es: { name: 'Editorial', desc: 'Relaciones con autores, ingesta de contenido, control de calidad de sincronización y gestión del catálogo.' }, en: { name: 'Editorial', desc: 'Author relationships, content ingestion, synchronization quality control, and catalog management.' } },
];

export default function TeamContent() {
  const { language } = useTranslation();
  const l = language;

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{l === 'es' ? 'Equipo' : 'Team'}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-6">
          <LangText
            es="Un equipo pequeño con una convicción específica."
            en="A small team with a specific conviction."
          />
        </h1>
        <p className="text-gray-700 text-[15px] max-w-2xl">
          <LangText
            es="Construimos para el tipo de persona que lee Las Meditaciones un martes por la noche porque genuinamente necesita pensar mejor. Ese respeto guía cada decisión de diseño."
            en="We build for the kind of person who reads Meditations on a Tuesday night because they genuinely need to think better. That respect guides every design decision."
          />
        </p>
      </section>

      {/* Conviction */}
      <section className="bg-[#0D1B2A] text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <SectionLabel>{l === 'es' ? 'Lo que nos une' : 'What unites us'}</SectionLabel>
          <div className="text-slate-200 text-[15px] leading-relaxed space-y-4 max-w-2xl">
            {l === 'es' ? (
              <>
                <p>Lo que une al equipo no es un conjunto de habilidades. Es una convicción sobre lo que el conocimiento puede hacer cuando se expresa públicamente.</p>
                <p>Creemos que el conocimiento debería ser social. Que los libros deberían importar más de lo que importan hoy. Que la persona que leyó a Dostoievski, Marco Aurelio y Paulo Coelho en el último año debería tener alguna forma de que eso sea visible.</p>
              </>
            ) : (
              <>
                <p>What unites the team is not a set of skills. It is a conviction about what knowledge can do when it is expressed publicly.</p>
                <p>We believe knowledge should be social. That books should matter more than they do today. That the person who read Dostoevsky, Marcus Aurelius, and Paulo Coelho this year should have some way for that to be visible.</p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Cómo trabajamos" en="How we work" />
        <p className="text-gray-500 text-sm mb-8 max-w-2xl">
          <LangText
            es="En un equipo pequeño, todos entienden el producto de punta a punta. Lo que construyes llega a usuarios reales en días, no meses."
            en="In a small team, everyone understands the product end to end. What you build reaches real users in days, not months."
          />
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {ROLES.map(({ icon, es, en }) => {
            const r = l === 'es' ? es : en;
            return (
              <div key={r.name} className="border border-gray-100 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{icon}</span>
                  <h3 className="font-bold text-[#0D1B2A] text-sm">{r.name}</h3>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{r.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Leadership placeholder */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Liderazgo" en="Leadership" />
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-gray-400 text-sm">
              <LangText
                es="Los perfiles del equipo se publicarán próximamente."
                en="Leadership profiles coming soon."
              />
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/careers" className="bg-[#0D1B2A] text-white rounded-xl p-8 hover:bg-gray-800 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">{l === 'es' ? 'Únete' : 'Join us'}</p>
            <p className="text-xl font-bold"><LangText es="¿Quieres trabajar aquí? →" en="Want to work here? →" /></p>
          </Link>
          <Link href="/how-we-build" className="border border-gray-200 rounded-xl p-8 hover:border-indigo-300 transition group">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-3">{l === 'es' ? 'Ingeniería' : 'Engineering'}</p>
            <p className="text-xl font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition"><LangText es="Cómo construimos →" en="How we build →" /></p>
          </Link>
        </div>
      </section>
    </main>
  );
}
