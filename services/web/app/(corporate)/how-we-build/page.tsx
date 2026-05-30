import type { Metadata } from 'next';
import Link from 'next/link';
import { BiSection, SectionLabel, SectionTitle } from '../_components';

export const metadata: Metadata = {
  title: 'How we build — Noetia',
  description: 'How Noetia plans, builds, and ships — product management, Agile delivery, DevOps, AI-assisted workflows, and the discipline of building a new category.',
  openGraph: { title: 'How we build — Noetia', description: 'Building a category requires more than features. Here is how we work.' },
};

const PHILOSOPHY = [
  {
    es: { title: 'Gestión de producto estructurada', body: 'Cada funcionalidad comienza con una decisión de prioridad explícita basada en impacto para el lector, viabilidad técnica y alineación con la estrategia del producto. No construimos cosas porque son interesantes — las construimos porque resuelven un problema real para un usuario real.' },
    en: { title: 'Structured product management', body: 'Every feature starts with an explicit priority decision based on reader impact, technical feasibility, and product strategy alignment. We do not build things because they are interesting — we build them because they solve a real problem for a real user.' },
  },
  {
    es: { title: 'Planificación ágil', body: 'Ciclos cortos con objetivos claros. El plan siempre existe, pero nunca es más importante que lo que aprendemos mientras construimos.' },
    en: { title: 'Agile planning', body: 'Short cycles with clear goals. The plan always exists, but it is never more important than what we learn while building.' },
  },
  {
    es: { title: 'Mejora continua', body: 'Después de cada ciclo revisamos qué funcionó, qué no, y qué cambiaría. Esto aplica tanto al producto como al proceso de construcción.' },
    en: { title: 'Continuous improvement', body: 'After each cycle we review what worked, what did not, and what we would change. This applies to both the product and the build process.' },
  },
  {
    es: { title: 'Prácticas modernas de DevOps', body: 'Deploy automático, tests automáticos, monitoreo continuo. El software que no se puede desplegar con confianza no está terminado.' },
    en: { title: 'Modern DevOps practices', body: 'Automatic deployment, automated tests, continuous monitoring. Software that cannot be deployed with confidence is not finished.' },
  },
  {
    es: { title: 'Diseño centrado en el usuario', body: 'La experiencia del lector guía cada decisión de diseño. Cuando hay dudas, la respuesta siempre empieza por "¿qué necesita el usuario?".' },
    en: { title: 'User-centered design', body: 'The reader experience guides every design decision. When in doubt, the answer always starts with "what does the user need?".' },
  },
  {
    es: { title: 'Flujos de trabajo asistidos por IA', body: 'Usamos herramientas de IA para acelerar prototipos, documentación, generación de tests y revisión de código. La IA no reemplaza el criterio de ingeniería — amplifica la capacidad del equipo.' },
    en: { title: 'AI-assisted workflows', body: 'We use AI tools to accelerate prototyping, documentation, test generation, and code review. AI does not replace engineering judgment — it amplifies the team\'s capacity.' },
  },
];

const TEAMS = [
  {
    es: { name: 'Gestión de producto', desc: 'Define prioridades, escribe especificaciones, coordina entre áreas y mantiene la visión del producto coherente. Es el punto de conexión entre lo que los usuarios necesitan y lo que el equipo construye.' },
    en: { name: 'Product management', desc: 'Defines priorities, writes specifications, coordinates across areas, and keeps the product vision coherent. It is the connection point between what users need and what the team builds.' },
    icon: '🎯',
  },
  {
    es: { name: 'Ingeniería backend', desc: 'Diseña y mantiene la API, la lógica de negocio, los sistemas de sincronización texto-audio, la autenticación, las suscripciones y la integración con servicios externos.' },
    en: { name: 'Backend engineering', desc: 'Designs and maintains the API, business logic, text-audio synchronization systems, authentication, subscriptions, and integration with external services.' },
    icon: '⚙️',
  },
  {
    es: { name: 'Ingeniería frontend (web y móvil)', desc: 'Construye la interfaz del lector, el portal de autores, la experiencia móvil y todas las superficies que los usuarios tocan directamente. Prioriza velocidad, accesibilidad y coherencia.' },
    en: { name: 'Frontend engineering (web and mobile)', desc: 'Builds the reader interface, author portal, mobile experience, and all surfaces users interact with directly. Prioritizes speed, accessibility, and consistency.' },
    icon: '🖥️',
  },
  {
    es: { name: 'DevOps e infraestructura', desc: 'Gestiona el ciclo de vida del deploy, los pipelines de CI/CD, el monitoreo, la gestión de secretos y la seguridad operacional de la plataforma en producción.' },
    en: { name: 'DevOps and infrastructure', desc: 'Manages the deployment lifecycle, CI/CD pipelines, monitoring, secrets management, and operational security of the production platform.' },
    icon: '🔧',
  },
  {
    es: { name: 'Contenido y alianzas editoriales', desc: 'Coordina con autores y editoriales, supervisa el proceso de ingesta de libros, revisa la calidad de sincronización texto-audio y mantiene relaciones con socios de contenido.' },
    en: { name: 'Content and publishing partnerships', desc: 'Coordinates with authors and publishers, oversees the book ingestion process, reviews text-audio synchronization quality, and maintains relationships with content partners.' },
    icon: '📚',
  },
];

const LIFECYCLE = [
  { phase_es: 'Descubrimiento', phase_en: 'Discovery', desc_es: 'Identificamos el problema, validamos con usuarios y definimos el alcance antes de escribir una línea de código.', desc_en: 'We identify the problem, validate with users, and define scope before writing a line of code.' },
  { phase_es: 'Planificación', phase_en: 'Planning', desc_es: 'Escribimos especificaciones técnicas y funcionales. Estimamos el esfuerzo. Decidimos qué entra en el ciclo.', desc_en: 'We write technical and functional specs. We estimate effort. We decide what enters the cycle.' },
  { phase_es: 'Priorización', phase_en: 'Prioritization', desc_es: 'Todo compite. Priorizamos por impacto para el lector, viabilidad técnica y urgencia estratégica.', desc_en: 'Everything competes. We prioritize by reader impact, technical feasibility, and strategic urgency.' },
  { phase_es: 'Desarrollo', phase_en: 'Development', desc_es: 'Ciclos cortos con objetivos claros. El código se revisa antes de mergear.', desc_en: 'Short cycles with clear goals. Code is reviewed before merging.' },
  { phase_es: 'Testing', phase_en: 'Testing', desc_es: 'Tests unitarios obligatorios (umbral 80% de cobertura). Tests de integración para flujos críticos. Verificación manual antes de deploy.', desc_en: 'Mandatory unit tests (80% coverage threshold). Integration tests for critical flows. Manual verification before deploy.' },
  { phase_es: 'Deploy', phase_en: 'Deployment', desc_es: 'GitHub Actions despliega automáticamente en cada push a main. El servidor corre migrations pendientes en cada deploy.', desc_en: 'GitHub Actions deploys automatically on every push to main. The server runs pending migrations on each deploy.' },
  { phase_es: 'Feedback', phase_en: 'Feedback loops', desc_es: 'Monitoreo continuo con Grafana + Prometheus. Alertas sobre errores y latencia. Revisión periódica de comportamiento real del usuario.', desc_en: 'Continuous monitoring with Grafana + Prometheus. Alerts on errors and latency. Periodic review of real user behavior.' },
  { phase_es: 'Mejora continua', phase_en: 'Continuous improvement', desc_es: 'Lo que aprendemos cambia el siguiente ciclo. El producto evoluciona a partir de evidencia, no de suposiciones.', desc_en: 'What we learn changes the next cycle. The product evolves from evidence, not assumptions.' },
];

const STACK = [
  { label: 'Backend', value: 'NestJS (Node.js + TypeScript)' },
  { label: 'Web', value: 'Next.js 14 (React)' },
  { label: 'Mobile', value: 'React Native (iOS + Android)' },
  { label: 'Base de datos', value: 'PostgreSQL 16 + Redis 7' },
  { label: 'Storage', value: 'MinIO (S3-compatible)' },
  { label: 'Búsqueda', value: 'Meilisearch' },
  { label: 'Infra', value: 'Docker + Traefik + Contabo VPS' },
  { label: 'CI/CD', value: 'GitHub Actions — deploy automático en main' },
  { label: 'Monitoreo', value: 'Grafana + Prometheus' },
  { label: 'Generación de imágenes', value: 'Python + Pillow (quote cards)' },
];

export default function HowWeBuildPage() {
  return (
    <main>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-b border-gray-100">
        <SectionLabel>Cómo construimos · How we build</SectionLabel>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0D1B2A] leading-tight mb-3">
          Construir una categoría es diferente<br />a construir un producto.
        </h1>
        <p className="text-xl text-gray-400 font-light mb-6">
          Building a category is different from building a product.
        </p>
        <p className="text-[#0D1B2A] font-medium max-w-2xl">
          Los productos satisfacen demanda existente. Las categorías crean demanda que todavía no sabe que existe. Eso cambia cómo tomamos decisiones, priorizamos funcionalidades y medimos el progreso.
        </p>
        <p className="text-gray-400 text-sm mt-2 max-w-2xl italic">
          Products satisfy existing demand. Categories create demand that does not yet know it exists. That changes how we make decisions, prioritize features, and measure progress.
        </p>
      </section>

      {/* Development Philosophy */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Filosofía de desarrollo" en="Development philosophy" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PHILOSOPHY.map(({ es, en }) => (
              <div key={es.title} className="bg-white border border-gray-100 rounded-xl p-6">
                <h3 className="font-bold text-[#0D1B2A] mb-1 text-sm">{es.title}</h3>
                <p className="text-gray-400 text-xs italic mb-3">{en.title}</p>
                <p className="text-gray-700 text-sm leading-relaxed">{es.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-functional collaboration */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Colaboración multidisciplinar" en="Cross-functional collaboration" />
        <p className="text-gray-600 text-sm mb-8 max-w-2xl">
          Noetia opera como un equipo pequeño y multidisciplinar. La colaboración entre estas áreas ocurre de forma continua — no en silos. El feedback circula en ambas direcciones y en tiempo real.
        </p>
        <div className="space-y-4">
          {TEAMS.map(({ es, en, icon }) => (
            <div key={es.name} className="flex gap-4 items-start border border-gray-100 rounded-xl p-5">
              <span className="text-2xl shrink-0">{icon}</span>
              <div>
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3 className="font-bold text-[#0D1B2A] text-sm">{es.name}</h3>
                  <span className="text-gray-400 text-xs italic">{en.name}</span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{es.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Product Lifecycle */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
          <SectionTitle es="Ciclo de vida del producto" en="Product lifecycle" />
          <div className="space-y-0">
            {LIFECYCLE.map(({ phase_es, phase_en, desc_es, desc_en }, i) => (
              <div key={phase_es} className="grid grid-cols-12 gap-4 items-start py-5 border-b border-gray-200 last:border-0">
                <div className="col-span-1 flex flex-col items-center pt-0.5">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                </div>
                <div className="col-span-11 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <p className="font-bold text-[#0D1B2A] text-sm mb-1">{phase_es}</p>
                    <p className="text-gray-700 text-sm leading-relaxed">{desc_es}</p>
                  </div>
                  <div className="lg:pl-4 lg:border-l lg:border-gray-200">
                    <p className="font-medium text-gray-400 text-sm mb-1 italic">{phase_en}</p>
                    <p className="text-gray-400 text-sm leading-relaxed italic">{desc_en}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-b border-gray-100">
        <SectionTitle es="Tecnología y operaciones" en="Technology and operations" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {STACK.map(({ label, value }) => (
            <div key={label} className="flex gap-3 py-3 border-b border-gray-50 items-start">
              <span className="text-xs font-semibold text-gray-400 w-32 shrink-0 pt-0.5">{label}</span>
              <span className="text-sm text-[#0D1B2A] font-medium">{value}</span>
            </div>
          ))}
        </div>

        <BiSection
          es={
            <>
              <p>Noetia corre en infraestructura propia — un servidor dedicado con Docker, Traefik como proxy inverso, y certificados SSL automáticos vía Let&apos;s Encrypt.</p>
              <p><strong>IA en nuestro flujo de trabajo:</strong> usamos herramientas de IA como acelerador de productividad — para generar borradores de código, escribir tests, revisar lógica y documentar decisiones de arquitectura. Todo output de IA pasa por revisión humana antes de entrar al repositorio. La IA acelera el trabajo; el equipo mantiene el criterio.</p>
            </>
          }
          en={
            <>
              <p>Noetia runs on its own infrastructure — a dedicated server with Docker, Traefik as a reverse proxy, and automatic SSL certificates via Let&apos;s Encrypt.</p>
              <p><strong>AI in our workflow:</strong> we use AI tools as a productivity accelerator — to generate code drafts, write tests, review logic, and document architecture decisions. All AI output goes through human review before entering the repository. AI accelerates the work; the team maintains the judgment.</p>
            </>
          }
        />
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link href="/careers" className="group bg-[#0D1B2A] text-white rounded-xl p-8 hover:bg-gray-800 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Únete al equipo</p>
            <p className="text-xl font-bold">¿Quieres construir esto con nosotros? →</p>
            <p className="text-slate-400 text-sm mt-2 italic">Want to build this with us?</p>
          </Link>
          <Link href="/milestones" className="group border border-gray-200 rounded-xl p-8 hover:border-indigo-300 transition">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-3">Progreso</p>
            <p className="text-xl font-bold text-[#0D1B2A] group-hover:text-indigo-600 transition">Lo que hemos construido →</p>
            <p className="text-gray-400 text-sm mt-2 italic">What we have built</p>
          </Link>
        </div>
      </section>

    </main>
  );
}
