import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionLabel, SectionTitle } from '../_components';

export const metadata: Metadata = {
  title: 'Careers at Noetia — Build the Knowledge Expression Platform',
  description: 'Noetia is creating a new category. We are not actively hiring right now, but we always want to hear from the right people. Join the talent community.',
  openGraph: { title: 'Careers — Noetia', description: 'If you believe knowledge should be social, we want to hear from you.' },
};

const WORK_LIFE = [
  {
    es: { title: 'El problema importa', body: 'No estás optimizando el embudo de un producto existente. Estás construyendo la infraestructura de una categoría nueva.' },
    en: { title: 'The problem matters', body: 'You are not optimizing the funnel of an existing product. You are building the infrastructure of a new category.' },
  },
  {
    es: { title: 'Contexto completo', body: 'En un equipo pequeño, todos entienden el producto de punta a punta — no solo su parte.' },
    en: { title: 'Full context', body: 'In a small team, everyone understands the product end to end — not just their part.' },
  },
  {
    es: { title: 'Trabajo que se ve', body: 'Lo que construyes llega a usuarios reales en días, no meses.' },
    en: { title: 'Work you can see', body: 'What you build reaches real users in days, not months.' },
  },
  {
    es: { title: 'Autonomía real', body: 'Si propones algo razonado, se considera. No hay capas de aprobación.' },
    en: { title: 'Real autonomy', body: 'If you propose something reasoned, it is considered. There are no approval layers.' },
  },
  {
    es: { title: 'Herramientas modernas', body: 'Usamos lo que funciona — incluyendo flujos de trabajo asistidos por IA donde tiene sentido.' },
    en: { title: 'Modern tools', body: 'We use what works — including AI-assisted workflows where it makes sense.' },
  },
  {
    es: { title: 'Estándares claros', body: 'Cobertura de tests, revisión de código, criterios de aceptación. No como burocracia — como respeto al trabajo del equipo.' },
    en: { title: 'Clear standards', body: 'Test coverage, code review, acceptance criteria. Not as bureaucracy — as respect for the team\'s work.' },
  },
];

const PRINCIPLES = [
  { es: 'Construimos para el lector que lee en serio, no para el usuario que quiere entretenimiento.', en: 'We build for the reader who reads seriously, not for the user who wants entertainment.' },
  { es: 'Una categoría se construye con comportamientos repetidos, no con lanzamientos.', en: 'A category is built with repeated behaviors, not launches.' },
  { es: 'El código sin tests no está terminado. El diseño sin propósito tampoco.', en: 'Code without tests is not finished. Design without purpose either.' },
  { es: 'Documentamos lo que decidimos y por qué — no solo el código.', en: 'We document what we decided and why — not just the code.' },
  { es: 'El error que se reporta rápido es un error que se repara rápido.', en: 'An error reported quickly is an error fixed quickly.' },
  { es: 'Respetar el tiempo de los demás es parte del trabajo.', en: 'Respecting each other\'s time is part of the job.' },
];

const AREAS = [
  'Ingeniería backend / Backend engineering',
  'Ingeniería frontend web / Frontend web engineering',
  'Ingeniería móvil / Mobile engineering',
  'DevOps / Infraestructura',
  'Producto / Product',
  'Editorial / Contenido',
];

export default function CareersPage() {
  return (
    <main>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>Carreras · Careers</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-3">
          Si crees que el conocimiento<br />debería ser social —
        </h1>
        <p className="text-2xl text-gray-400 font-light mb-6">
          If you believe knowledge should be social —
        </p>
        <p className="text-xl text-[#0D1B2A] font-semibold max-w-2xl">
          que los libros deberían importar más de lo que importan hoy, y que construir la plataforma para eso es uno de los trabajos más interesantes disponibles ahora mismo — hablemos.
        </p>
        <p className="text-base text-gray-400 font-light mt-2 max-w-2xl italic">
          that books should matter more than they do today, and that building the platform for that is one of the most interesting jobs available right now — let&apos;s talk.
        </p>
      </section>

      {/* Culture */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Cómo es trabajar aquí" en="What it is like to work here" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {WORK_LIFE.map(({ es, en }) => (
              <div key={es.title} className="bg-white border border-gray-100 rounded-xl p-6">
                <h3 className="font-bold text-[#0D1B2A] text-sm mb-1">{es.title}</h3>
                <p className="text-gray-400 text-xs italic mb-3">{en.title}</p>
                <p className="text-gray-700 text-sm leading-relaxed">{es.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Working principles */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Principios de trabajo" en="Working principles" />
        <div className="space-y-0">
          {PRINCIPLES.map(({ es, en }, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 py-4 border-b border-gray-50 last:border-0">
              <div className="col-span-1">
                <span className="text-xs font-bold text-indigo-400">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="col-span-11 grid grid-cols-1 lg:grid-cols-2 gap-2">
                <p className="text-[#0D1B2A] text-sm">{es}</p>
                <p className="text-gray-400 text-sm italic">{en}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Open positions */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Posiciones abiertas" en="Open positions" />
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center mb-6">
            <p className="text-[#0D1B2A] font-semibold mb-2">En este momento no tenemos posiciones abiertas.</p>
            <p className="text-gray-400 text-sm italic">We do not currently have open positions.</p>
            <p className="text-gray-500 text-sm mt-4">
              Cuando las tengamos, aparecerán aquí primero.<br />
              <span className="italic text-xs">When we do, they will appear here first.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Talent community */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Comunidad de talento" en="Talent community" />
        <p className="text-gray-600 text-sm mb-8 max-w-xl">
          Si quieres ser de las primeras personas en saber cuando abramos una posición, déjanos tu contacto.
          No usamos esta información para marketing — solo te escribiremos si hay algo relevante para ti.
        </p>
        <p className="text-gray-400 text-xs mb-8 italic max-w-xl">
          If you want to be among the first to know when we open a position, leave your contact.
          We will only reach out if there is something relevant for you.
        </p>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-8">
          <p className="text-sm text-gray-600 mb-6">
            Envíanos un email a{' '}
            <a href="mailto:equipo@noetia.app" className="text-indigo-600 font-semibold hover:underline">
              equipo@noetia.app
            </a>{' '}
            con:
          </p>
          <div className="space-y-3 mb-6">
            {[
              { label: 'Asunto / Subject', value: 'Comunidad de talento — [tu área / your area]' },
              { label: 'Tu nombre / Your name', value: '' },
              { label: 'Área de interés / Area of interest', value: AREAS.join(' · ') },
              { label: 'LinkedIn o portfolio (opcional)', value: '' },
              { label: 'Mensaje breve (opcional) / Brief message', value: 'Por qué te interesa Noetia / Why Noetia interests you' },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col sm:flex-row gap-1">
                <span className="text-xs font-semibold text-gray-500 w-52 shrink-0">{label}</span>
                {value && <span className="text-xs text-gray-400 italic">{value}</span>}
              </div>
            ))}
          </div>
          <a
            href="mailto:equipo@noetia.app?subject=Comunidad%20de%20talento"
            className="inline-flex items-center gap-2 bg-[#0D1B2A] text-white font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition text-sm"
          >
            Escribir a equipo@noetia.app →
          </a>
        </div>
      </section>

      {/* Bottom nav */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/team" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Equipo</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Conoce cómo trabajamos →</p>
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
