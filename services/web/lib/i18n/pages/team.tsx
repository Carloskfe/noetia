import React from 'react';
import type { Localized } from './types';

// /team page dictionary (NEM-025 B1-A). ES/EN moved verbatim; fr-CA DRAFT pending review.
export interface TeamCopy {
  label: string;
  heroTitle: string;
  heroBody: string;
  convictionLabel: string;
  conviction: React.ReactNode;
  rolesTitle: string;
  rolesIntro: string;
  roles: { icon: string; name: string; desc: string }[];
  leadershipTitle: string;
  leadershipSoon: string;
  joinLabel: string;
  joinCta: string;
  engineeringLabel: string;
  engineeringCta: string;
}

const es: TeamCopy = {
  label: 'Equipo',
  heroTitle: 'Un equipo pequeño con una convicción específica.',
  heroBody: 'Construimos para el tipo de persona que lee Las Meditaciones un martes por la noche porque genuinamente necesita pensar mejor. Ese respeto guía cada decisión de diseño.',
  convictionLabel: 'Lo que nos une',
  conviction: (
    <>
      <p>Lo que une al equipo no es un conjunto de habilidades. Es una convicción sobre lo que el conocimiento puede hacer cuando se expresa públicamente.</p>
      <p>Creemos que el conocimiento debería ser social. Que los libros deberían importar más de lo que importan hoy. Que la persona que leyó a Dostoievski, Marco Aurelio y Paulo Coelho en el último año debería tener alguna forma de que eso sea visible.</p>
    </>
  ),
  rolesTitle: 'Cómo trabajamos',
  rolesIntro: 'En un equipo pequeño, todos entienden el producto de punta a punta. Lo que construyes llega a usuarios reales en días, no meses.',
  roles: [
    { icon: '🎯', name: 'Producto', desc: 'Estrategia, priorización, especificaciones y coherencia de la visión. Conecta lo que los usuarios necesitan con lo que el equipo construye.' },
    { icon: '⚙️', name: 'Ingeniería backend', desc: 'API, sincronización texto-audio, suscripciones, autenticación e integraciones con servicios externos.' },
    { icon: '🖥️', name: 'Ingeniería frontend', desc: 'Web (Next.js), móvil (React Native). Velocidad, accesibilidad y coherencia entre plataformas.' },
    { icon: '🔧', name: 'Infraestructura', desc: 'DevOps, CI/CD, monitoreo, gestión de secretos y seguridad operacional de la plataforma en producción.' },
    { icon: '📚', name: 'Editorial', desc: 'Relaciones con autores, ingesta de contenido, control de calidad de sincronización y gestión del catálogo.' },
  ],
  leadershipTitle: 'Liderazgo',
  leadershipSoon: 'Los perfiles del equipo se publicarán próximamente.',
  joinLabel: 'Únete',
  joinCta: '¿Quieres trabajar aquí? →',
  engineeringLabel: 'Ingeniería',
  engineeringCta: 'Cómo construimos →',
};

const en: TeamCopy = {
  label: 'Team',
  heroTitle: 'A small team with a specific conviction.',
  heroBody: 'We build for the kind of person who reads Meditations on a Tuesday night because they genuinely need to think better. That respect guides every design decision.',
  convictionLabel: 'What unites us',
  conviction: (
    <>
      <p>What unites the team is not a set of skills. It is a conviction about what knowledge can do when it is expressed publicly.</p>
      <p>We believe knowledge should be social. That books should matter more than they do today. That the person who read Dostoevsky, Marcus Aurelius, and Paulo Coelho this year should have some way for that to be visible.</p>
    </>
  ),
  rolesTitle: 'How we work',
  rolesIntro: 'In a small team, everyone understands the product end to end. What you build reaches real users in days, not months.',
  roles: [
    { icon: '🎯', name: 'Product', desc: 'Strategy, prioritization, specifications, and vision coherence. Connects what users need with what the team builds.' },
    { icon: '⚙️', name: 'Backend engineering', desc: 'API, text-audio synchronization, subscriptions, authentication, and integrations with external services.' },
    { icon: '🖥️', name: 'Frontend engineering', desc: 'Web (Next.js), mobile (React Native). Speed, accessibility, and cross-platform consistency.' },
    { icon: '🔧', name: 'Infrastructure', desc: 'DevOps, CI/CD, monitoring, secrets management, and operational security of the production platform.' },
    { icon: '📚', name: 'Editorial', desc: 'Author relationships, content ingestion, synchronization quality control, and catalog management.' },
  ],
  leadershipTitle: 'Leadership',
  leadershipSoon: 'Leadership profiles coming soon.',
  joinLabel: 'Join us',
  joinCta: 'Want to work here? →',
  engineeringLabel: 'Engineering',
  engineeringCta: 'How we build →',
};

const frCA: TeamCopy = {
  label: 'Équipe',
  heroTitle: 'Une petite équipe avec une conviction précise.',
  heroBody: 'Nous bâtissons pour le genre de personne qui lit les Pensées pour moi-même un mardi soir parce qu’elle a réellement besoin de mieux penser. Ce respect guide chaque décision de conception.',
  convictionLabel: 'Ce qui nous unit',
  conviction: (
    <>
      <p>Ce qui unit l’équipe, ce n’est pas un ensemble de compétences. C’est une conviction sur ce que le savoir peut accomplir lorsqu’il est exprimé publiquement.</p>
      <p>Nous croyons que le savoir devrait être social. Que les livres devraient compter davantage qu’aujourd’hui. Que la personne qui a lu Dostoïevski, Marc Aurèle et Paulo Coelho cette année devrait avoir un moyen de le rendre visible.</p>
    </>
  ),
  rolesTitle: 'Notre façon de travailler',
  rolesIntro: 'Dans une petite équipe, tout le monde comprend le produit de bout en bout. Ce que vous bâtissez atteint de vrais utilisateurs en quelques jours, pas en quelques mois.',
  roles: [
    { icon: '🎯', name: 'Produit', desc: 'Stratégie, priorisation, spécifications et cohérence de la vision. Fait le lien entre les besoins des utilisateurs et ce que l’équipe bâtit.' },
    { icon: '⚙️', name: 'Ingénierie dorsale (backend)', desc: 'API, synchronisation texte-audio, abonnements, authentification et intégrations avec des services externes.' },
    { icon: '🖥️', name: 'Ingénierie frontale', desc: 'Web (Next.js), mobile (React Native). Rapidité, accessibilité et cohérence entre les plateformes.' },
    { icon: '🔧', name: 'Infrastructure', desc: 'DevOps, CI/CD, surveillance, gestion des secrets et sécurité opérationnelle de la plateforme en production.' },
    { icon: '📚', name: 'Édition', desc: 'Relations avec les auteurs, intégration du contenu, contrôle de la qualité de la synchronisation et gestion du catalogue.' },
  ],
  leadershipTitle: 'Direction',
  leadershipSoon: 'Les profils de l’équipe de direction seront publiés prochainement.',
  joinLabel: 'Joignez-vous à nous',
  joinCta: 'Vous voulez travailler ici? →',
  engineeringLabel: 'Ingénierie',
  engineeringCta: 'Notre façon de bâtir →',
};

export const teamCopy: Localized<TeamCopy> = { es, en, 'fr-CA': frCA };
