'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { BiSection, LangText, SectionLabel, SectionTitle } from '../_components';

const PILLARS = [
  { icon: '🌐', es: { title: 'Plataforma global de conocimiento', body: 'Libros que importan, accesibles, sincronizados y vivos para cualquier lector en cualquier lugar.' }, en: { title: 'Global knowledge platform', body: 'Books that matter, accessible, synchronized, and alive for any reader anywhere.' } },
  { icon: '✍️', es: { title: 'Ecosistema para creadores', body: 'Lectores y autores en una red que amplifica la expresión de ambos. Cada fragmento compartido es alcance orgánico para el autor.' }, en: { title: 'Creator ecosystem', body: 'Readers and authors in a network that amplifies the expression of both. Every shared fragment is organic reach for the author.' } },
  { icon: '🎧', es: { title: 'Estándar multimodal de lectura', body: 'Leer y escuchar como la misma experiencia, no experiencias paralelas. Sincronización frase por frase como infraestructura.' }, en: { title: 'Multimodal reading standard', body: 'Reading and listening as the same experience, not parallel ones. Phrase-by-phrase synchronization as infrastructure.' } },
  { icon: '🧠', es: { title: 'Red de identidad intelectual', body: 'Lo que lees y compartes define cómo el mundo te conoce. El perfil más auténtico que existe: construido con lecturas reales.' }, en: { title: 'Intellectual identity network', body: 'What you read and share defines how the world knows you. The most authentic profile that exists: built with real readings.' } },
];

const OPERATIONS = [
  { es: 'Producto de consumo (web y móvil)', en: 'Consumer product (web and mobile)' },
  { es: 'Plataforma de publicación para autores y editoriales', en: 'Publishing platform for authors and publishers' },
  { es: 'Comunidades de lectura (Clubes, Escucha Juntos)', en: 'Reading communities (Clubs, Escucha Juntos)' },
  { es: 'Compartir contenido — fragmentos visuales para redes', en: 'Content sharing — visual fragments for social networks' },
  { es: 'Infraestructura editorial (revisión, analíticas, derechos)', en: 'Editorial infrastructure (review, analytics, rights)' },
  { es: 'Impacto social — Causas Noetia (2,22% de cada compra)', en: 'Social impact — Causas Noetia (2.22% of every purchase)' },
];

const FUTURE = [
  { es: 'Expansión del catálogo de autores en español e inglés', en: 'Expansion of the author catalog in Spanish and English' },
  { es: 'Herramientas de publicación para editoriales con catálogos grandes', en: 'Publishing tools for publishers with large catalogs' },
  { es: 'Extensión de los Clubes a eventos de autores y presentaciones en vivo', en: 'Extension of Clubs to author events and live presentations' },
  { es: 'Expansión a otros idiomas (portugués, catalán)', en: 'Expansion to other languages (Portuguese, Catalan)' },
  { es: 'API pública para instituciones educativas y bibliotecas digitales', en: 'Public API for educational institutions and digital libraries' },
];

const REVENUE = {
  es: [['45%', 'Noetia'], ['36%', 'Autor'], ['9%', 'Narrador'], ['2,22%', 'Causas Noetia'], ['7,78%', 'Marketing']],
  en: [['45%', 'Noetia'], ['36%', 'Author'], ['9%', 'Narrator'], ['2.22%', 'Causas Noetia'], ['7.78%', 'Marketing']],
};

export default function CompanyContent() {
  const { language } = useTranslation();
  const l = language;

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{l === 'es' ? 'Empresa' : 'Company'}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-6">
          <LangText
            es={<>No somos una app de lectura<br />que llegó tarde.</>}
            en={<>We are not a reading app<br />that arrived late.</>}
          />
        </h1>
        <p className="text-xl text-[#0D1B2A] font-semibold max-w-2xl">
          <LangText
            es="Somos el primer intento deliberado de construir una categoría nueva: la Plataforma de Expresión del Conocimiento."
            en="We are the first deliberate attempt to build a new category: the Knowledge Expression Platform."
          />
        </p>
      </section>

      {/* The New Category */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="La categoría que estamos creando" en="The category we are creating" />
          <BiSection
            es={
              <>
                <p>Las categorías más importantes de la última década no fueron funciones nuevas. Fueron comportamientos nuevos.</p>
                <div className="space-y-2 my-4 border-l-4 border-indigo-100 pl-4">
                  <p className="text-sm">Instagram no inventó las fotos. Creó la <strong>identidad visual</strong>.</p>
                  <p className="text-sm">LinkedIn no inventó el currículum. Creó la <strong>identidad profesional</strong>.</p>
                  <p className="text-sm">Spotify no inventó el audio. Creó la <strong>identidad musical</strong>.</p>
                </div>
                <p><strong>Noetia no inventó los libros. Está creando la identidad intelectual.</strong></p>
                <p>Amazon puede construir sincronización. Spotify puede construir audiolibros. Google puede construir sharing. Esas funciones por sí solas no son defensibles. Lo que es difícil de copiar es el comportamiento. Si Noetia se convierte en el lugar donde las personas expresan lo que aprenden, habremos creado algo que ninguna función puede replicar: un hábito cultural.</p>
              </>
            }
            en={
              <>
                <p>The most important categories of the last decade were not new features. They were new behaviors.</p>
                <div className="space-y-2 my-4 border-l-4 border-indigo-100 pl-4">
                  <p className="text-sm">Instagram did not invent photos. It created <strong>visual identity</strong>.</p>
                  <p className="text-sm">LinkedIn did not invent the résumé. It created <strong>professional identity</strong>.</p>
                  <p className="text-sm">Spotify did not invent audio. It created <strong>musical identity</strong>.</p>
                </div>
                <p><strong>Noetia did not invent books. It is creating intellectual identity.</strong></p>
                <p>Amazon can build syncing. Spotify can build audiobooks. Google can build sharing. Those features alone are not defensible. What is difficult to copy is the behavior. If Noetia becomes the place where people express what they learn, we will have created something no feature can replicate: a cultural habit.</p>
              </>
            }
          />
        </div>
      </section>

      {/* Four Pillars */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Cuatro pilares" en="Four pillars" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {PILLARS.map(({ icon, es, en }) => {
            const p = l === 'es' ? es : en;
            return (
              <div key={p.title} className="border border-gray-100 rounded-xl p-6">
                <span className="text-3xl block mb-4">{icon}</span>
                <h3 className="font-bold text-[#0D1B2A] mb-3 text-sm">{p.title}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Transformation Loop */}
      <section className="bg-[#0D1B2A] text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <SectionLabel>{l === 'es' ? 'La transformación' : 'The transformation'}</SectionLabel>
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 leading-snug">
            <LangText
              es="Lo que ocurre con un usuario de Noetia en seis meses."
              en="What happens to a Noetia user in six months."
            />
          </h2>
          <div className="text-slate-300 text-[15px] space-y-4 max-w-2xl">
            {l === 'es' ? (
              <>
                <p>Imagina un usuario que lee en Noetia durante seis meses:</p>
                <p>Ha leído <em>Las Meditaciones</em>, <em>Hábitos Atómicos</em>, <em>El Príncipe</em> y <em>El Nuevo Testamento</em>.</p>
                <p>Ha resaltado 140 fragmentos. Ha compartido 23.</p>
                <p>Su audiencia ha visto, a través de esos 23 fragmentos, que piensa sobre el estoicismo, la productividad, el poder y la fe.</p>
                <p>Ese perfil no se construyó con un formulario. Se construyó con lecturas reales y elecciones reales.</p>
                <p className="text-white font-semibold">Ese es el resultado de Noetia. No una biblioteca. Una identidad visible.</p>
              </>
            ) : (
              <>
                <p>Imagine a user who reads on Noetia for six months:</p>
                <p>They have read <em>Meditations</em>, <em>Atomic Habits</em>, <em>The Prince</em>, and <em>The New Testament</em>.</p>
                <p>They have highlighted 140 fragments. They have shared 23.</p>
                <p>Their audience has seen, through those 23 fragments, that they think about stoicism, productivity, power, and faith.</p>
                <p>That profile was not built with a form. It was built with real readings and real choices.</p>
                <p className="text-white font-semibold">That is the result of Noetia. Not a library. A visible identity.</p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Areas of Operation */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Áreas de operación" en="Areas of operation" />
        <div className="space-y-0">
          {OPERATIONS.map(({ es, en }) => (
            <div key={es} className="py-3 border-b border-gray-100 last:border-0">
              <p className="text-[#0D1B2A] text-sm font-medium">→ {l === 'es' ? es : en}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Publishing + Revenue */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Ecosistema editorial y modelo de ingresos" en="Publishing ecosystem and revenue model" />
          <BiSection
            es={
              <>
                <p>Noetia opera como un canal de distribución digital para autores y editoriales que quieren llegar a lectores con una experiencia de lectura diferente.</p>
                <p><strong>Lo que ofrecemos a autores:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Portal de publicación con revisión editorial (3–5 días hábiles)</li>
                  <li>Sincronización texto-audio vía SRT/VTT o procesamiento Whisper</li>
                  <li>Analíticas de lectura: fragmentos guardados, compartidos, tiempo de lectura</li>
                  <li>Alcance orgánico generado por fragmentos que los lectores comparten</li>
                </ul>
                <p><strong>Distribución de ingresos:</strong></p>
                <ul className="list-none space-y-1 text-sm">
                  {REVENUE.es.map(([pct, who]) => <li key={who}>{pct} → {who}</li>)}
                </ul>
              </>
            }
            en={
              <>
                <p>Noetia operates as a digital distribution channel for authors and publishers who want to reach readers with a different reading experience.</p>
                <p><strong>What we offer authors:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Publishing portal with editorial review (3–5 business days)</li>
                  <li>Text-audio synchronization via SRT/VTT or Whisper processing</li>
                  <li>Reading analytics: saved fragments, shares, reading time</li>
                  <li>Organic reach generated by fragments readers share</li>
                </ul>
                <p><strong>Revenue distribution:</strong></p>
                <ul className="list-none space-y-1 text-sm">
                  {REVENUE.en.map(([pct, who]) => <li key={who}>{pct} → {who}</li>)}
                </ul>
              </>
            }
          />
        </div>
      </section>

      {/* Future Growth */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Crecimiento futuro" en="Future growth" />
        <div className="space-y-0">
          {FUTURE.map(({ es, en }) => (
            <div key={es} className="py-3 border-b border-gray-100 last:border-0">
              <p className="text-[#0D1B2A] text-sm font-medium">→ {l === 'es' ? es : en}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTAs */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { href: '/how-we-build', label_es: 'Ingeniería', cta_es: 'Cómo construimos →', label_en: 'Engineering', cta_en: 'How we build →' },
            { href: '/milestones', label_es: 'Progreso', cta_es: 'Lo que hemos construido →', label_en: 'Progress', cta_en: 'What we have built →' },
            { href: '/upload-guide', label_es: 'Para autores', cta_es: 'Publicar en Noetia →', label_en: 'For authors', cta_en: 'Publish on Noetia →' },
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
