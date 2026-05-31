'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { LangText, SectionLabel, SectionTitle } from '../_components';

const MILESTONES = [
  { es: { title: 'Plataforma en producción', desc: 'Web y móvil en producción, accesibles en noetia.app.' }, en: { title: 'Production platform', desc: 'Web and mobile in production, accessible at noetia.app.' } },
  { es: { title: 'Motor de sincronización frase por frase', desc: 'Sincronización texto-audio frase por frase implementada y operando en producción.' }, en: { title: 'Phrase-by-phrase sync engine', desc: 'Phrase-by-phrase text-audio synchronization engine implemented and running in production.' } },
  { es: { title: '56 migraciones de base de datos', desc: 'Schema completo: usuarios, libros, sync maps, fragmentos, suscripciones, clubes, stats, tokens y más.' }, en: { title: '56 database migrations', desc: 'Complete schema: users, books, sync maps, fragments, subscriptions, clubs, stats, tokens, and more.' } },
  { es: { title: 'Catálogo activo en español e inglés', desc: 'Biblioteca libre con clásicos de la literatura latinoamericana, títulos en inglés y la Biblia KJV.' }, en: { title: 'Active catalog in Spanish and English', desc: 'Free library with Latin American literary classics, English titles, and the KJV Bible.' } },
  { es: { title: 'Pipeline de sincronización Whisper', desc: 'Alineación texto-audio con Whisper, umbral de calidad del 85% de cobertura por libro.' }, en: { title: 'Whisper sync pipeline', desc: 'Text-audio alignment with Whisper, 85% coverage quality threshold per book.' } },
  { es: { title: 'Modelo de suscripción con tokens', desc: 'Tres planes (Individual / Duo / Familia) con sistema de tokens y Stripe integrado.' }, en: { title: 'Token-based subscription model', desc: 'Three plans (Individual / Duo / Family) with token system and Stripe integrated.' } },
  { es: { title: 'Clubes de lectura', desc: 'Clubes públicos y privados, discusiones ancladas al texto, sondeos, sesiones Escucha Juntos.' }, en: { title: 'Reading clubs', desc: 'Public and private clubs, text-anchored discussions, polls, Escucha Juntos live sessions.' } },
  { es: { title: 'Causas Noetia', desc: '2,22% de cada pago donado automáticamente a causas aliadas desde el primer día.' }, en: { title: 'Causas Noetia', desc: '2.22% of every payment donated automatically to partner causes from day one.' } },
  { es: { title: 'CI/CD operacional', desc: 'Deploy automático en cada push a main vía GitHub Actions con migrations automáticas.' }, en: { title: 'Operational CI/CD', desc: 'Automatic deploy on every push to main via GitHub Actions with automatic migrations.' } },
  { es: { title: 'Monitoreo continuo', desc: 'Grafana + Prometheus monitoreando latencia, errores y salud de contenedores en producción.' }, en: { title: 'Continuous monitoring', desc: 'Grafana + Prometheus monitoring latency, errors, and container health in production.' } },
  { es: { title: 'Tarjetas de fragmentos para redes sociales', desc: 'Generación de imágenes para compartir en LinkedIn, Instagram, Facebook y Pinterest.' }, en: { title: 'Fragment cards for social networks', desc: 'Image generation for sharing on LinkedIn, Instagram, Facebook, and Pinterest.' } },
  { es: { title: 'App iOS y Android', desc: 'React Native con soporte offline, modo de escucha activa y selección de texto.' }, en: { title: 'iOS and Android app', desc: 'React Native with offline support, active listening mode, and text selection.' } },
  { es: { title: 'Categoría definida: Knowledge Expression Platform', desc: 'Noetia ha nombrado y construido la infraestructura de una categoría nueva. El trabajo que queda es completarla.' }, en: { title: 'Category defined: Knowledge Expression Platform', desc: 'Noetia has named and built the infrastructure of a new category. The work remaining is to complete it.' } },
];

const AHEAD = [
  { es: 'Expansión del catálogo de autores en español e inglés', en: 'Author catalog expansion in Spanish and English' },
  { es: 'Herramientas avanzadas para editoriales con catálogos grandes', en: 'Advanced tools for publishers with large catalogs' },
  { es: 'Extensión de Clubes a eventos y presentaciones de autores en vivo', en: 'Extension of Clubs to live author events and presentations' },
  { es: 'API pública para instituciones educativas y bibliotecas digitales', en: 'Public API for educational institutions and digital libraries' },
  { es: 'Expansión a otros idiomas: portugués, catalán', en: 'Expansion to other languages: Portuguese, Catalan' },
];

export default function MilestonesContent() {
  const { language } = useTranslation();
  const l = language;

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{l === 'es' ? 'Del concepto a la categoría' : 'From concept to category'}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-6">
          <LangText es="Lo que hemos construido." en="What we have built." />
        </h1>
        <p className="text-gray-700 text-[15px] max-w-2xl">
          <LangText
            es="Las categorías no aparecen con un anuncio. Se construyen funcionalidad por funcionalidad, hasta que el comportamiento se vuelve evidente."
            en="Categories do not appear with an announcement. They are built feature by feature, until the behavior becomes obvious."
          />
        </p>
      </section>

      {/* Milestones */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Hitos de plataforma" en="Platform milestones" />
        <div className="space-y-0">
          {MILESTONES.map(({ es, en }) => {
            const m = l === 'es' ? es : en;
            return (
              <div key={m.title} className="grid grid-cols-12 gap-4 py-5 border-b border-gray-100 last:border-0 items-start">
                <div className="col-span-1 pt-0.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="col-span-11">
                  <p className="font-bold text-[#0D1B2A] text-sm">{m.title}</p>
                  <p className="text-gray-600 text-sm mt-1">{m.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ahead */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Lo que viene" en="What is ahead" />
          <div className="space-y-0">
            {AHEAD.map(({ es, en }) => (
              <div key={es} className="py-3 border-b border-gray-200 last:border-0">
                <p className="text-[#0D1B2A] text-sm font-medium">→ {l === 'es' ? es : en}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link href="/register" className="bg-[#0D1B2A] text-white rounded-xl p-6 hover:bg-gray-800 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">{l === 'es' ? 'Producto' : 'Product'}</p>
            <p className="font-bold"><LangText es="Usar la plataforma →" en="Use the platform →" /></p>
          </Link>
          <Link href="/upload-guide" className="border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition group">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">{l === 'es' ? 'Autores' : 'Authors'}</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition"><LangText es="Publicar un libro →" en="Publish a book →" /></p>
          </Link>
          <Link href="/contact" className="border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition group">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">{l === 'es' ? 'Contacto' : 'Contact'}</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition"><LangText es="Hablar con el equipo →" en="Talk to the team →" /></p>
          </Link>
        </div>
      </section>
    </main>
  );
}
