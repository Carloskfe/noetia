import type { Metadata } from 'next';
import Link from 'next/link';
import { BiSection, SectionLabel, SectionTitle } from '../_components';

export const metadata: Metadata = {
  title: 'Privacy, Security & Trust — Noetia',
  description: 'Your intellectual identity is yours. How Noetia protects your reading, your highlights, and your data.',
  openGraph: { title: 'Privacy, Security & Trust — Noetia', description: 'Your intellectual identity is yours. Noetia makes it visible when you decide, to the extent you decide.' },
};

const SECURITY = [
  { es: 'Contraseñas almacenadas con bcrypt (nunca en texto plano)', en: 'Passwords stored with bcrypt (never in plain text)' },
  { es: 'Tokens JWT con expiración corta (15 minutos) y refresh tokens rotativos', en: 'JWT tokens with short expiry (15 minutes) and rotating refresh tokens' },
  { es: 'Tokens sociales cifrados con AES-256-CBC en Redis', en: 'Social tokens encrypted with AES-256-CBC in Redis' },
  { es: 'Comunicaciones cifradas con TLS en todos los endpoints', en: 'TLS-encrypted communications on all endpoints' },
  { es: 'Certificados SSL automáticos vía Let\'s Encrypt', en: 'Automatic SSL certificates via Let\'s Encrypt' },
  { es: 'Firewall configurado — solo puertos 80, 443 y SSH expuestos', en: 'Configured firewall — only ports 80, 443, and SSH exposed' },
  { es: 'fail2ban activo en acceso SSH', en: 'fail2ban active on SSH access' },
];

const CONTROLS = [
  { es: 'Eliminar tu cuenta en cualquier momento desde tu perfil — eliminación real, no desactivación', en: 'Delete your account at any time from your profile — real deletion, not deactivation' },
  { es: 'Controlar qué datos son visibles para otros usuarios (progreso, biblioteca, perfil, fragmentos)', en: 'Control which data is visible to other users (progress, library, profile, fragments)' },
  { es: 'Exportar tus fragmentos en cualquier momento', en: 'Export your fragments at any time' },
  { es: 'Cambiar tu idioma sin perder ningún dato', en: 'Change your language without losing any data' },
  { es: 'Leer en modo privado sin que ningún fragmento sea compartido automáticamente', en: 'Read in private mode without any fragment being shared automatically' },
];

export default function TrustPage() {
  return (
    <main>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>Privacidad, Seguridad y Confianza · Privacy, Security & Trust</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-3">
          Tu identidad intelectual es tuya.
        </h1>
        <p className="text-2xl text-gray-400 font-light mb-6">
          Your intellectual identity is yours.
        </p>
        <p className="text-gray-700 text-[15px] max-w-2xl">
          Los libros que lees, los pasajes que resaltas, las ideas que te definen — son tuyos. Noetia los hace visibles cuando tú lo decides, en la medida que tú decides.
        </p>
        <p className="text-gray-400 text-sm max-w-2xl mt-2 italic">
          The books you read, the passages you highlight, the ideas that define you — they are yours. Noetia makes them visible when you decide, to the extent you decide.
        </p>
        <p className="text-[#0D1B2A] font-semibold text-sm mt-4">Eso no es marketing. Es el diseño de la plataforma.</p>
        <p className="text-gray-400 text-xs italic">That is not marketing. It is the design of the platform.</p>
      </section>

      {/* Data Privacy */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Privacidad de datos" en="Data privacy" />
          <BiSection
            es={
              <>
                <p>Recopilamos los datos mínimos necesarios para que la plataforma funcione y para construir tu identidad intelectual <em>contigo</em> — nunca sin ti.</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Correo electrónico y nombre para crear tu cuenta</li>
                  <li>Progreso de lectura para sincronizar tu posición entre dispositivos</li>
                  <li>Fragmentos guardados — tuyos, siempre, sin excepción</li>
                  <li>Preferencias de idioma y notificaciones</li>
                </ul>
                <p>Los datos de lectura — qué lees, qué resaltas, qué compartes — nunca se comparten con autores ni editoriales de forma individual. Los autores solo ven métricas agregadas y anónimas.</p>
                <p><strong>No vendemos datos. No construimos perfiles publicitarios. No monetizamos lo que piensas.</strong></p>
              </>
            }
            en={
              <>
                <p>We collect the minimum data necessary for the platform to work and to build your intellectual identity <em>with you</em> — never without you.</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Email and name to create your account</li>
                  <li>Reading progress to sync your position across devices</li>
                  <li>Saved fragments — yours, always, without exception</li>
                  <li>Language and notification preferences</li>
                </ul>
                <p>Reading data — what you read, what you highlight, what you share — is never shared with authors or publishers on an individual basis. Authors only see aggregated, anonymous metrics.</p>
                <p><strong>We do not sell data. We do not build advertising profiles. We do not monetize what you think.</strong></p>
              </>
            }
          />
        </div>
      </section>

      {/* Security */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Principios de seguridad" en="Security principles" />
        <div className="space-y-0">
          {SECURITY.map(({ es, en }) => (
            <div key={es} className="grid grid-cols-1 lg:grid-cols-2 gap-2 py-3 border-b border-gray-50">
              <p className="text-[#0D1B2A] text-sm">✓ {es}</p>
              <p className="text-gray-400 text-sm italic">{en}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Your Control */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Tu control sobre tu identidad intelectual" en="Your control over your intellectual identity" />
          <p className="text-gray-600 text-sm mb-6">
            Noetia está construida para que tú controles exactamente qué de tu identidad intelectual es visible — y para quién.
          </p>
          <div className="space-y-3">
            {CONTROLS.map(({ es, en }) => (
              <div key={es} className="grid grid-cols-1 lg:grid-cols-2 gap-2 py-3 border-b border-gray-100">
                <p className="text-[#0D1B2A] text-sm">→ {es}</p>
                <p className="text-gray-400 text-sm italic">{en}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Operational Reliability */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Confiabilidad operacional" en="Operational reliability" />
        <BiSection
          es={
            <>
              <p>Noetia corre en infraestructura dedicada con monitoreo continuo. Usamos Grafana + Prometheus para vigilar latencia, errores y salud de cada servicio.</p>
              <p>No tenemos un SLA público en este momento — somos una plataforma en etapa temprana y seremos honestos sobre eso. Lo que sí tenemos es monitoreo activo, alertas configuradas y el hábito de resolver problemas rápido.</p>
            </>
          }
          en={
            <>
              <p>Noetia runs on dedicated infrastructure with continuous monitoring. We use Grafana + Prometheus to watch latency, errors, and health of each service.</p>
              <p>We do not have a public SLA at this point — we are an early-stage platform and we will be honest about that. What we do have is active monitoring, configured alerts, and the habit of fixing problems quickly.</p>
            </>
          }
        />
      </section>

      {/* Responsible AI + Content Ownership */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Uso responsable de la tecnología" en="Responsible use of technology" />
          <BiSection
            es={
              <>
                <p>Usamos herramientas de IA en nuestro proceso de desarrollo para generar código, tests, documentación y revisión de lógica.</p>
                <p>Lo que <strong>no</strong> hacemos: usar IA para generar contenido de libros, modificar textos de autores, o tomar decisiones de moderación sin revisión humana.</p>
                <p>El contenido de la plataforma es responsabilidad humana — de autores, del equipo editorial de Noetia, y del equipo de producto.</p>
                <p><strong>Propiedad de contenido:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Los autores conservan todos los derechos sobre su contenido</li>
                  <li>Noetia recibe una licencia limitada para distribuir el contenido en la plataforma</li>
                  <li>Los fragmentos generados por usuarios pertenecen al lector como cita — no como reproducción del texto completo</li>
                  <li>El contenido de dominio público está claramente identificado como tal</li>
                </ul>
              </>
            }
            en={
              <>
                <p>We use AI tools in our development process to generate code, tests, documentation, and logic review.</p>
                <p>What we do <strong>not</strong> do: use AI to generate book content, modify author texts, or make moderation decisions without human review.</p>
                <p>Platform content is a human responsibility — of authors, Noetia&apos;s editorial team, and the product team.</p>
                <p><strong>Content ownership:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Authors retain all rights to their content</li>
                  <li>Noetia receives a limited license to distribute content on the platform</li>
                  <li>Fragments generated by users belong to the reader as quotations — not full-text reproduction</li>
                  <li>Public domain content is clearly identified as such</li>
                </ul>
              </>
            }
          />
        </div>
      </section>

      {/* Bottom nav */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link href="/legal/privacy" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Legal</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Política de privacidad →</p>
          </Link>
          <Link href="/legal/terms" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Legal</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Términos de uso →</p>
          </Link>
          <Link href="/contact" className="group border border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Contacto legal</p>
            <p className="font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">legal@noetia.app →</p>
          </Link>
        </div>
      </section>

    </main>
  );
}
