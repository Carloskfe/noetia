import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionLabel } from '../_components';

export const metadata: Metadata = {
  title: 'Contact Noetia',
  description: 'Get in touch with Noetia — general inquiries, authors and publishers, partners, media, and careers.',
  openGraph: { title: 'Contact — Noetia', description: 'We are a small team. We read every message. We respond within 1–3 business days.' },
};

const CHANNELS = [
  {
    label_es: 'General',
    label_en: 'General',
    email: 'info@noetia.app',
    use_es: 'Preguntas generales, feedback de usuarios, cualquier otra consulta.',
    use_en: 'General questions, user feedback, anything else.',
    icon: '✉️',
  },
  {
    label_es: 'Autores',
    label_en: 'Authors',
    email: 'autores@noetia.app',
    use_es: 'Publicar un libro, preguntas sobre el proceso de sincronización, acceso al portal.',
    use_en: 'Publishing a book, questions about the sync process, portal access.',
    icon: '✍️',
  },
  {
    label_es: 'Editoriales',
    label_en: 'Publishers',
    email: 'editorial@noetia.app',
    use_es: 'Catálogos grandes, acuerdos de distribución, integraciones editoriales.',
    use_en: 'Large catalogs, distribution agreements, editorial integrations.',
    icon: '📘',
  },
  {
    label_es: 'Socios estratégicos',
    label_en: 'Strategic partners',
    email: 'socios@noetia.app',
    use_es: 'Alianzas estratégicas, integraciones tecnológicas, oportunidades de colaboración.',
    use_en: 'Strategic alliances, technology integrations, collaboration opportunities.',
    icon: '🤝',
  },
  {
    label_es: 'Prensa y medios',
    label_en: 'Press and media',
    email: 'prensa@noetia.app',
    use_es: 'Consultas de medios, información de empresa, solicitudes de entrevista.',
    use_en: 'Media inquiries, company information, interview requests.',
    icon: '📰',
  },
  {
    label_es: 'Carreras',
    label_en: 'Careers',
    email: 'equipo@noetia.app',
    use_es: 'Expresar interés en trabajar con nosotros, comunidad de talento.',
    use_en: 'Expressing interest in working with us, talent community.',
    icon: '👤',
  },
  {
    label_es: 'Causas Noetia',
    label_en: 'Causas Noetia',
    email: 'causas@noetia.app',
    use_es: 'Propuestas de alianza estratégica para organizaciones sociales.',
    use_en: 'Strategic partnership proposals from social organizations.',
    icon: '🌿',
  },
  {
    label_es: 'Legal',
    label_en: 'Legal',
    email: 'legal@noetia.app',
    use_es: 'Privacidad, derechos de autor, términos, GDPR.',
    use_en: 'Privacy, copyright, terms, GDPR.',
    icon: '⚖️',
  },
];

export default function ContactPage() {
  return (
    <main>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>Contacto · Contact</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-3">
          Somos un equipo pequeño<br />con una visión específica.
        </h1>
        <p className="text-2xl text-gray-400 font-light mb-6">
          We are a small team with a specific vision.
        </p>
        <p className="text-gray-700 text-[15px] max-w-xl">
          Si compartes esa visión — como lector, como autor, como socio o como alguien que quiere construir esto con nosotros — queremos saber de ti. Leemos todos los mensajes. Respondemos en 1–3 días hábiles.
        </p>
        <p className="text-gray-400 text-sm max-w-xl mt-2 italic">
          If you share that vision — as a reader, an author, a partner, or someone who wants to build this with us — we want to hear from you. We read every message. We respond within 1–3 business days.
        </p>
      </section>

      {/* Contact channels */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {CHANNELS.map(({ label_es, label_en, email, use_es, use_en, icon }) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className="group border border-gray-100 rounded-xl p-6 hover:border-indigo-300 hover:shadow-sm transition block"
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-bold text-[#0D1B2A] text-sm">{label_es}</p>
                    <p className="text-gray-400 text-xs italic">{label_en}</p>
                  </div>
                  <p className="text-indigo-600 text-sm font-medium group-hover:underline truncate mb-2">{email}</p>
                  <p className="text-gray-600 text-xs leading-relaxed">{use_es}</p>
                  <p className="text-gray-400 text-xs leading-relaxed mt-0.5 italic">{use_en}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Trust copy */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <p className="text-gray-500 text-sm leading-relaxed">
              No vendemos ni compartimos tu información de contacto con terceros. Los mensajes se leen por personas del equipo — no por sistemas automáticos de primer nivel.
            </p>
            <p className="text-gray-400 text-xs leading-relaxed italic">
              We do not sell or share your contact information with third parties. Messages are read by team members — not first-level automated systems.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom nav */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link href="/about" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Sobre Noetia</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Nuestra misión →</p>
          </Link>
          <Link href="/careers" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Trabajo</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Trabaja con nosotros →</p>
          </Link>
          <Link href="/upload-guide" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Autores</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Guía de publicación →</p>
          </Link>
        </div>
      </section>

    </main>
  );
}
