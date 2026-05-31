'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { BiSection, LangText, SectionLabel, SectionTitle } from '../_components';

const PHILOSOPHY = [
  { es: { title: 'Gestión de producto estructurada', body: 'Cada funcionalidad comienza con una decisión de prioridad explícita basada en impacto para el lector, viabilidad técnica y alineación estratégica. No construimos cosas porque son interesantes.' }, en: { title: 'Structured product management', body: 'Every feature starts with an explicit priority decision based on reader impact, technical feasibility, and strategic alignment. We do not build things because they are interesting.' } },
  { es: { title: 'Planificación ágil', body: 'Ciclos cortos con objetivos claros. El plan siempre existe, pero nunca es más importante que lo que aprendemos mientras construimos.' }, en: { title: 'Agile planning', body: 'Short cycles with clear goals. The plan always exists, but it is never more important than what we learn while building.' } },
  { es: { title: 'Mejora continua', body: 'Después de cada ciclo revisamos qué funcionó, qué no, y qué cambiaría. Esto aplica tanto al producto como al proceso de construcción.' }, en: { title: 'Continuous improvement', body: 'After each cycle we review what worked, what did not, and what we would change. This applies to both the product and the build process.' } },
  { es: { title: 'Prácticas modernas de DevOps', body: 'Deploy automático, tests automáticos, monitoreo continuo. El software que no se puede desplegar con confianza no está terminado.' }, en: { title: 'Modern DevOps practices', body: 'Automatic deployment, automated tests, continuous monitoring. Software that cannot be deployed with confidence is not finished.' } },
  { es: { title: 'Diseño centrado en el usuario', body: 'La experiencia del lector guía cada decisión de diseño. Cuando hay dudas, la respuesta siempre empieza por "¿qué necesita el usuario?".' }, en: { title: 'User-centered design', body: 'The reader experience guides every design decision. When in doubt, the answer always starts with "what does the user need?".' } },
  { es: { title: 'Flujos de trabajo asistidos por IA', body: 'Usamos herramientas de IA para acelerar prototipos, documentación, tests y revisión de código. La IA amplifica la capacidad del equipo — no reemplaza el criterio.' }, en: { title: 'AI-assisted workflows', body: 'We use AI tools to accelerate prototyping, documentation, tests, and code review. AI amplifies the team\'s capacity — it does not replace judgment.' } },
];

const TEAMS = [
  { icon: '🎯', es: { name: 'Gestión de producto', desc: 'Define prioridades, escribe especificaciones, coordina entre áreas y mantiene la visión del producto coherente.' }, en: { name: 'Product management', desc: 'Defines priorities, writes specifications, coordinates across areas, and keeps the product vision coherent.' } },
  { icon: '⚙️', es: { name: 'Ingeniería backend', desc: 'API, sincronización texto-audio, autenticación, suscripciones e integraciones con servicios externos.' }, en: { name: 'Backend engineering', desc: 'API, text-audio synchronization, authentication, subscriptions, and integrations with external services.' } },
  { icon: '🖥️', es: { name: 'Ingeniería frontend (web y móvil)', desc: 'Interfaz del lector, portal de autores, experiencia móvil. Velocidad, accesibilidad y coherencia entre plataformas.' }, en: { name: 'Frontend engineering (web and mobile)', desc: 'Reader interface, author portal, mobile experience. Speed, accessibility, and cross-platform consistency.' } },
  { icon: '🔧', es: { name: 'DevOps e infraestructura', desc: 'Ciclo de vida del deploy, CI/CD, monitoreo, gestión de secretos y seguridad operacional en producción.' }, en: { name: 'DevOps and infrastructure', desc: 'Deployment lifecycle, CI/CD, monitoring, secrets management, and operational security in production.' } },
  { icon: '📚', es: { name: 'Contenido y alianzas editoriales', desc: 'Coordina con autores y editoriales, supervisa la ingesta de libros y revisa la calidad de sincronización.' }, en: { name: 'Content and publishing partnerships', desc: 'Coordinates with authors and publishers, oversees book ingestion, and reviews synchronization quality.' } },
];

const LIFECYCLE = [
  { es: { phase: 'Descubrimiento', desc: 'Identificamos el problema, validamos con usuarios y definimos el alcance antes de escribir una línea de código.' }, en: { phase: 'Discovery', desc: 'We identify the problem, validate with users, and define scope before writing a line of code.' } },
  { es: { phase: 'Planificación', desc: 'Especificaciones técnicas y funcionales. Estimamos el esfuerzo. Decidimos qué entra en el ciclo.' }, en: { phase: 'Planning', desc: 'Technical and functional specs. We estimate effort. We decide what enters the cycle.' } },
  { es: { phase: 'Priorización', desc: 'Todo compite. Priorizamos por impacto para el lector, viabilidad técnica y urgencia estratégica.' }, en: { phase: 'Prioritization', desc: 'Everything competes. We prioritize by reader impact, technical feasibility, and strategic urgency.' } },
  { es: { phase: 'Desarrollo', desc: 'Ciclos cortos con objetivos claros. El código se revisa antes de mergear.' }, en: { phase: 'Development', desc: 'Short cycles with clear goals. Code is reviewed before merging.' } },
  { es: { phase: 'Testing', desc: 'Tests unitarios obligatorios (80% de cobertura). Tests de integración para flujos críticos. Verificación manual antes de deploy.' }, en: { phase: 'Testing', desc: 'Mandatory unit tests (80% coverage). Integration tests for critical flows. Manual verification before deploy.' } },
  { es: { phase: 'Deploy', desc: 'GitHub Actions despliega automáticamente en cada push a main. Las migrations corren en cada deploy.' }, en: { phase: 'Deployment', desc: 'GitHub Actions deploys automatically on every push to main. Migrations run on each deploy.' } },
  { es: { phase: 'Feedback', desc: 'Monitoreo continuo con Grafana + Prometheus. Alertas sobre errores y latencia.' }, en: { phase: 'Feedback loops', desc: 'Continuous monitoring with Grafana + Prometheus. Alerts on errors and latency.' } },
  { es: { phase: 'Mejora continua', desc: 'Lo que aprendemos cambia el siguiente ciclo. El producto evoluciona a partir de evidencia, no de suposiciones.' }, en: { phase: 'Continuous improvement', desc: 'What we learn changes the next cycle. The product evolves from evidence, not assumptions.' } },
];

const STACK = [
  { label: 'Backend', value: 'NestJS (Node.js + TypeScript)' },
  { label: 'Web', value: 'Next.js 14 (React)' },
  { label: 'Mobile', value: 'React Native (iOS + Android)' },
  { label: 'Database', value: 'PostgreSQL 16 + Redis 7' },
  { label: 'Storage', value: 'MinIO (S3-compatible)' },
  { label: 'Search', value: 'Meilisearch' },
  { label: 'Infra', value: 'Docker + Traefik + Contabo VPS' },
  { label: 'CI/CD', value: 'GitHub Actions — auto-deploy on main' },
  { label: 'Monitoring', value: 'Grafana + Prometheus' },
  { label: 'Image gen', value: 'Python + Pillow (quote cards)' },
];

export default function HowWeBuildContent() {
  const { language } = useTranslation();
  const l = language;

  return (
    <main>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>{l === 'es' ? 'Cómo construimos' : 'How we build'}</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-3">
          <LangText
            es="Construir una categoría es diferente a construir un producto."
            en="Building a category is different from building a product."
          />
        </h1>
        <p className="text-gray-700 text-[15px] max-w-2xl mt-4">
          <LangText
            es="Los productos satisfacen demanda existente. Las categorías crean demanda que todavía no sabe que existe. Eso cambia cómo tomamos decisiones, priorizamos funcionalidades y medimos el progreso."
            en="Products satisfy existing demand. Categories create demand that does not yet know it exists. That changes how we make decisions, prioritize features, and measure progress."
          />
        </p>
      </section>

      {/* Philosophy */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Filosofía de desarrollo" en="Development philosophy" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PHILOSOPHY.map(({ es, en }) => {
              const p = l === 'es' ? es : en;
              return (
                <div key={p.title} className="bg-white border border-gray-100 rounded-xl p-6">
                  <h3 className="font-bold text-[#0D1B2A] mb-3 text-sm">{p.title}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{p.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Cross-functional */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Colaboración multidisciplinar" en="Cross-functional collaboration" />
        <p className="text-gray-600 text-sm mb-8 max-w-2xl">
          <LangText
            es="Noetia opera como un equipo pequeño y multidisciplinar. El feedback circula en ambas direcciones y en tiempo real — no en silos."
            en="Noetia operates as a small, multidisciplinary team. Feedback flows in both directions in real time — not in siloed phases."
          />
        </p>
        <div className="space-y-4">
          {TEAMS.map(({ icon, es, en }) => {
            const t = l === 'es' ? es : en;
            return (
              <div key={t.name} className="flex gap-4 items-start border border-gray-100 rounded-xl p-5">
                <span className="text-2xl shrink-0">{icon}</span>
                <div>
                  <h3 className="font-bold text-[#0D1B2A] text-sm mb-1">{t.name}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{t.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lifecycle */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Ciclo de vida del producto" en="Product lifecycle" />
          <div className="space-y-0">
            {LIFECYCLE.map(({ es, en }, i) => {
              const item = l === 'es' ? es : en;
              return (
                <div key={item.phase} className="grid grid-cols-12 gap-4 items-start py-5 border-b border-gray-200 last:border-0">
                  <div className="col-span-1">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                  </div>
                  <div className="col-span-11">
                    <p className="font-bold text-[#0D1B2A] text-sm mb-1">{item.phase}</p>
                    <p className="text-gray-700 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Tecnología y operaciones" en="Technology and operations" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {STACK.map(({ label, value }) => (
            <div key={label} className="flex gap-3 py-3 border-b border-gray-50 items-start">
              <span className="text-xs font-semibold text-gray-400 w-28 shrink-0">{label}</span>
              <span className="text-sm text-[#0D1B2A] font-medium">{value}</span>
            </div>
          ))}
        </div>
        <BiSection
          es={
            <>
              <p>Noetia corre en infraestructura propia — un servidor dedicado con Docker, Traefik y certificados SSL automáticos vía Let&apos;s Encrypt.</p>
              <p><strong>IA en nuestro flujo de trabajo:</strong> usamos herramientas de IA como acelerador de productividad. Todo output pasa por revisión humana antes de entrar al repositorio. La IA acelera el trabajo; el equipo mantiene el criterio.</p>
            </>
          }
          en={
            <>
              <p>Noetia runs on its own infrastructure — a dedicated server with Docker, Traefik, and automatic SSL certificates via Let&apos;s Encrypt.</p>
              <p><strong>AI in our workflow:</strong> we use AI tools as a productivity accelerator. All output goes through human review before entering the repository. AI accelerates the work; the team maintains the judgment.</p>
            </>
          }
        />
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/careers" className="bg-[#0D1B2A] text-white rounded-xl p-8 hover:bg-gray-800 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">{l === 'es' ? 'Únete' : 'Join us'}</p>
            <p className="text-xl font-bold"><LangText es="¿Quieres construir esto con nosotros? →" en="Want to build this with us? →" /></p>
          </Link>
          <Link href="/milestones" className="border border-gray-200 rounded-xl p-8 hover:border-indigo-300 transition group">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-3">{l === 'es' ? 'Progreso' : 'Progress'}</p>
            <p className="text-xl font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition"><LangText es="Lo que hemos construido →" en="What we have built →" /></p>
          </Link>
        </div>
      </section>
    </main>
  );
}
