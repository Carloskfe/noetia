'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { LangText, SectionLabel } from '../_components';

const CHANNELS = [
  { icon: '✉️', email: 'info@noetia.app', es: { label: 'General', use: 'Preguntas generales, feedback de usuarios, cualquier otra consulta.' }, en: { label: 'General', use: 'General questions, user feedback, anything else.' } },
  { icon: '✍️', email: 'autores@noetia.app', es: { label: 'Autores', use: 'Publicar un libro, preguntas sobre el proceso de sincronización, acceso al portal.' }, en: { label: 'Authors', use: 'Publishing a book, questions about the sync process, portal access.' } },
  { icon: '📘', email: 'editorial@noetia.app', es: { label: 'Editoriales', use: 'Catálogos grandes, acuerdos de distribución, integraciones editoriales.' }, en: { label: 'Publishers', use: 'Large catalogs, distribution agreements, editorial integrations.' } },
  { icon: '🤝', email: 'socios@noetia.app', es: { label: 'Socios estratégicos', use: 'Alianzas estratégicas, integraciones tecnológicas, oportunidades de colaboración.' }, en: { label: 'Strategic partners', use: 'Strategic alliances, technology integrations, collaboration opportunities.' } },
  { icon: '📰', email: 'prensa@noetia.app', es: { label: 'Prensa y medios', use: 'Consultas de medios, información de empresa, solicitudes de entrevista.' }, en: { label: 'Press and media', use: 'Media inquiries, company information, interview requests.' } },
  { icon: '👤', email: 'equipo@noetia.app', es: { label: 'Carreras', use: 'Expresar interés en trabajar con nosotros, comunidad de talento.' }, en: { label: 'Careers', use: 'Expressing interest in working with us, talent community.' } },
  { icon: '🌿', email: 'causas@noetia.app', es: { label: 'Causas Noetia', use: 'Propuestas de alianza estratégica para organizaciones sociales.' }, en: { label: 'Causas Noetia', use: 'Strategic partnership proposals from social organizations.' } },
  { icon: '⚖️', email: 'legal@noetia.app', es: { label: 'Legal', use: 'Privacidad, derechos de autor, términos, GDPR.' }, en: { label: 'Legal', use: 'Privacy, copyright, terms, GDPR.' } },
];

export default function ContactContent() {
  const { language } = useTranslation();
  const l = language;

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{l === 'es' ? 'Contacto' : 'Contact'}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-6">
          <LangText
            es="Somos un equipo pequeño con una visión específica."
            en="We are a small team with a specific vision."
          />
        </h1>
        <p className="text-gray-700 text-[15px] max-w-xl">
          <LangText
            es="Si compartes esa visión — como lector, como autor, como socio o como alguien que quiere construir esto con nosotros — queremos saber de ti. Leemos todos los mensajes. Respondemos en 1–3 días hábiles."
            en="If you share that vision — as a reader, an author, a partner, or someone who wants to build this with us — we want to hear from you. We read every message. We respond within 1–3 business days."
          />
        </p>
      </section>

      {/* Channels */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {CHANNELS.map(({ icon, email, es, en }) => {
            const c = l === 'es' ? es : en;
            return (
              <a key={email} href={`mailto:${email}`} className="group border border-gray-100 rounded-xl p-6 hover:border-indigo-300 hover:shadow-sm transition block">
                <div className="flex items-start gap-4">
                  <span className="text-2xl shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0D1B2A] text-sm mb-1">{c.label}</p>
                    <p className="text-indigo-600 text-sm font-medium group-hover:underline truncate mb-2">{email}</p>
                    <p className="text-gray-600 text-xs leading-relaxed">{c.use}</p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Trust */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">
            <LangText
              es="No vendemos ni compartimos tu información de contacto con terceros. Los mensajes se leen por personas del equipo — no por sistemas automáticos de primer nivel."
              en="We do not sell or share your contact information with third parties. Messages are read by team members — not first-level automated systems."
            />
          </p>
        </div>
      </section>

      {/* Bottom nav */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { href: '/about', label_es: 'Sobre Noetia', cta_es: 'Nuestra misión →', label_en: 'About', cta_en: 'Our mission →' },
            { href: '/careers', label_es: 'Trabajo', cta_es: 'Trabaja con nosotros →', label_en: 'Careers', cta_en: 'Work with us →' },
            { href: '/upload-guide', label_es: 'Autores', cta_es: 'Guía de publicación →', label_en: 'Authors', cta_en: 'Publishing guide →' },
          ].map(({ href, label_es, cta_es, label_en, cta_en }) => (
            <Link key={href} href={href} className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">{l === 'es' ? label_es : label_en}</p>
              <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">{l === 'es' ? cta_es : cta_en}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
