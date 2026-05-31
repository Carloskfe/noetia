'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { BiSection, LangText, SectionLabel, SectionTitle } from '../_components';

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
  { es: 'Eliminar tu cuenta en cualquier momento — eliminación real, no desactivación', en: 'Delete your account at any time — real deletion, not deactivation' },
  { es: 'Controlar qué datos son visibles para otros (progreso, biblioteca, perfil, fragmentos)', en: 'Control which data is visible to others (progress, library, profile, fragments)' },
  { es: 'Exportar tus fragmentos en cualquier momento', en: 'Export your fragments at any time' },
  { es: 'Cambiar tu idioma sin perder ningún dato', en: 'Change your language without losing any data' },
  { es: 'Leer en modo privado sin compartir fragmentos automáticamente', en: 'Read in private mode without sharing fragments automatically' },
];

export default function TrustContent() {
  const { language } = useTranslation();
  const l = language;

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{l === 'es' ? 'Privacidad, Seguridad y Confianza' : 'Privacy, Security & Trust'}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-6">
          <LangText es="Tu identidad intelectual es tuya." en="Your intellectual identity is yours." />
        </h1>
        <p className="text-gray-700 text-[15px] max-w-2xl">
          <LangText
            es="Los libros que lees, los pasajes que resaltas, las ideas que te definen — son tuyos. Noetia los hace visibles cuando tú lo decides, en la medida que tú decides."
            en="The books you read, the passages you highlight, the ideas that define you — they are yours. Noetia makes them visible when you decide, to the extent you decide."
          />
        </p>
        <p className="text-[#0D1B2A] font-semibold text-sm mt-4">
          <LangText es="Eso no es marketing. Es el diseño de la plataforma." en="That is not marketing. It is the design of the platform." />
        </p>
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
                <p>Los datos de lectura nunca se comparten con autores ni editoriales de forma individual. Los autores solo ven métricas agregadas y anónimas.</p>
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
                <p>Reading data is never shared with authors or publishers on an individual basis. Authors only see aggregated, anonymous metrics.</p>
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
            <div key={es} className="py-3 border-b border-gray-100 last:border-0">
              <p className="text-[#0D1B2A] text-sm">✓ {l === 'es' ? es : en}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Your Control */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Tu control sobre tu identidad intelectual" en="Your control over your intellectual identity" />
          <p className="text-gray-600 text-sm mb-6">
            <LangText
              es="Noetia está construida para que tú controles exactamente qué de tu identidad intelectual es visible — y para quién."
              en="Noetia is built so that you control exactly which of your intellectual identity is visible — and to whom."
            />
          </p>
          <div className="space-y-0">
            {CONTROLS.map(({ es, en }) => (
              <div key={es} className="py-3 border-b border-gray-100 last:border-0">
                <p className="text-[#0D1B2A] text-sm">→ {l === 'es' ? es : en}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reliability + AI */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Confiabilidad y uso responsable de la tecnología" en="Reliability and responsible use of technology" />
        <BiSection
          es={
            <>
              <p>Noetia corre en infraestructura dedicada con monitoreo continuo. Usamos Grafana + Prometheus para vigilar latencia, errores y salud de cada servicio. Monitoreo activo, alertas configuradas y el hábito de resolver problemas rápido.</p>
              <p>Usamos herramientas de IA en nuestro proceso de desarrollo. Lo que <strong>no</strong> hacemos: usar IA para generar contenido de libros, modificar textos de autores, o tomar decisiones de moderación sin revisión humana. El contenido de la plataforma es responsabilidad humana.</p>
              <p><strong>Propiedad de contenido:</strong> los autores conservan todos los derechos. Noetia recibe una licencia limitada para distribuir. Los fragmentos pertenecen al lector como cita, no como reproducción del texto completo.</p>
            </>
          }
          en={
            <>
              <p>Noetia runs on dedicated infrastructure with continuous monitoring. We use Grafana + Prometheus to watch latency, errors, and health of each service. Active monitoring, configured alerts, and the habit of fixing problems quickly.</p>
              <p>We use AI tools in our development process. What we do <strong>not</strong> do: use AI to generate book content, modify author texts, or make moderation decisions without human review. Platform content is a human responsibility.</p>
              <p><strong>Content ownership:</strong> authors retain all rights. Noetia receives a limited license to distribute. Fragments belong to the reader as quotations — not as full-text reproduction.</p>
            </>
          }
        />
      </section>

      {/* Bottom nav */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { href: '/legal/privacy', label_es: 'Legal', cta_es: 'Política de privacidad →', label_en: 'Legal', cta_en: 'Privacy policy →' },
            { href: '/legal/terms', label_es: 'Legal', cta_es: 'Términos de uso →', label_en: 'Legal', cta_en: 'Terms of use →' },
            { href: '/contact', label_es: 'Contacto legal', cta_es: 'legal@noetia.app →', label_en: 'Legal contact', cta_en: 'legal@noetia.app →' },
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
