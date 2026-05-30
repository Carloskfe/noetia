import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionLabel, SectionTitle } from '../_components';

export const metadata: Metadata = {
  title: 'Team — Noetia',
  description: 'Noetia is built by a small, cross-functional team with a specific conviction: that knowledge should be social, and that the platform to make it so has not existed — until now.',
  openGraph: { title: 'Team — Noetia', description: 'Small team. Specific conviction. Building a new category.' },
};

const ROLES = [
  {
    area_es: 'Producto',
    area_en: 'Product',
    desc_es: 'Estrategia, priorización, especificaciones y coherencia de la visión. El punto de conexión entre lo que los usuarios necesitan y lo que el equipo construye.',
    desc_en: 'Strategy, prioritization, specifications, and vision coherence. The connection point between what users need and what the team builds.',
    icon: '🎯',
  },
  {
    area_es: 'Ingeniería backend',
    area_en: 'Backend engineering',
    desc_es: 'API, sincronización texto-audio, suscripciones, autenticación e integraciones con servicios externos (Stripe, MinIO, Meilisearch, Resend).',
    desc_en: 'API, text-audio synchronization, subscriptions, authentication, and integrations with external services (Stripe, MinIO, Meilisearch, Resend).',
    icon: '⚙️',
  },
  {
    area_es: 'Ingeniería frontend',
    area_en: 'Frontend engineering',
    desc_es: 'Web (Next.js), móvil (React Native) y todas las superficies que los usuarios tocan directamente. Velocidad, accesibilidad y coherencia entre plataformas.',
    desc_en: 'Web (Next.js), mobile (React Native), and all surfaces users interact with directly. Speed, accessibility, and cross-platform consistency.',
    icon: '🖥️',
  },
  {
    area_es: 'Infraestructura',
    area_en: 'Infrastructure',
    desc_es: 'DevOps, CI/CD, monitoreo, gestión de secretos y seguridad operacional de la plataforma en producción.',
    desc_en: 'DevOps, CI/CD, monitoring, secrets management, and operational security of the production platform.',
    icon: '🔧',
  },
  {
    area_es: 'Editorial',
    area_en: 'Editorial',
    desc_es: 'Relaciones con autores, ingesta de contenido, control de calidad de sincronización y gestión del catálogo.',
    desc_en: 'Author relationships, content ingestion, synchronization quality control, and catalog management.',
    icon: '📚',
  },
];

export default function TeamPage() {
  return (
    <main>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>Equipo · Team</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-3">
          Un equipo pequeño<br />con una convicción específica.
        </h1>
        <p className="text-2xl text-gray-400 font-light mb-8">
          A small team with a specific conviction.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-16">
          <p className="text-gray-700 text-[15px] leading-relaxed">
            Construimos para el tipo de persona que lee <em>Las Meditaciones</em> un martes por la noche porque genuinamente necesita pensar mejor. Ese respeto guía cada decisión de diseño.
          </p>
          <p className="text-gray-400 text-[14px] leading-relaxed italic">
            We build for the kind of person who reads <em>Meditations</em> on a Tuesday night because they genuinely need to think better. That respect guides every design decision.
          </p>
        </div>
      </section>

      {/* Conviction */}
      <section className="bg-[#0D1B2A] text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <SectionLabel>Lo que nos une</SectionLabel>
              <p className="text-slate-200 text-[15px] leading-relaxed mb-4">
                Lo que une al equipo no es un conjunto de habilidades. Es una convicción sobre lo que el conocimiento puede hacer cuando se expresa públicamente.
              </p>
              <p className="text-slate-200 text-[15px] leading-relaxed">
                Creemos que el conocimiento debería ser social. Que los libros deberían importar más de lo que importan hoy. Que la persona que leyó a Dostoievski, Marco Aurelio y Paulo Coelho en el último año debería tener alguna forma de que eso sea visible.
              </p>
            </div>
            <div className="lg:border-l lg:border-white/10 lg:pl-10">
              <SectionLabel>What unites us</SectionLabel>
              <p className="text-slate-400 text-[14px] leading-relaxed mb-4 italic">
                What unites the team is not a set of skills. It is a conviction about what knowledge can do when it is expressed publicly.
              </p>
              <p className="text-slate-400 text-[14px] leading-relaxed italic">
                We believe knowledge should be social. That books should matter more than they do today. That the person who read Dostoevsky, Marcus Aurelius, and Paulo Coelho this year should have some way for that to be visible.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How we work */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Cómo trabajamos" en="How we work" />
        <p className="text-gray-500 text-sm mb-8 max-w-2xl">
          En un equipo pequeño, todos entienden el producto de punta a punta. Las decisiones se toman rápido, el contexto se comparte en tiempo real, y el trabajo de todos llega a usuarios reales en días, no meses.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {ROLES.map(({ area_es, area_en, desc_es, desc_en, icon }) => (
            <div key={area_es} className="border border-gray-100 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="font-bold text-[#0D1B2A] text-sm">{area_es}</p>
                  <p className="text-gray-400 text-xs italic">{area_en}</p>
                </div>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{desc_es}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Leadership placeholder */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Liderazgo" en="Leadership" />
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-gray-400 text-sm">
              Los perfiles del equipo se publicarán próximamente.
            </p>
            <p className="text-gray-400 text-xs mt-1 italic">Leadership profiles coming soon.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/careers" className="group bg-[#0D1B2A] text-white rounded-xl p-8 hover:bg-gray-800 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Únete</p>
            <p className="text-xl font-bold">¿Quieres trabajar aquí? →</p>
            <p className="text-slate-400 text-sm mt-2 italic">Want to work here?</p>
          </Link>
          <Link href="/how-we-build" className="group border border-gray-200 rounded-xl p-8 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-3">Ingeniería</p>
            <p className="text-xl font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Cómo construimos →</p>
            <p className="text-gray-400 text-sm mt-2 italic">How we build</p>
          </Link>
        </div>
      </section>

    </main>
  );
}
