import React from 'react';
import type { Localized } from './types';

// /causas page dictionary (NEM-025 B1-A). ES/EN moved verbatim (planned-program wording, PO 2026-11-18,
// PO-053). The 2.22% commitment is unchanged in every language. fr-CA DRAFT pending qualified review;
// the French Causas copy also needs the same PO wording check as ES/EN before exposure.
export const CAUSAS_LINES = [
  { slug: 'bienestar-animal', icon: '🐾', color: 'from-amber-900/30 to-amber-950/10 border-amber-500/20', accent: 'text-amber-400' },
  { slug: 'ninez-y-juventud', icon: '📚', color: 'from-blue-900/30 to-blue-950/10 border-blue-500/20', accent: 'text-blue-400' },
  { slug: 'medio-ambiente', icon: '🌿', color: 'from-emerald-900/30 to-emerald-950/10 border-emerald-500/20', accent: 'text-emerald-400' },
] as const;

export interface CausasPageCopy {
  back: string;
  status: string;
  quote: string;
  heroTitle: React.ReactNode;
  heroBody: React.ReactNode;
  disclosure: string;
  /** One entry per CAUSAS_LINES item, same order. */
  lines: { name: string; description: string }[];
  howTitle: string;
  how: string[];
  allianceEyebrow: string;
  allianceTitle: React.ReactNode;
  allianceBody: string;
  criteria: string[];
  mailSubject: string;
  mailCta: string;
  allianceNote: string;
}

const gradient = 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400';

const es: CausasPageCopy = {
  back: '← Biblioteca',
  status: 'Programa en preparación',
  quote: '"Creemos que compartir es una forma de ayudar."',
  heroTitle: <>Compartir aquí mueve<br /><span className={gradient}>más que páginas.</span></>,
  heroBody: (
    <>Construimos Noetia para compartir conocimiento, y creemos que compartir
      tiene que significar algo más que alcance. Causas Noetia es un programa en
      preparación: planeamos destinar el <strong className="text-white">2,22%</strong> de
      los ingresos netos elegibles, después de las comisiones de procesamiento de pago, a
      organizaciones benéficas independientes en tres causas.</>
  ),
  disclosure: 'Causas Noetia aún no ha comenzado. Las alianzas con organizaciones benéficas están pendientes: no se ha firmado ningún acuerdo y no se ha realizado ninguna contribución. Nombraremos a las organizaciones solo después de firmar los acuerdos.',
  lines: [
    { name: 'Bienestar Animal', description: 'Enfoque previsto: iniciativas de rescate, cuidado, rehabilitación y protección de animales en América Latina.' },
    { name: 'Niñez y Juventud', description: 'Enfoque previsto: proyectos que amplían el acceso a la educación, la lectura y las oportunidades para niños y jóvenes.' },
    { name: 'Medio Ambiente', description: 'Enfoque previsto: la protección de los ecosistemas, la biodiversidad y los recursos naturales de nuestra región.' },
  ],
  howTitle: '¿Cómo funciona?',
  how: [
    'Cuando el programa comience, planeamos destinar el 2,22% de los ingresos netos elegibles: lo que Noetia recibe después de las comisiones de procesamiento de pago.',
    'Podrás elegir una causa para recibir esa asignación. Si no eliges ninguna, se repartirá por igual entre las tres.',
    'La asignación irá a organizaciones benéficas independientes, no a causas operadas por Noetia.',
  ],
  allianceEyebrow: 'Para organizaciones benéficas',
  allianceTitle: <>¿Tu proyecto genera cambio real<br className="hidden sm:block" /> en América Latina?</>,
  allianceBody: 'Buscamos organizaciones benéficas independientes en bienestar animal, niñez y juventud, y medio ambiente para las primeras alianzas del programa. Si tu organización trabaja con propósito, con transparencia y con impacto demostrable, queremos conocerte.',
  criteria: ['Trabajo en una de las tres líneas estratégicas', 'Operación en América Latina', 'Impacto documentado y transparente'],
  mailSubject: 'Propuesta de alianza estratégica — Causas Noetia',
  mailCta: 'Escríbenos a causas@noetia.app',
  allianceNote: 'Evaluamos cada propuesta con base en transparencia, impacto documentado y alineación con nuestra comunidad de lectores.',
};

const en: CausasPageCopy = {
  back: '← Library',
  status: 'Planned program',
  quote: '"We believe sharing is a form of helping."',
  heroTitle: <>Sharing here moves<br /><span className={gradient}>more than pages.</span></>,
  heroBody: (
    <>We built Noetia to share knowledge, and we believe sharing must mean something
      more than reach. Causas Noetia is a planned program: we plan to allocate{' '}
      <strong className="text-white">2.22%</strong> of eligible net receipts, after
      payment-processing fees, to independent charitable organizations across three causes.</>
  ),
  disclosure: 'Causas Noetia has not started yet. Charitable partnerships are pending: no agreement has been signed and no contribution has been made. We will name organizations only after agreements are signed.',
  lines: [
    { name: 'Animal Welfare', description: 'Planned focus: rescue, care, rehabilitation and protection initiatives for animals in Latin America.' },
    { name: 'Children & Youth', description: 'Planned focus: projects that expand access to education, reading and opportunities for children and young people.' },
    { name: 'Environment', description: 'Planned focus: protecting the ecosystems, biodiversity and natural resources of our region.' },
  ],
  howTitle: 'How does it work?',
  how: [
    'Once the program starts, we plan to allocate 2.22% of eligible net receipts: what Noetia receives after payment-processing fees.',
    "You'll be able to choose one cause to receive that allocation. If you don't choose one, it will be split equally among all three.",
    'The allocation will go to independent charitable organizations, not to causes operated by Noetia.',
  ],
  allianceEyebrow: 'For charitable organizations',
  allianceTitle: <>Does your project generate real change<br className="hidden sm:block" /> in Latin America?</>,
  allianceBody: "We are looking for independent charitable organizations in animal welfare, children and youth, and the environment for the program's first partnerships. If your organization works with purpose, transparency, and demonstrable impact, we want to meet you.",
  criteria: ['Work within one of the three strategic lines', 'Operation in Latin America', 'Documented and transparent impact'],
  mailSubject: 'Strategic alliance proposal — Causas Noetia',
  mailCta: 'Write to causas@noetia.app',
  allianceNote: 'We evaluate each proposal based on transparency, documented impact, and alignment with our reader community.',
};

const frCA: CausasPageCopy = {
  back: '← Bibliothèque',
  status: 'Programme prévu',
  quote: '« Nous croyons que partager est une façon d’aider. »',
  heroTitle: <>Ici, partager fait bouger<br /><span className={gradient}>plus que des pages.</span></>,
  heroBody: (
    <>Nous avons bâti Noetia pour partager le savoir, et nous croyons que partager
      doit signifier plus que de la portée. Causas Noetia est un programme prévu :
      nous prévoyons verser <strong className="text-white">2,22 %</strong> des recettes
      nettes admissibles, après les frais de traitement des paiements, à des organismes
      de bienfaisance indépendants dans trois causes.</>
  ),
  disclosure: 'Causas Noetia n’a pas encore commencé. Les partenariats avec des organismes de bienfaisance sont en attente : aucune entente n’a été signée et aucune contribution n’a été versée. Nous nommerons les organismes seulement après la signature des ententes.',
  lines: [
    { name: 'Bien-être animal', description: 'Orientation prévue : initiatives de sauvetage, de soins, de réadaptation et de protection des animaux en Amérique latine.' },
    { name: 'Enfance et jeunesse', description: 'Orientation prévue : projets qui élargissent l’accès à l’éducation, à la lecture et aux occasions pour les enfants et les jeunes.' },
    { name: 'Environnement', description: 'Orientation prévue : protéger les écosystèmes, la biodiversité et les ressources naturelles de notre région.' },
  ],
  howTitle: 'Comment ça fonctionne?',
  how: [
    'Lorsque le programme commencera, nous prévoyons verser 2,22 % des recettes nettes admissibles : ce que Noetia reçoit après les frais de traitement des paiements.',
    'Vous pourrez choisir une cause pour recevoir ce montant. Si vous n’en choisissez aucune, il sera réparti également entre les trois.',
    'Le montant ira à des organismes de bienfaisance indépendants, et non à des causes gérées par Noetia.',
  ],
  allianceEyebrow: 'Pour les organismes de bienfaisance',
  allianceTitle: <>Votre projet crée-t-il un vrai changement<br className="hidden sm:block" /> en Amérique latine?</>,
  allianceBody: 'Nous cherchons des organismes de bienfaisance indépendants en bien-être animal, en enfance et jeunesse, et en environnement pour les premiers partenariats du programme. Si votre organisme agit avec intention, transparence et un impact démontrable, nous voulons vous connaître.',
  criteria: ['Travailler dans l’un des trois axes stratégiques', 'Être actif en Amérique latine', 'Avoir un impact documenté et transparent'],
  mailSubject: 'Proposition de partenariat stratégique — Causas Noetia',
  mailCta: 'Écrivez-nous à causas@noetia.app',
  allianceNote: 'Nous évaluons chaque proposition selon la transparence, l’impact documenté et l’adéquation avec notre communauté de lecteurs.',
};

export const causasPageCopy: Localized<CausasPageCopy> = { es, en, 'fr-CA': frCA };
