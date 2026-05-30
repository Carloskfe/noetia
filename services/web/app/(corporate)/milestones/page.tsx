import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionLabel, SectionTitle } from '../_components';

export const metadata: Metadata = {
  title: 'From concept to category — Noetia milestones',
  description: 'What Noetia has built: platform milestones, product achievements, and the progress toward a new category.',
  openGraph: { title: 'Milestones — Noetia', description: 'Categories are built feature by feature, until the behavior becomes obvious. This is what we have built.' },
};

const MILESTONES = [
  {
    es: 'Plataforma en producción',
    en: 'Production platform',
    desc_es: 'Web y móvil en producción, accesibles en noetia.app.',
    desc_en: 'Web and mobile in production, accessible at noetia.app.',
    status: 'live',
  },
  {
    es: 'Motor de sincronización frase por frase',
    en: 'Phrase-by-phrase sync engine',
    desc_es: 'Sincronización texto-audio frase por frase implementada y operando en producción.',
    desc_en: 'Phrase-by-phrase text-audio synchronization engine implemented and running in production.',
    status: 'live',
  },
  {
    es: '56 migraciones de base de datos',
    en: '56 database migrations',
    desc_es: 'Schema completo: usuarios, libros, sync maps, fragmentos, suscripciones, clubes, stats, tokens y más.',
    desc_en: 'Complete schema: users, books, sync maps, fragments, subscriptions, clubs, stats, tokens, and more.',
    status: 'live',
  },
  {
    es: 'Catálogo activo en español e inglés',
    en: 'Active catalog in Spanish and English',
    desc_es: 'Biblioteca libre con clásicos de la literatura latinoamericana, títulos en inglés y la Biblia KJV.',
    desc_en: 'Free library with Latin American literary classics, English titles, and the KJV Bible.',
    status: 'live',
  },
  {
    es: 'Pipeline de sincronización Whisper',
    en: 'Whisper sync pipeline',
    desc_es: 'Alineación texto-audio con Whisper, umbral de calidad del 85% de cobertura por libro.',
    desc_en: 'Text-audio alignment with Whisper, 85% coverage quality threshold per book.',
    status: 'live',
  },
  {
    es: 'Modelo de suscripción con tokens',
    en: 'Token-based subscription model',
    desc_es: 'Tres planes (Individual / Duo / Familia) con sistema de tokens y Stripe integrado.',
    desc_en: 'Three plans (Individual / Duo / Family) with token system and Stripe integrated.',
    status: 'live',
  },
  {
    es: 'Clubes de lectura',
    en: 'Reading clubs',
    desc_es: 'Clubes públicos y privados, discusiones ancladas al texto, sondeos, sesiones Escucha Juntos.',
    desc_en: 'Public and private clubs, text-anchored discussions, polls, Escucha Juntos live sessions.',
    status: 'live',
  },
  {
    es: 'Causas Noetia',
    en: 'Causas Noetia',
    desc_es: '2,22% de cada pago donado automáticamente a causas aliadas desde el primer día.',
    desc_en: '2.22% of every payment donated automatically to partner causes from day one.',
    status: 'live',
  },
  {
    es: 'CI/CD operacional',
    en: 'Operational CI/CD',
    desc_es: 'Deploy automático en cada push a main vía GitHub Actions con migrations automáticas.',
    desc_en: 'Automatic deploy on every push to main via GitHub Actions with automatic migrations.',
    status: 'live',
  },
  {
    es: 'Monitoreo continuo',
    en: 'Continuous monitoring',
    desc_es: 'Grafana + Prometheus monitoreando latencia, errores y salud de contenedores en producción.',
    desc_en: 'Grafana + Prometheus monitoring latency, errors, and container health in production.',
    status: 'live',
  },
  {
    es: 'Tarjetas de fragmentos para redes sociales',
    en: 'Fragment cards for social networks',
    desc_es: 'Generación de imágenes para compartir en LinkedIn, Instagram, Facebook y Pinterest.',
    desc_en: 'Image generation for sharing on LinkedIn, Instagram, Facebook, and Pinterest.',
    status: 'live',
  },
  {
    es: 'App iOS y Android',
    en: 'iOS and Android app',
    desc_es: 'React Native con soporte offline, modo de escucha activa y selección de texto.',
    desc_en: 'React Native with offline support, active listening mode, and text selection.',
    status: 'live',
  },
  {
    es: 'Categoría definida: Knowledge Expression Platform',
    en: 'Category defined: Knowledge Expression Platform',
    desc_es: 'Noetia ha nombrado y construido la infraestructura de una categoría nueva. El trabajo que queda es completarla.',
    desc_en: 'Noetia has named and built the infrastructure of a new category. The work remaining is to complete it.',
    status: 'live',
  },
];

const AHEAD = [
  { es: 'Expansión del catálogo de autores en español e inglés', en: 'Author catalog expansion in Spanish and English' },
  { es: 'Herramientas avanzadas para editoriales con catálogos grandes', en: 'Advanced tools for publishers with large catalogs' },
  { es: 'Extensión de Clubes a eventos y presentaciones de autores en vivo', en: 'Extension of Clubs to live author events and presentations' },
  { es: 'API pública para instituciones educativas y bibliotecas digitales', en: 'Public API for educational institutions and digital libraries' },
  { es: 'Expansión a otros idiomas: portugués, catalán', en: 'Expansion to other languages: Portuguese, Catalan' },
];

export default function MilestonesPage() {
  return (
    <main>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>Del concepto a la categoría · From concept to category</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-3">
          Lo que hemos construido.
        </h1>
        <p className="text-2xl text-gray-400 font-light mb-6">
          What we have built.
        </p>
        <p className="text-gray-700 text-[15px] max-w-2xl">
          Las categorías no aparecen con un anuncio. Se construyen funcionalidad por funcionalidad, hasta que el comportamiento se vuelve evidente. Esto es lo que hemos construido.
        </p>
        <p className="text-gray-400 text-sm max-w-2xl mt-2 italic">
          Categories do not appear with an announcement. They are built feature by feature, until the behavior becomes obvious. This is what we have built.
        </p>
      </section>

      {/* Milestones */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Hitos de plataforma" en="Platform milestones" />
        <div className="space-y-0">
          {MILESTONES.map(({ es, en, desc_es, desc_en }) => (
            <div key={es} className="grid grid-cols-12 gap-4 py-5 border-b border-gray-100 last:border-0 items-start">
              <div className="col-span-1 pt-0.5">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="col-span-11 grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div>
                  <p className="font-bold text-[#0D1B2A] text-sm">{es}</p>
                  <p className="text-gray-600 text-sm mt-1">{desc_es}</p>
                </div>
                <div className="lg:pl-4 lg:border-l lg:border-gray-100">
                  <p className="font-medium text-gray-400 text-sm italic">{en}</p>
                  <p className="text-gray-400 text-xs mt-1 italic">{desc_en}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What's ahead */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Lo que viene" en="What is ahead" />
          <div className="space-y-3">
            {AHEAD.map(({ es, en }) => (
              <div key={es} className="flex flex-col sm:flex-row gap-2 py-3 border-b border-gray-200 last:border-0">
                <p className="text-[#0D1B2A] text-sm font-medium sm:w-1/2">→ {es}</p>
                <p className="text-gray-400 text-sm italic sm:w-1/2">{en}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link href="/register" className="group bg-[#0D1B2A] text-white rounded-xl p-6 hover:bg-gray-800 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Producto</p>
            <p className="font-bold">Usar la plataforma →</p>
          </Link>
          <Link href="/upload-guide" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Autores</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Publicar un libro →</p>
          </Link>
          <Link href="/contact" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Contacto</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Hablar con el equipo →</p>
          </Link>
        </div>
      </section>

    </main>
  );
}
