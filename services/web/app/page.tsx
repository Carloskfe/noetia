import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Noetia — Lee. Escucha. Comparte.',
  description:
    'Sincroniza texto y audio de tus libros favoritos. Captura las ideas que más te cautivan y conviértelas en contenido visual para tus redes sociales — en segundos.',
  openGraph: {
    title: 'Noetia — Lee. Escucha. Comparte.',
    description: 'La plataforma de lectura sincronizada con audio para lectores que crean contenido.',
    type: 'website',
    locale: 'es_LA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Noetia — Lee. Escucha. Comparte.',
    description: 'La plataforma de lectura sincronizada con audio para lectores que crean contenido.',
  },
};

const FEATURES = [
  {
    title: 'Modo Escucha Activa',
    desc: 'Lee y escucha al mismo tiempo. Cada frase se resalta en tiempo real mientras el audio la narra — nunca más pierdas el hilo.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden="true">
        <path d="M3 18v-6a9 9 0 0118 0v6" />
        <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z" />
        <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
      </svg>
    ),
  },
  {
    title: 'Captura fragmentos',
    desc: 'Selecciona el texto que más te impacta con un toque. Todos tus fragmentos en un solo lugar, organizados por libro.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 11.25v5.25a2.25 2.25 0 01-2.25 2.25H5.25a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 015.25 4.5h5.25" />
      </svg>
    ),
  },
  {
    title: 'Comparte en segundos',
    desc: 'Convierte cualquier fragmento en una tarjeta visual lista para LinkedIn, Instagram o Pinterest — con tu estilo.',
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
      <nav className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <span className="text-xl font-bold tracking-widest">NOETIA</span>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-slate-300 hover:text-white transition">Iniciar sesión</Link>
          <Link href="/register" className="bg-white text-[#0D1B2A] px-4 py-1.5 rounded-full font-semibold hover:bg-slate-100 transition text-sm">
            Crear cuenta
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
          Lee. Escucha.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Comparte lo que más te gusta.
          </span>
        </h1>

        <p className="text-slate-300 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          Noetia sincroniza texto y audio de tus libros favoritos. Tú capturas las ideas que más
          te cautivan y Noetia las convierte en contenido visual para tus redes sociales — en segundos.
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
      <section className="bg-white/5 border-t border-white/10" aria-label="Características">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-center text-slate-400 text-sm font-medium uppercase tracking-widest mb-10">
            Qué hace Noetia diferente
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

      {/* Noetia Clubs banner */}
      <section className="border-t border-white/10" aria-label="Clubes de Lectura">
        <div className="max-w-4xl mx-auto px-6 py-14">
          <div className="rounded-2xl bg-white/5 border border-white/10 px-8 py-10 sm:px-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4">
              Noetia Clubs
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-3">
              Para quienes quieren dejar de leer en soledad.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed mb-8 max-w-xl">
              Lee, escucha, expande tus ideas. Los clubes de Noetia reúnen lectores
              alrededor de un libro — con discusiones ancladas frase a frase, sesiones
              en vivo sincronizadas y votaciones para elegir el próximo título juntos.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              {[
                { icon: '💬', label: 'Discusiones ancladas', desc: 'Cada comentario vive en la frase exacta que lo inspiró, no en el capítulo' },
                { icon: '🎧', label: 'Escucha Juntos', desc: 'Sesiones en vivo donde todos escuchan la misma frase al mismo tiempo' },
                { icon: '🗳️', label: 'Elijan juntos', desc: 'El grupo vota el próximo libro — democracia lectora' },
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
              Leer, Escuchar y Compartir ayuda a que el mundo sea un lugar mejor.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed mb-8 max-w-xl">
              Apoyamos proyectos sociales en tres líneas estratégicas que nos hacen soñar con un
              mejor mañana. Cada pago tuyo genera una donación para una o varias de nuestras
              causas aliadas, y tú puedes elegir a cuál apoyar.
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
            <h2 className="text-xl font-bold text-white mb-2">Publica tu libro. Llega a miles de lectores.</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Sube tu texto y audio. Noetia ofrece el Modo Escucha Activa para todos tus lectores,
              con analytics en tiempo real de lecturas, fragmentos y compartidos.
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
          <span className="font-bold tracking-widest text-slate-400">NOETIA</span>
          <nav aria-label="Footer" className="flex gap-6">
            <Link href="/login" className="hover:text-slate-300 transition">Iniciar sesión</Link>
            <Link href="/clubs" className="hover:text-slate-300 transition">Clubes</Link>
            <Link href="/causas" className="hover:text-slate-300 transition">Causas Noetia</Link>
            <Link href="/upload-guide" className="hover:text-slate-300 transition">Para autores</Link>
            <a href="mailto:hola@noetia.app" className="hover:text-slate-300 transition">Contacto</a>
          </nav>
          <span>© {new Date().getFullYear()} Noetia</span>
        </div>
      </footer>

    </main>
  );
}
