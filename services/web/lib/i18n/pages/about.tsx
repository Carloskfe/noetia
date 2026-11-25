import React from 'react';
import type { Localized } from './types';

// /about page dictionary (NEM-025 B1-A). ES/EN moved verbatim from app/(corporate)/about/content.tsx;
// fr-CA is a DRAFT pending qualified Canadian-French review. Causas Noetia keeps 2.22% (PO-053).
export interface AboutCopy {
  label: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  missionLabel: string;
  mission: string;
  visionLabel: string;
  vision: string;
  whyTitle: string;
  why: React.ReactNode;
  whatTitle: string;
  whatIntro: string;
  acts: string[];
  whatBody: React.ReactNode;
  approachTitle: string;
  approach: React.ReactNode;
  valuesTitle: string;
  values: { title: string; body: string }[];
  storyTitle: string;
  story: React.ReactNode;
  links: { href: string; label: string; cta: string }[];
}

const es: AboutCopy = {
  label: 'Sobre Noetia',
  heroTitle: 'Leer siempre fue íntimo.',
  heroSubtitle: 'Noetia lo convierte en identidad.',
  ctaPrimary: 'Crear cuenta gratis',
  ctaSecondary: 'Explorar la biblioteca →',
  missionLabel: 'Misión',
  mission: 'Transformar el conocimiento que consumes en una identidad intelectual visible.',
  visionLabel: 'Visión',
  vision: 'Un mundo donde el conocimiento es la moneda social más valiosa — y las personas más leídas son las más visibles.',
  whyTitle: 'Por qué existimos',
  why: (
    <>
      <p>Existen plataformas para consumir contenido. Existen plataformas para crear contenido. No existía una plataforma donde el acto de leer produjera, directamente, expresión.</p>
      <p>Eso es lo que construimos.</p>
      <p>Cuando lees <em>Las Meditaciones</em> y resaltas &ldquo;La impedimenta para la acción impulsa la acción&rdquo;, ese momento no debería desaparecer en un marcador olvidado. Debería vivir. Debería ser parte de cómo el mundo te conoce.</p>
      <p>Hay millones de personas que leen libros extraordinarios — y casi nadie en su entorno lo sabe. Hay ideas que cambian vidas muriendo en el subrayado de un libro que nadie más ve.</p>
      <p>Noetia existe para cerrar esa brecha — entre lo que lees y lo que expresas. Entre quién eres intelectualmente y quién apareces siendo públicamente.</p>
    </>
  ),
  whatTitle: 'Qué hacemos',
  whatIntro: 'Noetia combina seis actos en una sola plataforma:',
  acts: ['Leer', 'Escuchar', 'Resaltar', 'Anotar', 'Compartir', 'Construir identidad'],
  whatBody: (
    <>
      <p>Esa combinación no tiene nombre todavía en ningún otro producto. La llamamos <strong>Expresión del Conocimiento</strong>.</p>
      <p>Un usuario que lee <em>Hábitos Atómicos</em> en Noetia no solo avanza páginas. Captura los pasajes que lo movieron. Los comparte con su audiencia. Construye, de forma acumulativa, un registro visible de lo que piensa y en qué cree.</p>
      <p>Con el tiempo, ese registro no es una biblioteca. Es una identidad.</p>
    </>
  ),
  approachTitle: 'Nuestro enfoque',
  approach: (
    <>
      <p>Diseñamos Noetia para personas que leen en serio — y que entienden que las ideas no tienen valor si no se expresan.</p>
      <p>No somos una app de entretenimiento. No optimizamos para el tiempo en pantalla. Optimizamos para la profundidad y la expresión.</p>
      <p>Cada decisión de diseño parte de una pregunta: ¿esta funcionalidad transforma al usuario de consumidor en expresor? Si la respuesta es no, no entra.</p>
      <p>Construir una categoría es diferente a construir un producto. Las categorías requieren que un comportamiento se vuelva habitual — y los hábitos se crean con experiencias que funcionan de forma consistente, no con funciones que impresionan una sola vez.</p>
    </>
  ),
  valuesTitle: 'Lo que creemos',
  values: [
    { title: 'El conocimiento es identidad', body: 'Lo que lees dice algo sobre quién eres. Noetia lo hace visible cuando tú lo decides.' },
    { title: 'La expresión es el acto más elevado del conocimiento', body: 'Leer sin expresar es consumir. Leer y expresar es pensar.' },
    { title: 'La profundidad sobre el volumen', body: 'Preferimos que un usuario capture diez ideas que lo definan a que "consuma" cien que olvide.' },
    { title: 'La ejecución es la estrategia', body: 'Las categorías no se declaran. Se construyen, funcionalidad por funcionalidad, con productos que funcionan.' },
    { title: 'Compartir es ayudar', body: 'Noetia es una plataforma de compartir conocimiento. Ese acto debe tener consecuencias reales. Con Causas Noetia, un programa en preparación, planeamos destinar el 2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago, a organizaciones benéficas independientes en bienestar animal, niñez y juventud, y medio ambiente. Las alianzas aún están pendientes.' },
    { title: 'Honestidad sobre lo que somos', body: 'Somos un equipo pequeño construyendo algo serio. Lo decimos sin apología.' },
  ],
  storyTitle: 'La historia de Noetia',
  story: (
    <>
      <p>Noetia comenzó con una observación incómoda: hay millones de personas que leen libros extraordinarios — y casi nadie en su entorno lo sabe.</p>
      <p>Hay plataformas para mostrar lo que ves, lo que escuchas, lo que comes, lo que compras. No hay ninguna para mostrar lo que piensas.</p>
      <p>Construir una plataforma donde el conocimiento sea social requería resolver un problema técnico muy específico: sincronizar texto y audio frase por frase. No capítulo por capítulo. Frase por frase.</p>
      <p>Las categorías más importantes de la última década no fueron funciones nuevas. Fueron comportamientos nuevos. Instagram creó la identidad visual. LinkedIn creó la identidad profesional. Spotify creó la identidad musical. Noetia está creando la <strong>identidad intelectual</strong>.</p>
      <p>Hoy operamos con una plataforma en producción, lectores reales y una arquitectura construida para escalar. El trabajo que queda es completar la categoría.</p>
    </>
  ),
  links: [
    { href: '/company', label: 'Empresa', cta: 'Cómo operamos →' },
    { href: '/how-we-build', label: 'Ingeniería', cta: 'Cómo construimos →' },
    { href: '/contact', label: 'Contacto', cta: 'Hablar con el equipo →' },
  ],
};

const en: AboutCopy = {
  label: 'About Noetia',
  heroTitle: 'Reading was always intimate.',
  heroSubtitle: 'Noetia turns it into identity.',
  ctaPrimary: 'Create free account',
  ctaSecondary: 'Explore the library →',
  missionLabel: 'Mission',
  mission: 'Transform the knowledge you consume into a visible intellectual identity.',
  visionLabel: 'Vision',
  vision: 'A world where knowledge is the most valuable social currency — and the most well-read people are the most visible.',
  whyTitle: 'Why we exist',
  why: (
    <>
      <p>Platforms exist to consume content. Platforms exist to create content. No platform existed where the act of reading directly produced expression.</p>
      <p>That is what we built.</p>
      <p>When you read <em>Meditations</em> and highlight &ldquo;The impediment to action advances action,&rdquo; that moment should not disappear into a forgotten bookmark. It should live. It should be part of how the world knows you.</p>
      <p>There are millions of people reading extraordinary books — and almost no one in their circle knows it. There are ideas that change lives dying in the margin of a book no one else ever sees.</p>
      <p>Noetia exists to close that gap — between what you read and what you express. Between who you are intellectually and who you appear to be publicly.</p>
    </>
  ),
  whatTitle: 'What we do',
  whatIntro: 'Noetia combines six acts in one platform:',
  acts: ['Read', 'Listen', 'Highlight', 'Annotate', 'Share', 'Build identity'],
  whatBody: (
    <>
      <p>That combination does not yet have a name in any other product. We call it <strong>Knowledge Expression</strong>.</p>
      <p>A user who reads <em>Atomic Habits</em> on Noetia does not just advance pages. They capture the passages that moved them. They share them with their audience. They build, cumulatively, a visible record of what they think and what they believe.</p>
      <p>Over time, that record is not a library. It is an identity.</p>
    </>
  ),
  approachTitle: 'Our approach',
  approach: (
    <>
      <p>We designed Noetia for people who read seriously — and who understand that ideas have no value if they are not expressed.</p>
      <p>We are not an entertainment app. We do not optimize for screen time. We optimize for depth and expression.</p>
      <p>Every design decision starts with a question: does this feature transform the user from consumer to expresser? If the answer is no, it does not enter.</p>
      <p>Building a category is different from building a product. Categories require a behavior to become habitual — and habits are created with experiences that work consistently, not features that impress once.</p>
    </>
  ),
  valuesTitle: 'What we believe',
  values: [
    { title: 'Knowledge is identity', body: 'What you read says something about who you are. Noetia makes it visible when you decide.' },
    { title: 'Expression is the highest act of knowledge', body: 'Reading without expressing is consuming. Reading and expressing is thinking.' },
    { title: 'Depth over volume', body: 'We would rather a user capture ten defining ideas than "consume" a hundred they forget.' },
    { title: 'Execution is the strategy', body: 'Categories are not declared. They are built, feature by feature, with products that work.' },
    { title: 'Sharing is helping', body: 'Noetia is a platform for sharing knowledge. That act should have real consequences. Through Causas Noetia, a planned program, we plan to allocate 2.22% of eligible net receipts, after payment-processing fees, to independent charitable organizations in animal welfare, children and youth, and the environment. Partnerships are pending.' },
    { title: 'Honesty about what we are', body: 'We are a small team building something serious. We say so without apology.' },
  ],
  storyTitle: 'The Noetia story',
  story: (
    <>
      <p>Noetia started with an uncomfortable observation: there are millions of people reading extraordinary books — and almost no one in their circle knows it.</p>
      <p>There are platforms for showing what you watch, listen to, eat, buy. There is no platform for showing what you think.</p>
      <p>Building a platform where knowledge is social required solving a very specific technical problem: synchronizing text and audio phrase by phrase. Not chapter by chapter. Phrase by phrase.</p>
      <p>The most important categories of the last decade were not new features. They were new behaviors. Instagram created visual identity. LinkedIn created professional identity. Spotify created musical identity. Noetia is creating <strong>intellectual identity</strong>.</p>
      <p>Today we operate with a production platform, real readers, and an architecture built to scale. The work remaining is to complete the category.</p>
    </>
  ),
  links: [
    { href: '/company', label: 'Company', cta: 'How we operate →' },
    { href: '/how-we-build', label: 'Engineering', cta: 'How we build →' },
    { href: '/contact', label: 'Contact', cta: 'Talk to the team →' },
  ],
};

const frCA: AboutCopy = {
  label: 'À propos de Noetia',
  heroTitle: 'Lire a toujours été intime.',
  heroSubtitle: 'Noetia en fait une identité.',
  ctaPrimary: 'Créer un compte gratuit',
  ctaSecondary: 'Explorer la bibliothèque →',
  missionLabel: 'Mission',
  mission: 'Transformer le savoir que vous consommez en une identité intellectuelle visible.',
  visionLabel: 'Vision',
  vision: 'Un monde où le savoir est la monnaie sociale la plus précieuse — et où les personnes les plus cultivées sont les plus visibles.',
  whyTitle: 'Pourquoi nous existons',
  why: (
    <>
      <p>Il existe des plateformes pour consommer du contenu. Il existe des plateformes pour en créer. Il n’existait aucune plateforme où l’acte de lire produisait directement de l’expression.</p>
      <p>C’est ce que nous avons bâti.</p>
      <p>Quand vous lisez les <em>Pensées pour moi-même</em> et surlignez «&nbsp;L’obstacle à l’action fait avancer l’action&nbsp;», ce moment ne devrait pas disparaître dans un signet oublié. Il devrait vivre. Il devrait faire partie de la façon dont le monde vous connaît.</p>
      <p>Des millions de personnes lisent des livres extraordinaires — et presque personne dans leur entourage ne le sait. Des idées qui changent des vies meurent dans le soulignement d’un livre que personne d’autre ne voit.</p>
      <p>Noetia existe pour combler cet écart — entre ce que vous lisez et ce que vous exprimez. Entre qui vous êtes intellectuellement et qui vous paraissez être publiquement.</p>
    </>
  ),
  whatTitle: 'Ce que nous faisons',
  whatIntro: 'Noetia réunit six gestes dans une seule plateforme :',
  acts: ['Lire', 'Écouter', 'Surligner', 'Annoter', 'Partager', 'Bâtir son identité'],
  whatBody: (
    <>
      <p>Cette combinaison n’a encore de nom dans aucun autre produit. Nous l’appelons l’<strong>expression du savoir</strong>.</p>
      <p>Une personne qui lit <em>Un rien peut tout changer</em> sur Noetia ne fait pas que tourner des pages. Elle saisit les passages qui l’ont touchée. Elle les partage avec son public. Elle bâtit, au fil du temps, une trace visible de ce qu’elle pense et de ce en quoi elle croit.</p>
      <p>Avec le temps, cette trace n’est pas une bibliothèque. C’est une identité.</p>
    </>
  ),
  approachTitle: 'Notre approche',
  approach: (
    <>
      <p>Nous avons conçu Noetia pour les personnes qui lisent sérieusement — et qui comprennent que les idées n’ont aucune valeur si elles ne sont pas exprimées.</p>
      <p>Nous ne sommes pas une application de divertissement. Nous n’optimisons pas le temps d’écran. Nous optimisons la profondeur et l’expression.</p>
      <p>Chaque décision de conception part d’une question : cette fonctionnalité transforme-t-elle l’utilisateur de consommateur en personne qui s’exprime? Si la réponse est non, elle n’entre pas.</p>
      <p>Bâtir une catégorie est différent de bâtir un produit. Une catégorie exige qu’un comportement devienne une habitude — et les habitudes naissent d’expériences qui fonctionnent de façon constante, pas de fonctionnalités qui impressionnent une seule fois.</p>
    </>
  ),
  valuesTitle: 'Ce en quoi nous croyons',
  values: [
    { title: 'Le savoir est une identité', body: 'Ce que vous lisez dit quelque chose de qui vous êtes. Noetia le rend visible quand vous le décidez.' },
    { title: 'L’expression est l’acte le plus élevé du savoir', body: 'Lire sans exprimer, c’est consommer. Lire et exprimer, c’est penser.' },
    { title: 'La profondeur plutôt que le volume', body: 'Nous préférons qu’une personne saisisse dix idées qui la définissent plutôt qu’elle en « consomme » cent qu’elle oubliera.' },
    { title: 'L’exécution est la stratégie', body: 'Les catégories ne se déclarent pas. Elles se bâtissent, fonctionnalité par fonctionnalité, avec des produits qui fonctionnent.' },
    { title: 'Partager, c’est aider', body: 'Noetia est une plateforme de partage du savoir. Ce geste doit avoir des conséquences réelles. Avec Causas Noetia, un programme prévu, nous prévoyons verser 2,22 % des recettes nettes admissibles, après les frais de traitement des paiements, à des organismes de bienfaisance indépendants en bien-être animal, en enfance et jeunesse, et en environnement. Les partenariats sont en attente.' },
    { title: 'L’honnêteté sur ce que nous sommes', body: 'Nous sommes une petite équipe qui bâtit quelque chose de sérieux. Nous le disons sans détour.' },
  ],
  storyTitle: 'L’histoire de Noetia',
  story: (
    <>
      <p>Noetia est née d’un constat dérangeant : des millions de personnes lisent des livres extraordinaires — et presque personne dans leur entourage ne le sait.</p>
      <p>Il existe des plateformes pour montrer ce que vous regardez, écoutez, mangez, achetez. Il n’en existe aucune pour montrer ce que vous pensez.</p>
      <p>Bâtir une plateforme où le savoir est social exigeait de résoudre un problème technique très précis : synchroniser le texte et l’audio phrase par phrase. Pas chapitre par chapitre. Phrase par phrase.</p>
      <p>Les catégories les plus importantes de la dernière décennie n’ont pas été de nouvelles fonctionnalités. Ce furent de nouveaux comportements. Instagram a créé l’identité visuelle. LinkedIn a créé l’identité professionnelle. Spotify a créé l’identité musicale. Noetia crée l’<strong>identité intellectuelle</strong>.</p>
      <p>Aujourd’hui, nous exploitons une plateforme en production, avec de vrais lecteurs et une architecture conçue pour croître. Il reste à compléter la catégorie.</p>
    </>
  ),
  links: [
    { href: '/company', label: 'Entreprise', cta: 'Notre fonctionnement →' },
    { href: '/how-we-build', label: 'Ingénierie', cta: 'Notre façon de bâtir →' },
    { href: '/contact', label: 'Contact', cta: 'Parler à l’équipe →' },
  ],
};

export const aboutCopy: Localized<AboutCopy> = { es, en, 'fr-CA': frCA };
