import type { Localized } from './types';

// /careers page dictionary (NEM-025 B1-A). ES/EN moved verbatim; fr-CA DRAFT pending review.
// The contact address stays equipo@noetia.app (address changes are a separate approved task, PR #75 E2).
export interface CareersCopy {
  label: string;
  heroTitle: string;
  heroBody: string;
  workTitle: string;
  work: { title: string; body: string }[];
  principlesTitle: string;
  principles: string[];
  positionsTitle: string;
  noPositions: string;
  noPositionsNote: string;
  communityTitle: string;
  communityBody: string;
  emailLead: string;
  emailTail: string;
  emailCta: string;
  teamLabel: string;
  teamCta: string;
  contactLabel: string;
  contactCta: string;
}

const es: CareersCopy = {
  label: 'Carreras',
  heroTitle: 'Si crees que el conocimiento debería ser social —',
  heroBody: 'que los libros deberían importar más de lo que importan hoy, y que construir la plataforma para eso es uno de los trabajos más interesantes disponibles ahora mismo — hablemos.',
  workTitle: 'Cómo es trabajar aquí',
  work: [
    { title: 'El problema importa', body: 'No estás optimizando el embudo de un producto existente. Estás construyendo la infraestructura de una categoría nueva.' },
    { title: 'Contexto completo', body: 'En un equipo pequeño, todos entienden el producto de punta a punta — no solo su parte.' },
    { title: 'Trabajo que se ve', body: 'Lo que construyes llega a usuarios reales en días, no meses.' },
    { title: 'Autonomía real', body: 'Si propones algo razonado, se considera. No hay capas de aprobación.' },
    { title: 'Herramientas modernas', body: 'Usamos lo que funciona — incluyendo flujos de trabajo asistidos por IA donde tiene sentido.' },
    { title: 'Estándares claros', body: 'Cobertura de tests, revisión de código, criterios de aceptación. No como burocracia — como respeto al trabajo del equipo.' },
  ],
  principlesTitle: 'Principios de trabajo',
  principles: [
    'Construimos para el lector que lee en serio, no para el usuario que quiere entretenimiento.',
    'Una categoría se construye con comportamientos repetidos, no con lanzamientos.',
    'El código sin tests no está terminado. El diseño sin propósito tampoco.',
    'Documentamos lo que decidimos y por qué — no solo el código.',
    'El error que se reporta rápido es un error que se repara rápido.',
    'Respetar el tiempo de los demás es parte del trabajo.',
  ],
  positionsTitle: 'Posiciones abiertas',
  noPositions: 'En este momento no tenemos posiciones abiertas.',
  noPositionsNote: 'Cuando las tengamos, aparecerán aquí primero.',
  communityTitle: 'Comunidad de talento',
  communityBody: 'Si quieres ser de las primeras personas en saber cuando abramos una posición, escríbenos. No usamos esta información para marketing — solo te contactaremos si hay algo relevante para ti.',
  emailLead: 'Envíanos un email a',
  emailTail: 'con tu nombre, área de interés y un mensaje breve sobre por qué te interesa Noetia.',
  emailCta: 'Escribir a equipo@noetia.app →',
  teamLabel: 'Equipo',
  teamCta: 'Conoce cómo trabajamos →',
  contactLabel: 'Contacto',
  contactCta: 'Hablar con el equipo →',
};

const en: CareersCopy = {
  label: 'Careers',
  heroTitle: 'If you believe knowledge should be social —',
  heroBody: "that books should matter more than they do today, and that building the platform for that is one of the most interesting jobs available right now — let's talk.",
  workTitle: 'What it is like to work here',
  work: [
    { title: 'The problem matters', body: 'You are not optimizing the funnel of an existing product. You are building the infrastructure of a new category.' },
    { title: 'Full context', body: 'In a small team, everyone understands the product end to end — not just their part.' },
    { title: 'Work you can see', body: 'What you build reaches real users in days, not months.' },
    { title: 'Real autonomy', body: 'If you propose something reasoned, it is considered. There are no approval layers.' },
    { title: 'Modern tools', body: 'We use what works — including AI-assisted workflows where it makes sense.' },
    { title: 'Clear standards', body: "Test coverage, code review, acceptance criteria. Not as bureaucracy — as respect for the team's work." },
  ],
  principlesTitle: 'Working principles',
  principles: [
    'We build for the reader who reads seriously, not for the user who wants entertainment.',
    'A category is built with repeated behaviors, not launches.',
    'Code without tests is not finished. Design without purpose either.',
    'We document what we decided and why — not just the code.',
    'An error reported quickly is an error fixed quickly.',
    "Respecting each other's time is part of the job.",
  ],
  positionsTitle: 'Open positions',
  noPositions: 'We do not currently have open positions.',
  noPositionsNote: 'When we do, they will appear here first.',
  communityTitle: 'Talent community',
  communityBody: 'If you want to be among the first to know when we open a position, reach out. We will only contact you if there is something relevant for you.',
  emailLead: 'Send us an email to',
  emailTail: 'with your name, area of interest, and a brief message about why Noetia interests you.',
  emailCta: 'Email equipo@noetia.app →',
  teamLabel: 'Team',
  teamCta: 'Learn how we work →',
  contactLabel: 'Contact',
  contactCta: 'Talk to the team →',
};

const frCA: CareersCopy = {
  label: 'Carrières',
  heroTitle: 'Si vous croyez que le savoir devrait être social —',
  heroBody: 'que les livres devraient compter davantage qu’aujourd’hui, et que bâtir la plateforme pour y arriver est l’un des emplois les plus intéressants en ce moment — parlons-en.',
  workTitle: 'Travailler ici',
  work: [
    { title: 'Le problème compte', body: 'Vous n’optimisez pas l’entonnoir d’un produit existant. Vous bâtissez l’infrastructure d’une nouvelle catégorie.' },
    { title: 'Un contexte complet', body: 'Dans une petite équipe, tout le monde comprend le produit de bout en bout — pas seulement sa partie.' },
    { title: 'Un travail qui se voit', body: 'Ce que vous bâtissez atteint de vrais utilisateurs en quelques jours, pas en quelques mois.' },
    { title: 'Une vraie autonomie', body: 'Si vous proposez une idée réfléchie, elle est étudiée. Il n’y a pas de couches d’approbation.' },
    { title: 'Des outils modernes', body: 'Nous utilisons ce qui fonctionne — y compris des méthodes de travail assistées par l’IA lorsque c’est pertinent.' },
    { title: 'Des normes claires', body: 'Couverture de tests, revue de code, critères d’acceptation. Non pas par bureaucratie — par respect pour le travail de l’équipe.' },
  ],
  principlesTitle: 'Principes de travail',
  principles: [
    'Nous bâtissons pour la personne qui lit sérieusement, pas pour celle qui cherche à se divertir.',
    'Une catégorie se bâtit avec des comportements répétés, pas avec des lancements.',
    'Du code sans tests n’est pas terminé. Une conception sans but non plus.',
    'Nous documentons ce que nous décidons et pourquoi — pas seulement le code.',
    'Une erreur signalée rapidement est une erreur corrigée rapidement.',
    'Respecter le temps des autres fait partie du travail.',
  ],
  positionsTitle: 'Postes ouverts',
  noPositions: 'Nous n’avons aucun poste ouvert pour le moment.',
  noPositionsNote: 'Lorsque nous en aurons, ils apparaîtront ici en premier.',
  communityTitle: 'Communauté de talents',
  communityBody: 'Si vous voulez être parmi les premières personnes informées de l’ouverture d’un poste, écrivez-nous. Nous n’utilisons pas ces renseignements à des fins de marketing — nous vous contacterons seulement si une occasion vous concerne.',
  emailLead: 'Envoyez-nous un courriel à',
  emailTail: 'avec votre nom, votre domaine d’intérêt et un court message expliquant pourquoi Noetia vous intéresse.',
  emailCta: 'Écrire à equipo@noetia.app →',
  teamLabel: 'Équipe',
  teamCta: 'Découvrir notre façon de travailler →',
  contactLabel: 'Contact',
  contactCta: 'Parler à l’équipe →',
};

export const careersCopy: Localized<CareersCopy> = { es, en, 'fr-CA': frCA };
