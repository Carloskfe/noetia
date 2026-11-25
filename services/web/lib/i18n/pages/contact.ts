import type { Localized } from './types';

// /contact page dictionary (NEM-025 B1-A). ES/EN moved verbatim; fr-CA DRAFT pending review.
// Addresses are unchanged here; the approved renames are a separate task (PR #75, E1/E2).
export const CONTACT_CHANNELS = [
  { icon: '✉️', email: 'info@noetia.app' },
  { icon: '✍️', email: 'autores@noetia.app' },
  { icon: '📘', email: 'editorial@noetia.app' },
  { icon: '🤝', email: 'socios@noetia.app' },
  { icon: '📰', email: 'prensa@noetia.app' },
  { icon: '👤', email: 'equipo@noetia.app' },
  { icon: '🌿', email: 'causas@noetia.app' },
  { icon: '⚖️', email: 'legal@noetia.app' },
] as const;

export interface ContactCopy {
  label: string;
  heroTitle: string;
  heroBody: string;
  /** One entry per CONTACT_CHANNELS item, same order. */
  channels: { label: string; use: string }[];
  trust: string;
  links: { href: string; label: string; cta: string }[];
}

const es: ContactCopy = {
  label: 'Contacto',
  heroTitle: 'Somos un equipo pequeño con una visión específica.',
  heroBody: 'Si compartes esa visión — como lector, como autor, como socio o como alguien que quiere construir esto con nosotros — queremos saber de ti. Leemos todos los mensajes. Respondemos en 1–3 días hábiles.',
  channels: [
    { label: 'General', use: 'Preguntas generales, feedback de usuarios, cualquier otra consulta.' },
    { label: 'Autores', use: 'Publicar un libro, preguntas sobre el proceso de sincronización, acceso al portal.' },
    { label: 'Editoriales', use: 'Catálogos grandes, acuerdos de distribución, integraciones editoriales.' },
    { label: 'Socios estratégicos', use: 'Alianzas estratégicas, integraciones tecnológicas, oportunidades de colaboración.' },
    { label: 'Prensa y medios', use: 'Consultas de medios, información de empresa, solicitudes de entrevista.' },
    { label: 'Carreras', use: 'Expresar interés en trabajar con nosotros, comunidad de talento.' },
    { label: 'Causas Noetia', use: 'Propuestas de alianza estratégica para organizaciones sociales.' },
    { label: 'Legal', use: 'Privacidad, derechos de autor, términos, GDPR.' },
  ],
  trust: 'No vendemos ni compartimos tu información de contacto con terceros. Los mensajes se leen por personas del equipo — no por sistemas automáticos de primer nivel.',
  links: [
    { href: '/about', label: 'Sobre Noetia', cta: 'Nuestra misión →' },
    { href: '/careers', label: 'Trabajo', cta: 'Trabaja con nosotros →' },
    { href: '/upload-guide', label: 'Autores', cta: 'Guía de publicación →' },
  ],
};

const en: ContactCopy = {
  label: 'Contact',
  heroTitle: 'We are a small team with a specific vision.',
  heroBody: 'If you share that vision — as a reader, an author, a partner, or someone who wants to build this with us — we want to hear from you. We read every message. We respond within 1–3 business days.',
  channels: [
    { label: 'General', use: 'General questions, user feedback, anything else.' },
    { label: 'Authors', use: 'Publishing a book, questions about the sync process, portal access.' },
    { label: 'Publishers', use: 'Large catalogs, distribution agreements, editorial integrations.' },
    { label: 'Strategic partners', use: 'Strategic alliances, technology integrations, collaboration opportunities.' },
    { label: 'Press and media', use: 'Media inquiries, company information, interview requests.' },
    { label: 'Careers', use: 'Expressing interest in working with us, talent community.' },
    { label: 'Causas Noetia', use: 'Strategic partnership proposals from social organizations.' },
    { label: 'Legal', use: 'Privacy, copyright, terms, GDPR.' },
  ],
  trust: 'We do not sell or share your contact information with third parties. Messages are read by team members — not first-level automated systems.',
  links: [
    { href: '/about', label: 'About', cta: 'Our mission →' },
    { href: '/careers', label: 'Careers', cta: 'Work with us →' },
    { href: '/upload-guide', label: 'Authors', cta: 'Publishing guide →' },
  ],
};

const frCA: ContactCopy = {
  label: 'Contact',
  heroTitle: 'Nous sommes une petite équipe avec une vision précise.',
  heroBody: 'Si vous partagez cette vision — comme lecteur, comme auteur, comme partenaire ou comme personne qui veut bâtir ce projet avec nous — nous voulons vous entendre. Nous lisons tous les messages. Nous répondons en 1 à 3 jours ouvrables.',
  channels: [
    { label: 'Général', use: 'Questions générales, commentaires des utilisateurs, toute autre demande.' },
    { label: 'Auteurs', use: 'Publier un livre, questions sur le processus de synchronisation, accès au portail.' },
    { label: 'Maisons d’édition', use: 'Grands catalogues, ententes de distribution, intégrations éditoriales.' },
    { label: 'Partenaires stratégiques', use: 'Alliances stratégiques, intégrations technologiques, occasions de collaboration.' },
    { label: 'Presse et médias', use: 'Demandes des médias, renseignements sur l’entreprise, demandes d’entrevue.' },
    { label: 'Carrières', use: 'Manifester votre intérêt à travailler avec nous, communauté de talents.' },
    { label: 'Causas Noetia', use: 'Propositions de partenariat stratégique de la part d’organismes sociaux.' },
    { label: 'Juridique', use: 'Confidentialité, droits d’auteur, conditions, RGPD.' },
  ],
  trust: 'Nous ne vendons ni ne partageons vos coordonnées avec des tiers. Les messages sont lus par des membres de l’équipe — pas par des systèmes automatisés de premier niveau.',
  links: [
    { href: '/about', label: 'À propos', cta: 'Notre mission →' },
    { href: '/careers', label: 'Carrières', cta: 'Travailler avec nous →' },
    { href: '/upload-guide', label: 'Auteurs', cta: 'Guide de publication →' },
  ],
};

export const contactCopy: Localized<ContactCopy> = { es, en, 'fr-CA': frCA };
