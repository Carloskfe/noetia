'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { BiSection, LangText, PageCTA, SectionLabel, SectionTitle } from '../_components';

const VALUES = [
  {
    es: { title: 'El conocimiento es identidad', body: 'Lo que lees dice algo sobre quién eres. Noetia lo hace visible cuando tú lo decides.' },
    en: { title: 'Knowledge is identity', body: 'What you read says something about who you are. Noetia makes it visible when you decide.' },
  },
  {
    es: { title: 'La expresión es el acto más elevado del conocimiento', body: 'Leer sin expresar es consumir. Leer y expresar es pensar.' },
    en: { title: 'Expression is the highest act of knowledge', body: 'Reading without expressing is consuming. Reading and expressing is thinking.' },
  },
  {
    es: { title: 'La profundidad sobre el volumen', body: 'Preferimos que un usuario capture diez ideas que lo definan a que "consuma" cien que olvide.' },
    en: { title: 'Depth over volume', body: 'We would rather a user capture ten defining ideas than "consume" a hundred they forget.' },
  },
  {
    es: { title: 'La ejecución es la estrategia', body: 'Las categorías no se declaran. Se construyen, funcionalidad por funcionalidad, con productos que funcionan.' },
    en: { title: 'Execution is the strategy', body: 'Categories are not declared. They are built, feature by feature, with products that work.' },
  },
  {
    es: { title: 'Compartir es ayudar', body: 'Noetia es una plataforma de compartir conocimiento. Ese acto debe tener consecuencias reales. El 2,22% de cada compra apoya causas sociales — desde el primer día, de forma estructural.' },
    en: { title: 'Sharing is helping', body: 'Noetia is a platform for sharing knowledge. That act should have real consequences. 2.22% of every purchase supports social causes — from day one, structurally.' },
  },
  {
    es: { title: 'Honestidad sobre lo que somos', body: 'Somos un equipo pequeño construyendo algo serio. Lo decimos sin apología.' },
    en: { title: 'Honesty about what we are', body: 'We are a small team building something serious. We say so without apology.' },
  },
];

const ACTS = {
  es: ['Leer', 'Escuchar', 'Resaltar', 'Anotar', 'Compartir', 'Construir identidad'],
  en: ['Read', 'Listen', 'Highlight', 'Annotate', 'Share', 'Build identity'],
};

export default function AboutContent() {
  const { language } = useTranslation();
  const l = language;

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>
          {l === 'es' ? 'Sobre Noetia' : 'About Noetia'}
        </SectionLabel>
        <div className="space-y-2 mb-8">
          <h1 className="text-5xl sm:text-6xl font-bold text-[#0D1B2A] leading-none">
            <LangText es="Leer siempre fue íntimo." en="Reading was always intimate." />
          </h1>
          <div className="h-4" />
          <p className="text-3xl font-bold text-[#0D1B2A]">
            <LangText es="Noetia lo convierte en identidad." en="Noetia turns it into identity." />
          </p>
        </div>
        <PageCTA
          href="/register"
          label={l === 'es' ? 'Crear cuenta gratis' : 'Create free account'}
          secondary={{ href: '/library', label: l === 'es' ? 'Explorar la biblioteca →' : 'Explore the library →' }}
        />
      </section>

      {/* Mission + Vision */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
          <div>
            <SectionLabel>{l === 'es' ? 'Misión' : 'Mission'}</SectionLabel>
            <p className="text-[#0D1B2A] font-semibold text-lg leading-snug">
              <LangText
                es="Transformar el conocimiento que consumes en una identidad intelectual visible."
                en="Transform the knowledge you consume into a visible intellectual identity."
              />
            </p>
          </div>
          <div>
            <SectionLabel>{l === 'es' ? 'Visión' : 'Vision'}</SectionLabel>
            <p className="text-[#0D1B2A] font-semibold text-lg leading-snug">
              <LangText
                es="Un mundo donde el conocimiento es la moneda social más valiosa — y las personas más leídas son las más visibles."
                en="A world where knowledge is the most valuable social currency — and the most well-read people are the most visible."
              />
            </p>
          </div>
        </div>
      </section>

      {/* Why We Exist */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Por qué existimos" en="Why we exist" />
          <BiSection
            es={
              <>
                <p>Existen plataformas para consumir contenido. Existen plataformas para crear contenido. No existía una plataforma donde el acto de leer produjera, directamente, expresión.</p>
                <p>Eso es lo que construimos.</p>
                <p>Cuando lees <em>Las Meditaciones</em> y resaltas "La impedimenta para la acción impulsa la acción", ese momento no debería desaparecer en un marcador olvidado. Debería vivir. Debería ser parte de cómo el mundo te conoce.</p>
                <p>Hay millones de personas que leen libros extraordinarios — y casi nadie en su entorno lo sabe. Hay ideas que cambian vidas muriendo en el subrayado de un libro que nadie más ve.</p>
                <p>Noetia existe para cerrar esa brecha — entre lo que lees y lo que expresas. Entre quién eres intelectualmente y quién apareces siendo públicamente.</p>
              </>
            }
            en={
              <>
                <p>Platforms exist to consume content. Platforms exist to create content. No platform existed where the act of reading directly produced expression.</p>
                <p>That is what we built.</p>
                <p>When you read <em>Meditations</em> and highlight "The impediment to action advances action," that moment should not disappear into a forgotten bookmark. It should live. It should be part of how the world knows you.</p>
                <p>There are millions of people reading extraordinary books — and almost no one in their circle knows it. There are ideas that change lives dying in the margin of a book no one else ever sees.</p>
                <p>Noetia exists to close that gap — between what you read and what you express. Between who you are intellectually and who you appear to be publicly.</p>
              </>
            }
          />
        </div>
      </section>

      {/* What We Do */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Qué hacemos" en="What we do" />
        <BiSection
          es={
            <>
              <p>Noetia combina seis actos en una sola plataforma:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
                {ACTS.es.map((a) => (
                  <div key={a} className="bg-indigo-50 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 text-center">{a}</div>
                ))}
              </div>
              <p>Esa combinación no tiene nombre todavía en ningún otro producto. La llamamos <strong>Expresión del Conocimiento</strong>.</p>
              <p>Un usuario que lee <em>Hábitos Atómicos</em> en Noetia no solo avanza páginas. Captura los pasajes que lo movieron. Los comparte con su audiencia. Construye, de forma acumulativa, un registro visible de lo que piensa y en qué cree.</p>
              <p>Con el tiempo, ese registro no es una biblioteca. Es una identidad.</p>
            </>
          }
          en={
            <>
              <p>Noetia combines six acts in one platform:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
                {ACTS.en.map((a) => (
                  <div key={a} className="bg-indigo-50 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 text-center">{a}</div>
                ))}
              </div>
              <p>That combination does not yet have a name in any other product. We call it <strong>Knowledge Expression</strong>.</p>
              <p>A user who reads <em>Atomic Habits</em> on Noetia does not just advance pages. They capture the passages that moved them. They share them with their audience. They build, cumulatively, a visible record of what they think and what they believe.</p>
              <p>Over time, that record is not a library. It is an identity.</p>
            </>
          }
        />
      </section>

      {/* Our Approach */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Nuestro enfoque" en="Our approach" />
          <BiSection
            es={
              <>
                <p>Diseñamos Noetia para personas que leen en serio — y que entienden que las ideas no tienen valor si no se expresan.</p>
                <p>No somos una app de entretenimiento. No optimizamos para el tiempo en pantalla. Optimizamos para la profundidad y la expresión.</p>
                <p>Cada decisión de diseño parte de una pregunta: ¿esta funcionalidad transforma al usuario de consumidor en expresor? Si la respuesta es no, no entra.</p>
                <p>Construir una categoría es diferente a construir un producto. Las categorías requieren que un comportamiento se vuelva habitual — y los hábitos se crean con experiencias que funcionan de forma consistente, no con funciones que impresionan una sola vez.</p>
              </>
            }
            en={
              <>
                <p>We designed Noetia for people who read seriously — and who understand that ideas have no value if they are not expressed.</p>
                <p>We are not an entertainment app. We do not optimize for screen time. We optimize for depth and expression.</p>
                <p>Every design decision starts with a question: does this feature transform the user from consumer to expresser? If the answer is no, it does not enter.</p>
                <p>Building a category is different from building a product. Categories require a behavior to become habitual — and habits are created with experiences that work consistently, not features that impress once.</p>
              </>
            }
          />
        </div>
      </section>

      {/* Core Values */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Lo que creemos" en="What we believe" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {VALUES.map(({ es, en }) => {
            const v = l === 'es' ? es : en;
            return (
              <div key={v.title} className="border border-gray-100 rounded-xl p-6">
                <h3 className="font-bold text-[#0D1B2A] mb-3 text-sm">{v.title}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{v.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Company Story */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="La historia de Noetia" en="The Noetia story" />
          <BiSection
            es={
              <>
                <p>Noetia comenzó con una observación incómoda: hay millones de personas que leen libros extraordinarios — y casi nadie en su entorno lo sabe.</p>
                <p>Hay plataformas para mostrar lo que ves, lo que escuchas, lo que comes, lo que compras. No hay ninguna para mostrar lo que piensas.</p>
                <p>Construir una plataforma donde el conocimiento sea social requería resolver un problema técnico muy específico: sincronizar texto y audio frase por frase. No capítulo por capítulo. Frase por frase.</p>
                <p>Las categorías más importantes de la última década no fueron funciones nuevas. Fueron comportamientos nuevos. Instagram creó la identidad visual. LinkedIn creó la identidad profesional. Spotify creó la identidad musical. Noetia está creando la <strong>identidad intelectual</strong>.</p>
                <p>Hoy operamos con una plataforma en producción, lectores reales y una arquitectura construida para escalar. El trabajo que queda es completar la categoría.</p>
              </>
            }
            en={
              <>
                <p>Noetia started with an uncomfortable observation: there are millions of people reading extraordinary books — and almost no one in their circle knows it.</p>
                <p>There are platforms for showing what you watch, listen to, eat, buy. There is no platform for showing what you think.</p>
                <p>Building a platform where knowledge is social required solving a very specific technical problem: synchronizing text and audio phrase by phrase. Not chapter by chapter. Phrase by phrase.</p>
                <p>The most important categories of the last decade were not new features. They were new behaviors. Instagram created visual identity. LinkedIn created professional identity. Spotify created musical identity. Noetia is creating <strong>intellectual identity</strong>.</p>
                <p>Today we operate with a production platform, real readers, and an architecture built to scale. The work remaining is to complete the category.</p>
              </>
            }
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { href: '/company', label_es: 'Empresa', cta_es: 'Cómo operamos →', label_en: 'Company', cta_en: 'How we operate →' },
            { href: '/how-we-build', label_es: 'Ingeniería', cta_es: 'Cómo construimos →', label_en: 'Engineering', cta_en: 'How we build →' },
            { href: '/contact', label_es: 'Contacto', cta_es: 'Hablar con el equipo →', label_en: 'Contact', cta_en: 'Talk to the team →' },
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
