'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { LangText, SectionLabel, SectionTitle } from '../_components';

const WORK_LIFE = [
  { es: { title: 'El problema importa', body: 'No estás optimizando el embudo de un producto existente. Estás construyendo la infraestructura de una categoría nueva.' }, en: { title: 'The problem matters', body: 'You are not optimizing the funnel of an existing product. You are building the infrastructure of a new category.' } },
  { es: { title: 'Contexto completo', body: 'En un equipo pequeño, todos entienden el producto de punta a punta — no solo su parte.' }, en: { title: 'Full context', body: 'In a small team, everyone understands the product end to end — not just their part.' } },
  { es: { title: 'Trabajo que se ve', body: 'Lo que construyes llega a usuarios reales en días, no meses.' }, en: { title: 'Work you can see', body: 'What you build reaches real users in days, not months.' } },
  { es: { title: 'Autonomía real', body: 'Si propones algo razonado, se considera. No hay capas de aprobación.' }, en: { title: 'Real autonomy', body: 'If you propose something reasoned, it is considered. There are no approval layers.' } },
  { es: { title: 'Herramientas modernas', body: 'Usamos lo que funciona — incluyendo flujos de trabajo asistidos por IA donde tiene sentido.' }, en: { title: 'Modern tools', body: 'We use what works — including AI-assisted workflows where it makes sense.' } },
  { es: { title: 'Estándares claros', body: 'Cobertura de tests, revisión de código, criterios de aceptación. No como burocracia — como respeto al trabajo del equipo.' }, en: { title: 'Clear standards', body: 'Test coverage, code review, acceptance criteria. Not as bureaucracy — as respect for the team\'s work.' } },
];

const PRINCIPLES = [
  { es: 'Construimos para el lector que lee en serio, no para el usuario que quiere entretenimiento.', en: 'We build for the reader who reads seriously, not for the user who wants entertainment.' },
  { es: 'Una categoría se construye con comportamientos repetidos, no con lanzamientos.', en: 'A category is built with repeated behaviors, not launches.' },
  { es: 'El código sin tests no está terminado. El diseño sin propósito tampoco.', en: 'Code without tests is not finished. Design without purpose either.' },
  { es: 'Documentamos lo que decidimos y por qué — no solo el código.', en: 'We document what we decided and why — not just the code.' },
  { es: 'El error que se reporta rápido es un error que se repara rápido.', en: 'An error reported quickly is an error fixed quickly.' },
  { es: 'Respetar el tiempo de los demás es parte del trabajo.', en: 'Respecting each other\'s time is part of the job.' },
];

export default function CareersContent() {
  const { language } = useTranslation();
  const l = language;

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{l === 'es' ? 'Carreras' : 'Careers'}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-6">
          <LangText
            es="Si crees que el conocimiento debería ser social —"
            en="If you believe knowledge should be social —"
          />
        </h1>
        <p className="text-xl text-[#0D1B2A] font-semibold max-w-2xl">
          <LangText
            es="que los libros deberían importar más de lo que importan hoy, y que construir la plataforma para eso es uno de los trabajos más interesantes disponibles ahora mismo — hablemos."
            en="that books should matter more than they do today, and that building the platform for that is one of the most interesting jobs available right now — let's talk."
          />
        </p>
      </section>

      {/* Work life */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Cómo es trabajar aquí" en="What it is like to work here" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {WORK_LIFE.map(({ es, en }) => {
              const w = l === 'es' ? es : en;
              return (
                <div key={w.title} className="bg-white border border-gray-100 rounded-xl p-6">
                  <h3 className="font-bold text-[#0D1B2A] text-sm mb-2">{w.title}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{w.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Principios de trabajo" en="Working principles" />
        <div className="space-y-0">
          {PRINCIPLES.map(({ es, en }, i) => (
            <div key={i} className="flex gap-4 py-4 border-b border-gray-50 last:border-0">
              <span className="text-xs font-bold text-indigo-400 shrink-0 w-6">{String(i + 1).padStart(2, '0')}</span>
              <p className="text-[#0D1B2A] text-sm">{l === 'es' ? es : en}</p>
            </div>
          ))}
        </div>
      </section>

      {/* No positions */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Posiciones abiertas" en="Open positions" />
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-[#0D1B2A] font-semibold mb-2">
              <LangText es="En este momento no tenemos posiciones abiertas." en="We do not currently have open positions." />
            </p>
            <p className="text-gray-500 text-sm mt-3">
              <LangText
                es="Cuando las tengamos, aparecerán aquí primero."
                en="When we do, they will appear here first."
              />
            </p>
          </div>
        </div>
      </section>

      {/* Talent community */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Comunidad de talento" en="Talent community" />
        <p className="text-gray-600 text-sm mb-6 max-w-xl">
          <LangText
            es="Si quieres ser de las primeras personas en saber cuando abramos una posición, escríbenos. No usamos esta información para marketing — solo te contactaremos si hay algo relevante para ti."
            en="If you want to be among the first to know when we open a position, reach out. We will only contact you if there is something relevant for you."
          />
        </p>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-8">
          <p className="text-sm text-gray-600 mb-4">
            <LangText es="Envíanos un email a" en="Send us an email to" />{' '}
            <a href="mailto:equipo@noetia.app" className="text-indigo-600 font-semibold hover:underline">equipo@noetia.app</a>{' '}
            <LangText
              es="con tu nombre, área de interés y un mensaje breve sobre por qué te interesa Noetia."
              en="with your name, area of interest, and a brief message about why Noetia interests you."
            />
          </p>
          <a href="mailto:equipo@noetia.app?subject=Talent%20community" className="inline-flex items-center gap-2 bg-[#0D1B2A] text-white font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition text-sm">
            <LangText es="Escribir a equipo@noetia.app →" en="Email equipo@noetia.app →" />
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/team" className="border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition group">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">{l === 'es' ? 'Equipo' : 'Team'}</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition"><LangText es="Conoce cómo trabajamos →" en="Learn how we work →" /></p>
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
