import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Noetia — Where knowledge becomes visible',
  description:
    'Lee, escucha, resalta y comparte. Noetia transforma lo que aprendes en una identidad intelectual visible — frase por frase.',
  openGraph: {
    title: 'Noetia — Where knowledge becomes visible',
    description: 'La primera plataforma de Expresión del Conocimiento. Lee, escucha, resalta y comparte lo que te define.',
    type: 'website',
    locale: 'es_LA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Noetia — Where knowledge becomes visible',
    description: 'La primera plataforma de Expresión del Conocimiento. Lee, escucha, resalta y comparte lo que te define.',
  },
};

const FEATURES = [
  {
    title: 'Absorbe',
    desc: 'Lee y escucha a la vez, frase por frase. El texto y el audio se mueven juntos — lo que escuchas es exactamente lo que ves. Nunca más pierdas el hilo.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden="true">
        <path d="M3 18v-6a9 9 0 0118 0v6" />
        <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z" />
        <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
      </svg>
    ),
  },
  {
    title: 'Captura',
    desc: 'Un toque guarda el pasaje que te movió. Cada fragmento es una pieza de lo que piensas — organizado por libro, listo para ser expresado.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 11.25v5.25a2.25 2.25 0 01-2.25 2.25H5.25a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 015.25 4.5h5.25" />
      </svg>
    ),
  },
  {
    title: 'Expresa',
    desc: 'Convierte cualquier fragmento en contenido visual para LinkedIn, Instagram o Pinterest. Lo que compartiste hoy es parte de quién eres mañana.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
      </svg>
    ),
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0D1B2A] text-white">

      {/* Nav */}
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-6">
        <span className="text-xl font-bold tracking-widest shrink-0">NOETIA</span>
        <div className="hidden lg:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/about" className="hover:text-white transition">Sobre Noetia</Link>
          <Link href="/company" className="hover:text-white transition">Empresa</Link>
          <Link href="/how-we-build" className="hover:text-white transition">Cómo construimos</Link>
          <Link href="/team" className="hover:text-white transition">Equipo</Link>
          <Link href="/careers" className="hover:text-white transition">Carreras</Link>
          <Link href="/contact" className="hover:text-white transition">Contacto</Link>
        </div>
        <div className="flex items-center gap-4 text-sm shrink-0">
          <Link href="/login" className="hidden sm:block text-slate-300 hover:text-white transition">Iniciar sesión</Link>
          <Link href="/register" className="bg-white text-[#0D1B2A] px-4 py-1.5 rounded-full font-semibold hover:bg-slate-100 transition text-sm">
            Crear cuenta
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-20 text-center">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-6">
          Knowledge Expression Platform
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
          Lo que lees te define.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Noetia lo hace visible.
          </span>
        </h1>

        <p className="text-slate-300 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          Noetia combina lectura, escucha activa, captura de ideas y expresión en una sola
          plataforma. Lo que resaltas y compartes construye algo más que contenido:
          construye tu identidad intelectual.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto bg-white text-[#0D1B2A] font-semibold px-8 py-3.5 rounded-xl hover:bg-slate-100 transition text-base"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/library"
            className="w-full sm:w-auto border border-white/20 text-white font-medium px-8 py-3.5 rounded-xl hover:bg-white/10 transition text-base"
          >
            Explorar la biblioteca →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white/5 border-t border-white/10" aria-label="Cómo funciona">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-center text-slate-400 text-sm font-medium uppercase tracking-widest mb-10">
            Tres pasos. Una transformación.
          </p>
          <div className="grid sm:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                  {f.icon}
                </div>
                <h2 className="font-semibold text-white">{f.title}</h2>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Identity builder callout */}
      <section className="border-t border-white/10" aria-label="Identidad intelectual">
        <div className="max-w-4xl mx-auto px-6 py-14">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-900/60 to-blue-900/40 border border-indigo-500/20 px-8 py-10 sm:px-12 text-center">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-4">
              Lo que ocurre con el tiempo
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-4 max-w-2xl mx-auto">
              No acumulas libros leídos.<br />Construyes quién eres.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed max-w-xl mx-auto">
              Cada fragmento que guardas y compartes es una pieza de tu identidad intelectual.
              Con el tiempo, Noetia sabe qué leíste, qué te movió y qué compartiste.
              El resultado no es una biblioteca. Es un mapa visible de lo que piensas y en qué crees.
            </p>
          </div>
        </div>
      </section>

      {/* Noetia Clubs banner */}
      <section className="border-t border-white/10" aria-label="Clubes de Lectura">
        <div className="max-w-4xl mx-auto px-6 py-14">
          <div className="rounded-2xl bg-white/5 border border-white/10 px-8 py-10 sm:px-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4">
              Noetia Clubs
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-3">
              Las ideas se profundizan cuando se comparten.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed mb-8 max-w-xl">
              Los Clubes de Noetia no son grupos de chat sobre libros. Son comunidades donde
              el conocimiento se construye colectivamente — con discusiones ancladas a la frase
              exacta que las inspiró, sesiones en vivo sincronizadas y un historial compartido
              de lo que el grupo leyó y pensó.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              {[
                { icon: '💬', label: 'Discusiones ancladas', desc: 'Cada comentario vive en la frase exacta que lo inspiró, no en el capítulo' },
                { icon: '🎧', label: 'Escucha Juntos', desc: 'Sesiones en vivo donde todos escuchan la misma frase al mismo tiempo' },
                { icon: '🗳️', label: 'Elijan juntos', desc: 'El grupo vota el próximo libro — el conocimiento como decisión colectiva' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex-1 flex gap-3 items-start bg-white/5 rounded-xl p-4">
                  <span className="text-2xl mt-0.5 shrink-0">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-slate-400 leading-snug mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/clubs"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition text-sm"
            >
              Explorar clubes →
            </Link>
          </div>
        </div>
      </section>

      {/* Causas Noetia banner */}
      <section className="border-t border-white/10" aria-label="Causas Noetia">
        <div className="max-w-4xl mx-auto px-6 py-14">
          <div className="rounded-2xl bg-white/5 border border-white/10 px-8 py-10 sm:px-12">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4">
              Causas Noetia
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-4">
              Compartir es una forma de ayudar.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed mb-8 max-w-xl">
              Noetia es una plataforma de compartir conocimiento. Y creemos que compartir
              tiene que significar algo más que alcance. Por eso el{' '}
              <strong className="text-white">2,22% de cada compra</strong> apoya proyectos sociales
              reales — no como un botón de donación, sino como parte de cómo opera la plataforma
              desde el primer día. Tú eliges la causa.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              {[
                { icon: '🐾', label: 'Bienestar Animal', desc: 'Rescate, cuidado y protección de animales en América Latina' },
                { icon: '📚', label: 'Niñez y Juventud', desc: 'Protección, alimentación, educación y oportunidades para los más vulnerables' },
                { icon: '🌿', label: 'Medio Ambiente', desc: 'Protección de ecosistemas y biodiversidad de la región' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex-1 flex gap-3 items-start bg-white/5 rounded-xl p-4">
                  <span className="text-2xl mt-0.5 shrink-0">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-slate-400 leading-snug mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/causas"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-xl transition text-sm"
            >
              Conoce más de Causas Noetia →
            </Link>
          </div>
        </div>
      </section>

      {/* For authors */}
      <section className="max-w-4xl mx-auto px-6 py-16" aria-label="Para autores">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">Para autores y editoriales</p>
            <h2 className="text-xl font-bold text-white mb-2">
              Tus lectores no solo leen tu libro. Lo integran, lo resaltan y lo comparten como parte de quiénes son.
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Publicar en Noetia no es solo distribución digital. Es entrar a una plataforma donde
              los libros se convierten en expresión — con analytics en tiempo real de lecturas,
              fragmentos compartidos y alcance orgánico generado por tus lectores.
            </p>
          </div>
          <div className="flex-shrink-0">
            <Link
              href="/upload-guide"
              className="inline-block bg-white text-[#0D1B2A] font-semibold px-6 py-3 rounded-xl hover:bg-slate-100 transition text-sm whitespace-nowrap"
            >
              Ver guía de publicación →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div>
            <span className="font-bold tracking-widest text-slate-400">NOETIA</span>
            <span className="ml-3 text-slate-600 text-xs">Where knowledge becomes visible.</span>
          </div>
          <nav aria-label="Footer" className="flex gap-6">
            <Link href="/login" className="hover:text-slate-300 transition">Iniciar sesión</Link>
            <Link href="/clubs" className="hover:text-slate-300 transition">Clubes</Link>
            <Link href="/causas" className="hover:text-slate-300 transition">Causas Noetia</Link>
            <Link href="/upload-guide" className="hover:text-slate-300 transition">Para autores</Link>
            <a href="mailto:info@noetia.app" className="hover:text-slate-300 transition">Contacto</a>
          </nav>
          <span>© {new Date().getFullYear()} Noetia</span>
        </div>
      </footer>

    </main>
  );
}
