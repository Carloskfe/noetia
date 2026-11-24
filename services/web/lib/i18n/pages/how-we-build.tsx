import React from 'react';
import type { Localized } from './types';

// /how-we-build page dictionary (NEM-025 B1-A). ES/EN moved verbatim; fr-CA DRAFT pending review.
// The technology stack table is shared by all languages (product and tool names), as before.
export const STACK = [
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

export interface HowWeBuildCopy {
  label: string;
  heroTitle: string;
  heroBody: string;
  philosophyTitle: string;
  philosophy: { title: string; body: string }[];
  teamsTitle: string;
  teamsIntro: string;
  teams: { icon: string; name: string; desc: string }[];
  lifecycleTitle: string;
  lifecycle: { phase: string; desc: string }[];
  stackTitle: string;
  stackBody: React.ReactNode;
  joinLabel: string;
  joinCta: string;
  progressLabel: string;
  progressCta: string;
}

const es: HowWeBuildCopy = {
  label: 'Cómo construimos',
  heroTitle: 'Construir una categoría es diferente a construir un producto.',
  heroBody: 'Los productos satisfacen demanda existente. Las categorías crean demanda que todavía no sabe que existe. Eso cambia cómo tomamos decisiones, priorizamos funcionalidades y medimos el progreso.',
  philosophyTitle: 'Filosofía de desarrollo',
  philosophy: [
    { title: 'Gestión de producto estructurada', body: 'Cada funcionalidad comienza con una decisión de prioridad explícita basada en impacto para el lector, viabilidad técnica y alineación estratégica. No construimos cosas porque son interesantes.' },
    { title: 'Planificación ágil', body: 'Ciclos cortos con objetivos claros. El plan siempre existe, pero nunca es más importante que lo que aprendemos mientras construimos.' },
    { title: 'Mejora continua', body: 'Después de cada ciclo revisamos qué funcionó, qué no, y qué cambiaría. Esto aplica tanto al producto como al proceso de construcción.' },
    { title: 'Prácticas modernas de DevOps', body: 'Deploy automático, tests automáticos, monitoreo continuo. El software que no se puede desplegar con confianza no está terminado.' },
    { title: 'Diseño centrado en el usuario', body: 'La experiencia del lector guía cada decisión de diseño. Cuando hay dudas, la respuesta siempre empieza por "¿qué necesita el usuario?".' },
    { title: 'Flujos de trabajo asistidos por IA', body: 'Usamos herramientas de IA para acelerar prototipos, documentación, tests y revisión de código. La IA amplifica la capacidad del equipo — no reemplaza el criterio.' },
  ],
  teamsTitle: 'Colaboración multidisciplinar',
  teamsIntro: 'Noetia opera como un equipo pequeño y multidisciplinar. El feedback circula en ambas direcciones y en tiempo real — no en silos.',
  teams: [
    { icon: '🎯', name: 'Gestión de producto', desc: 'Define prioridades, escribe especificaciones, coordina entre áreas y mantiene la visión del producto coherente.' },
    { icon: '⚙️', name: 'Ingeniería backend', desc: 'API, sincronización texto-audio, autenticación, suscripciones e integraciones con servicios externos.' },
    { icon: '🖥️', name: 'Ingeniería frontend (web y móvil)', desc: 'Interfaz del lector, portal de autores, experiencia móvil. Velocidad, accesibilidad y coherencia entre plataformas.' },
    { icon: '🔧', name: 'DevOps e infraestructura', desc: 'Ciclo de vida del deploy, CI/CD, monitoreo, gestión de secretos y seguridad operacional en producción.' },
    { icon: '📚', name: 'Contenido y alianzas editoriales', desc: 'Coordina con autores y editoriales, supervisa la ingesta de libros y revisa la calidad de sincronización.' },
  ],
  lifecycleTitle: 'Ciclo de vida del producto',
  lifecycle: [
    { phase: 'Descubrimiento', desc: 'Identificamos el problema, validamos con usuarios y definimos el alcance antes de escribir una línea de código.' },
    { phase: 'Planificación', desc: 'Especificaciones técnicas y funcionales. Estimamos el esfuerzo. Decidimos qué entra en el ciclo.' },
    { phase: 'Priorización', desc: 'Todo compite. Priorizamos por impacto para el lector, viabilidad técnica y urgencia estratégica.' },
    { phase: 'Desarrollo', desc: 'Ciclos cortos con objetivos claros. El código se revisa antes de mergear.' },
    { phase: 'Testing', desc: 'Tests unitarios obligatorios (80% de cobertura). Tests de integración para flujos críticos. Verificación manual antes de deploy.' },
    { phase: 'Deploy', desc: 'GitHub Actions despliega automáticamente en cada push a main. Las migrations corren en cada deploy.' },
    { phase: 'Feedback', desc: 'Monitoreo continuo con Grafana + Prometheus. Alertas sobre errores y latencia.' },
    { phase: 'Mejora continua', desc: 'Lo que aprendemos cambia el siguiente ciclo. El producto evoluciona a partir de evidencia, no de suposiciones.' },
  ],
  stackTitle: 'Tecnología y operaciones',
  stackBody: (
    <>
      <p>Noetia corre en infraestructura propia — un servidor dedicado con Docker, Traefik y certificados SSL automáticos vía Let&apos;s Encrypt.</p>
      <p><strong>IA en nuestro flujo de trabajo:</strong> usamos herramientas de IA como acelerador de productividad. Todo output pasa por revisión humana antes de entrar al repositorio. La IA acelera el trabajo; el equipo mantiene el criterio.</p>
    </>
  ),
  joinLabel: 'Únete',
  joinCta: '¿Quieres construir esto con nosotros? →',
  progressLabel: 'Progreso',
  progressCta: 'Lo que hemos construido →',
};

const en: HowWeBuildCopy = {
  label: 'How we build',
  heroTitle: 'Building a category is different from building a product.',
  heroBody: 'Products satisfy existing demand. Categories create demand that does not yet know it exists. That changes how we make decisions, prioritize features, and measure progress.',
  philosophyTitle: 'Development philosophy',
  philosophy: [
    { title: 'Structured product management', body: 'Every feature starts with an explicit priority decision based on reader impact, technical feasibility, and strategic alignment. We do not build things because they are interesting.' },
    { title: 'Agile planning', body: 'Short cycles with clear goals. The plan always exists, but it is never more important than what we learn while building.' },
    { title: 'Continuous improvement', body: 'After each cycle we review what worked, what did not, and what we would change. This applies to both the product and the build process.' },
    { title: 'Modern DevOps practices', body: 'Automatic deployment, automated tests, continuous monitoring. Software that cannot be deployed with confidence is not finished.' },
    { title: 'User-centered design', body: 'The reader experience guides every design decision. When in doubt, the answer always starts with "what does the user need?".' },
    { title: 'AI-assisted workflows', body: "We use AI tools to accelerate prototyping, documentation, tests, and code review. AI amplifies the team's capacity — it does not replace judgment." },
  ],
  teamsTitle: 'Cross-functional collaboration',
  teamsIntro: 'Noetia operates as a small, multidisciplinary team. Feedback flows in both directions in real time — not in siloed phases.',
  teams: [
    { icon: '🎯', name: 'Product management', desc: 'Defines priorities, writes specifications, coordinates across areas, and keeps the product vision coherent.' },
    { icon: '⚙️', name: 'Backend engineering', desc: 'API, text-audio synchronization, authentication, subscriptions, and integrations with external services.' },
    { icon: '🖥️', name: 'Frontend engineering (web and mobile)', desc: 'Reader interface, author portal, mobile experience. Speed, accessibility, and cross-platform consistency.' },
    { icon: '🔧', name: 'DevOps and infrastructure', desc: 'Deployment lifecycle, CI/CD, monitoring, secrets management, and operational security in production.' },
    { icon: '📚', name: 'Content and publishing partnerships', desc: 'Coordinates with authors and publishers, oversees book ingestion, and reviews synchronization quality.' },
  ],
  lifecycleTitle: 'Product lifecycle',
  lifecycle: [
    { phase: 'Discovery', desc: 'We identify the problem, validate with users, and define scope before writing a line of code.' },
    { phase: 'Planning', desc: 'Technical and functional specs. We estimate effort. We decide what enters the cycle.' },
    { phase: 'Prioritization', desc: 'Everything competes. We prioritize by reader impact, technical feasibility, and strategic urgency.' },
    { phase: 'Development', desc: 'Short cycles with clear goals. Code is reviewed before merging.' },
    { phase: 'Testing', desc: 'Mandatory unit tests (80% coverage). Integration tests for critical flows. Manual verification before deploy.' },
    { phase: 'Deployment', desc: 'GitHub Actions deploys automatically on every push to main. Migrations run on each deploy.' },
    { phase: 'Feedback loops', desc: 'Continuous monitoring with Grafana + Prometheus. Alerts on errors and latency.' },
    { phase: 'Continuous improvement', desc: 'What we learn changes the next cycle. The product evolves from evidence, not assumptions.' },
  ],
  stackTitle: 'Technology and operations',
  stackBody: (
    <>
      <p>Noetia runs on its own infrastructure — a dedicated server with Docker, Traefik, and automatic SSL certificates via Let&apos;s Encrypt.</p>
      <p><strong>AI in our workflow:</strong> we use AI tools as a productivity accelerator. All output goes through human review before entering the repository. AI accelerates the work; the team maintains the judgment.</p>
    </>
  ),
  joinLabel: 'Join us',
  joinCta: 'Want to build this with us? →',
  progressLabel: 'Progress',
  progressCta: 'What we have built →',
};

const frCA: HowWeBuildCopy = {
  label: 'Notre façon de bâtir',
  heroTitle: 'Bâtir une catégorie est différent de bâtir un produit.',
  heroBody: 'Les produits répondent à une demande existante. Les catégories créent une demande qui ne sait pas encore qu’elle existe. Cela change notre façon de prendre des décisions, de prioriser les fonctionnalités et de mesurer nos progrès.',
  philosophyTitle: 'Philosophie de développement',
  philosophy: [
    { title: 'Gestion de produit structurée', body: 'Chaque fonctionnalité commence par une décision de priorité explicite fondée sur l’impact pour le lecteur, la faisabilité technique et l’alignement stratégique. Nous ne bâtissons pas des choses parce qu’elles sont intéressantes.' },
    { title: 'Planification agile', body: 'Des cycles courts avec des objectifs clairs. Le plan existe toujours, mais il n’est jamais plus important que ce que nous apprenons en bâtissant.' },
    { title: 'Amélioration continue', body: 'Après chaque cycle, nous examinons ce qui a fonctionné, ce qui n’a pas fonctionné et ce que nous changerions. Cela s’applique autant au produit qu’au processus de développement.' },
    { title: 'Pratiques DevOps modernes', body: 'Déploiement automatique, tests automatisés, surveillance continue. Un logiciel qu’on ne peut pas déployer en toute confiance n’est pas terminé.' },
    { title: 'Conception centrée sur l’utilisateur', body: 'L’expérience du lecteur guide chaque décision de conception. En cas de doute, la réponse commence toujours par « de quoi l’utilisateur a-t-il besoin? ».' },
    { title: 'Méthodes de travail assistées par l’IA', body: 'Nous utilisons des outils d’IA pour accélérer le prototypage, la documentation, les tests et la revue de code. L’IA amplifie la capacité de l’équipe — elle ne remplace pas le jugement.' },
  ],
  teamsTitle: 'Collaboration multidisciplinaire',
  teamsIntro: 'Noetia fonctionne comme une petite équipe multidisciplinaire. La rétroaction circule dans les deux sens, en temps réel — pas en silos.',
  teams: [
    { icon: '🎯', name: 'Gestion de produit', desc: 'Définit les priorités, rédige les spécifications, coordonne les différents secteurs et assure la cohérence de la vision du produit.' },
    { icon: '⚙️', name: 'Ingénierie dorsale (backend)', desc: 'API, synchronisation texte-audio, authentification, abonnements et intégrations avec des services externes.' },
    { icon: '🖥️', name: 'Ingénierie frontale (Web et mobile)', desc: 'Interface de lecture, portail des auteurs, expérience mobile. Rapidité, accessibilité et cohérence entre les plateformes.' },
    { icon: '🔧', name: 'DevOps et infrastructure', desc: 'Cycle de vie des déploiements, CI/CD, surveillance, gestion des secrets et sécurité opérationnelle en production.' },
    { icon: '📚', name: 'Contenu et partenariats éditoriaux', desc: 'Assure la coordination avec les auteurs et les maisons d’édition, supervise l’intégration des livres et vérifie la qualité de la synchronisation.' },
  ],
  lifecycleTitle: 'Cycle de vie du produit',
  lifecycle: [
    { phase: 'Découverte', desc: 'Nous cernons le problème, le validons auprès des utilisateurs et définissons la portée avant d’écrire une seule ligne de code.' },
    { phase: 'Planification', desc: 'Spécifications techniques et fonctionnelles. Nous estimons l’effort. Nous décidons de ce qui entre dans le cycle.' },
    { phase: 'Priorisation', desc: 'Tout est en concurrence. Nous priorisons selon l’impact pour le lecteur, la faisabilité technique et l’urgence stratégique.' },
    { phase: 'Développement', desc: 'Des cycles courts avec des objectifs clairs. Le code est révisé avant d’être fusionné.' },
    { phase: 'Tests', desc: 'Tests unitaires obligatoires (couverture de 80 %). Tests d’intégration pour les parcours critiques. Vérification manuelle avant le déploiement.' },
    { phase: 'Déploiement', desc: 'GitHub Actions déploie automatiquement à chaque envoi (push) sur la branche main. Les migrations s’exécutent à chaque déploiement.' },
    { phase: 'Boucles de rétroaction', desc: 'Surveillance continue avec Grafana et Prometheus. Alertes en cas d’erreurs et de latence.' },
    { phase: 'Amélioration continue', desc: 'Ce que nous apprenons change le cycle suivant. Le produit évolue à partir de preuves, pas de suppositions.' },
  ],
  stackTitle: 'Technologie et exploitation',
  stackBody: (
    <>
      <p>Noetia fonctionne sur sa propre infrastructure — un serveur dédié avec Docker, Traefik et des certificats SSL automatiques par l’intermédiaire de Let&apos;s Encrypt.</p>
      <p><strong>L’IA dans notre façon de travailler :</strong> nous utilisons des outils d’IA pour accélérer la productivité. Tout résultat passe par une révision humaine avant d’entrer dans le dépôt. L’IA accélère le travail; l’équipe garde le jugement.</p>
    </>
  ),
  joinLabel: 'Joignez-vous à nous',
  joinCta: 'Vous voulez bâtir ce projet avec nous? →',
  progressLabel: 'Progrès',
  progressCta: 'Ce que nous avons bâti →',
};

export const howWeBuildCopy: Localized<HowWeBuildCopy> = { es, en, 'fr-CA': frCA };
