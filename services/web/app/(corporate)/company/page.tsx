import type { Metadata } from 'next';
import Link from 'next/link';
import { BiSection, SectionLabel, SectionTitle, PageCTA } from '../_components';

export const metadata: Metadata = {
  title: 'Noetia — Building the Knowledge Expression Platform',
  description: 'Noetia is creating a new category: Knowledge Expression. Learn about the platform, the business model, and the future we are building toward.',
  openGraph: { title: 'Noetia — Company', description: 'The first Knowledge Expression Platform — global, multimodal, social.' },
};

const PILLARS = [
  {
    es: { title: 'Plataforma global de conocimiento', body: 'Libros que importan, accesibles, sincronizados y vivos para cualquier lector en cualquier lugar.' },
    en: { title: 'Global knowledge platform', body: 'Books that matter, accessible, synchronized, and alive for any reader anywhere.' },
    icon: '🌐',
  },
  {
    es: { title: 'Ecosistema para creadores', body: 'Lectores y autores en una red que amplifica la expresión de ambos. Cada fragmento compartido es alcance orgánico para el autor.' },
    en: { title: 'Creator ecosystem', body: 'Readers and authors in a network that amplifies the expression of both. Every shared fragment is organic reach for the author.' },
    icon: '✍️',
  },
  {
    es: { title: 'Estándar multimodal de lectura', body: 'Leer y escuchar como la misma experiencia, no experiencias paralelas. Sincronización frase por frase como infraestructura.' },
    en: { title: 'Multimodal reading standard', body: 'Reading and listening as the same experience, not parallel ones. Phrase-by-phrase synchronization as infrastructure.' },
    icon: '🎧',
  },
  {
    es: { title: 'Red de identidad intelectual', body: 'Lo que lees y compartes define cómo el mundo te conoce. El perfil más auténtico que existe: construido con lecturas reales.' },
    en: { title: 'Intellectual identity network', body: 'What you read and share defines how the world knows you. The most authentic profile that exists: built with real readings.' },
    icon: '🧠',
  },
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

export default function CompanyPage() {
  return (
    <main>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>Empresa · Company</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-3">
          No somos una app de lectura<br />que llegó tarde.
        </h1>
        <p className="text-2xl text-gray-400 font-light mb-6">
          We are not a reading app that arrived late.
        </p>
        <p className="text-xl text-[#0D1B2A] font-semibold">
          Somos el primer intento deliberado de construir una categoría nueva: la Plataforma de Expresión del Conocimiento.
        </p>
        <p className="text-lg text-gray-400 font-light mt-1">
          We are the first deliberate attempt to build a new category: the Knowledge Expression Platform.
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
                <p>La diferencia es la misma en todos los casos: de consumo privado a expresión pública.</p>
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
                <p>The difference is the same in every case: from private consumption to public expression.</p>
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
          {PILLARS.map(({ es, en, icon }) => (
            <div key={es.title} className="border border-gray-100 rounded-xl p-6">
              <span className="text-3xl block mb-4">{icon}</span>
              <h3 className="font-bold text-[#0D1B2A] mb-1">{es.title}</h3>
              <p className="text-gray-400 text-xs italic mb-3">{en.title}</p>
              <p className="text-gray-700 text-sm leading-relaxed">{es.body}</p>
              <p className="text-gray-400 text-xs leading-relaxed mt-2 italic">{en.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Transformation Loop */}
      <section className="bg-[#0D1B2A] text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <SectionLabel>La transformación · The transformation</SectionLabel>
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 leading-snug">
            Lo que ocurre con un usuario de Noetia<br />en seis meses.
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-4 text-slate-300 text-[15px]">
              <p>Imagina un usuario que lee en Noetia durante seis meses:</p>
              <p>Ha leído <em>Las Meditaciones</em>, <em>Hábitos Atómicos</em>, <em>El Príncipe</em> y <em>El Nuevo Testamento</em>.</p>
              <p>Ha resaltado 140 fragmentos. Ha compartido 23.</p>
              <p>Su audiencia ha visto, a través de esos 23 fragmentos, que piensa sobre el estoicismo, la productividad, el poder y la fe.</p>
              <p>Ese perfil no se construyó con un formulario. Se construyó con lecturas reales y elecciones reales.</p>
              <p className="text-white font-semibold">Ese es el resultado de Noetia. No una biblioteca. Una identidad visible.</p>
            </div>
            <div className="space-y-4 text-slate-400 text-[14px] italic">
              <p>Imagine a user who reads on Noetia for six months:</p>
              <p>They have read <em>Meditations</em>, <em>Atomic Habits</em>, <em>The Prince</em>, and <em>The New Testament</em>.</p>
              <p>They have highlighted 140 fragments. They have shared 23.</p>
              <p>Their audience has seen, through those 23 fragments, that they think about stoicism, productivity, power, and faith.</p>
              <p>That profile was not built with a form. It was built with real readings and real choices.</p>
              <p className="text-slate-200 font-semibold not-italic">That is the result of Noetia. Not a library. A visible identity.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Areas of Operation */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Áreas de operación" en="Areas of operation" />
        <div className="space-y-3">
          {OPERATIONS.map(({ es, en }) => (
            <div key={es} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-8 py-3 border-b border-gray-50">
              <p className="text-[#0D1B2A] text-sm font-medium sm:w-1/2">{es}</p>
              <p className="text-gray-400 text-sm italic sm:w-1/2">{en}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Publishing Ecosystem + Revenue */}
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
                <p><strong>Distribución de ingresos por cada pago:</strong></p>
                <ul className="list-none space-y-1 text-sm">
                  <li>45% → Noetia</li>
                  <li>36% → Autor</li>
                  <li>9% → Narrador</li>
                  <li>2,22% → Causas Noetia</li>
                  <li>7,78% → Marketing</li>
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
                <p><strong>Revenue distribution per payment:</strong></p>
                <ul className="list-none space-y-1 text-sm">
                  <li>45% → Noetia</li>
                  <li>36% → Author</li>
                  <li>9% → Narrator</li>
                  <li>2.22% → Causas Noetia</li>
                  <li>7.78% → Marketing</li>
                </ul>
              </>
            }
          />
        </div>
      </section>

      {/* Future Growth */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Crecimiento futuro" en="Future growth" />
        <div className="space-y-3">
          {FUTURE.map(({ es, en }) => (
            <div key={es} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-8 py-3 border-b border-gray-50">
              <p className="text-[#0D1B2A] text-sm font-medium sm:w-1/2">{es}</p>
              <p className="text-gray-400 text-sm italic sm:w-1/2">{en}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTAs */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link href="/how-we-build" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Ingeniería</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Cómo construimos →</p>
          </Link>
          <Link href="/milestones" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Progreso</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Lo que hemos construido →</p>
          </Link>
          <Link href="/upload-guide" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Para autores</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Publicar en Noetia →</p>
          </Link>
        </div>
      </section>

    </main>
  );
}
