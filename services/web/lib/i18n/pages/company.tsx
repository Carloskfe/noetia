import React from 'react';
import type { Localized } from './types';

// /company page dictionary (NEM-025 B1-A). ES/EN moved verbatim; fr-CA DRAFT pending review.
export interface CompanyCopy {
  label: string;
  heroTitle: React.ReactNode;
  heroBody: string;
  categoryTitle: string;
  category: React.ReactNode;
  pillarsTitle: string;
  pillars: { icon: string; title: string; body: string }[];
  transformationLabel: string;
  transformationTitle: string;
  transformation: React.ReactNode;
  operationsTitle: string;
  operations: string[];
  publishingTitle: string;
  publishing: React.ReactNode;
  futureTitle: string;
  future: string[];
  links: { href: string; label: string; cta: string }[];
}

const es: CompanyCopy = {
  label: 'Empresa',
  heroTitle: <>No somos una app de lectura<br />que llegó tarde.</>,
  heroBody: 'Somos el primer intento deliberado de construir una categoría nueva: la Plataforma de Expresión del Conocimiento.',
  categoryTitle: 'La categoría que estamos creando',
  category: (
    <>
      <p>Las categorías más importantes de la última década no fueron funciones nuevas. Fueron comportamientos nuevos.</p>
      <div className="space-y-2 my-4 border-l-4 border-indigo-100 pl-4">
        <p className="text-sm">Instagram no inventó las fotos. Creó la <strong>identidad visual</strong>.</p>
        <p className="text-sm">LinkedIn no inventó el currículum. Creó la <strong>identidad profesional</strong>.</p>
        <p className="text-sm">Spotify no inventó el audio. Creó la <strong>identidad musical</strong>.</p>
      </div>
      <p><strong>Noetia no inventó los libros. Está creando la identidad intelectual.</strong></p>
      <p>Amazon puede construir sincronización. Spotify puede construir audiolibros. Google puede construir sharing. Esas funciones por sí solas no son defensibles. Lo que es difícil de copiar es el comportamiento. Si Noetia se convierte en el lugar donde las personas expresan lo que aprenden, habremos creado algo que ninguna función puede replicar: un hábito cultural.</p>
    </>
  ),
  pillarsTitle: 'Cuatro pilares',
  pillars: [
    { icon: '🌐', title: 'Plataforma global de conocimiento', body: 'Libros que importan, accesibles, sincronizados y vivos para cualquier lector en cualquier lugar.' },
    { icon: '✍️', title: 'Ecosistema para creadores', body: 'Lectores y autores en una red que amplifica la expresión de ambos. Cada fragmento compartido es alcance orgánico para el autor.' },
    { icon: '🎧', title: 'Estándar multimodal de lectura', body: 'Leer y escuchar como la misma experiencia, no experiencias paralelas. Sincronización frase por frase como infraestructura.' },
    { icon: '🧠', title: 'Red de identidad intelectual', body: 'Lo que lees y compartes define cómo el mundo te conoce. El perfil más auténtico que existe: construido con lecturas reales.' },
  ],
  transformationLabel: 'La transformación',
  transformationTitle: 'Lo que ocurre con un usuario de Noetia en seis meses.',
  transformation: (
    <>
      <p>Imagina un usuario que lee en Noetia durante seis meses:</p>
      <p>Ha leído <em>Las Meditaciones</em>, <em>Hábitos Atómicos</em>, <em>El Príncipe</em> y <em>El Nuevo Testamento</em>.</p>
      <p>Ha resaltado 140 fragmentos. Ha compartido 23.</p>
      <p>Su audiencia ha visto, a través de esos 23 fragmentos, que piensa sobre el estoicismo, la productividad, el poder y la fe.</p>
      <p>Ese perfil no se construyó con un formulario. Se construyó con lecturas reales y elecciones reales.</p>
      <p className="text-white font-semibold">Ese es el resultado de Noetia. No una biblioteca. Una identidad visible.</p>
    </>
  ),
  operationsTitle: 'Áreas de operación',
  operations: [
    'Producto de consumo (web y móvil)',
    'Plataforma de publicación para autores y editoriales',
    'Comunidades de lectura (Clubes, Escucha Juntos)',
    'Compartir contenido — fragmentos visuales para redes',
    'Infraestructura editorial (revisión, analíticas, derechos)',
    'Impacto social — Causas Noetia (programa en preparación; alianzas pendientes)',
  ],
  publishingTitle: 'Ecosistema editorial y modelo de ingresos',
  publishing: (
    <>
      <p>Noetia opera como un canal de distribución digital para autores y editoriales que quieren llegar a lectores con una experiencia de lectura diferente.</p>
      <p><strong>Lo que ofrecemos a autores:</strong></p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>Portal de publicación con revisión editorial (3–5 días hábiles)</li>
        <li>Sincronización texto-audio vía SRT/VTT o procesamiento Whisper</li>
        <li>Analíticas de lectura: fragmentos guardados, compartidos, tiempo de lectura</li>
        <li>Alcance orgánico generado por fragmentos que los lectores comparten</li>
      </ul>
    </>
  ),
  futureTitle: 'Crecimiento futuro',
  future: [
    'Expansión del catálogo de autores en español e inglés',
    'Herramientas de publicación para editoriales con catálogos grandes',
    'Extensión de los Clubes a eventos de autores y presentaciones en vivo',
    'Expansión a otros idiomas (portugués, catalán)',
    'API pública para instituciones educativas y bibliotecas digitales',
  ],
  links: [
    { href: '/how-we-build', label: 'Ingeniería', cta: 'Cómo construimos →' },
    { href: '/milestones', label: 'Progreso', cta: 'Lo que hemos construido →' },
    { href: '/upload-guide', label: 'Para autores', cta: 'Publicar en Noetia →' },
  ],
};

const en: CompanyCopy = {
  label: 'Company',
  heroTitle: <>We are not a reading app<br />that arrived late.</>,
  heroBody: 'We are the first deliberate attempt to build a new category: the Knowledge Expression Platform.',
  categoryTitle: 'The category we are creating',
  category: (
    <>
      <p>The most important categories of the last decade were not new features. They were new behaviors.</p>
      <div className="space-y-2 my-4 border-l-4 border-indigo-100 pl-4">
        <p className="text-sm">Instagram did not invent photos. It created <strong>visual identity</strong>.</p>
        <p className="text-sm">LinkedIn did not invent the résumé. It created <strong>professional identity</strong>.</p>
        <p className="text-sm">Spotify did not invent audio. It created <strong>musical identity</strong>.</p>
      </div>
      <p><strong>Noetia did not invent books. It is creating intellectual identity.</strong></p>
      <p>Amazon can build syncing. Spotify can build audiobooks. Google can build sharing. Those features alone are not defensible. What is difficult to copy is the behavior. If Noetia becomes the place where people express what they learn, we will have created something no feature can replicate: a cultural habit.</p>
    </>
  ),
  pillarsTitle: 'Four pillars',
  pillars: [
    { icon: '🌐', title: 'Global knowledge platform', body: 'Books that matter, accessible, synchronized, and alive for any reader anywhere.' },
    { icon: '✍️', title: 'Creator ecosystem', body: 'Readers and authors in a network that amplifies the expression of both. Every shared fragment is organic reach for the author.' },
    { icon: '🎧', title: 'Multimodal reading standard', body: 'Reading and listening as the same experience, not parallel ones. Phrase-by-phrase synchronization as infrastructure.' },
    { icon: '🧠', title: 'Intellectual identity network', body: 'What you read and share defines how the world knows you. The most authentic profile that exists: built with real readings.' },
  ],
  transformationLabel: 'The transformation',
  transformationTitle: 'What happens to a Noetia user in six months.',
  transformation: (
    <>
      <p>Imagine a user who reads on Noetia for six months:</p>
      <p>They have read <em>Meditations</em>, <em>Atomic Habits</em>, <em>The Prince</em>, and <em>The New Testament</em>.</p>
      <p>They have highlighted 140 fragments. They have shared 23.</p>
      <p>Their audience has seen, through those 23 fragments, that they think about stoicism, productivity, power, and faith.</p>
      <p>That profile was not built with a form. It was built with real readings and real choices.</p>
      <p className="text-white font-semibold">That is the result of Noetia. Not a library. A visible identity.</p>
    </>
  ),
  operationsTitle: 'Areas of operation',
  operations: [
    'Consumer product (web and mobile)',
    'Publishing platform for authors and publishers',
    'Reading communities (Clubs, Escucha Juntos)',
    'Content sharing — visual fragments for social networks',
    'Editorial infrastructure (review, analytics, rights)',
    'Social impact — Causas Noetia (planned program; partnerships pending)',
  ],
  publishingTitle: 'Publishing ecosystem and revenue model',
  publishing: (
    <>
      <p>Noetia operates as a digital distribution channel for authors and publishers who want to reach readers with a different reading experience.</p>
      <p><strong>What we offer authors:</strong></p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>Publishing portal with editorial review (3–5 business days)</li>
        <li>Text-audio synchronization via SRT/VTT or Whisper processing</li>
        <li>Reading analytics: saved fragments, shares, reading time</li>
        <li>Organic reach generated by fragments readers share</li>
      </ul>
    </>
  ),
  futureTitle: 'Future growth',
  future: [
    'Expansion of the author catalog in Spanish and English',
    'Publishing tools for publishers with large catalogs',
    'Extension of Clubs to author events and live presentations',
    'Expansion to other languages (Portuguese, Catalan)',
    'Public API for educational institutions and digital libraries',
  ],
  links: [
    { href: '/how-we-build', label: 'Engineering', cta: 'How we build →' },
    { href: '/milestones', label: 'Progress', cta: 'What we have built →' },
    { href: '/upload-guide', label: 'For authors', cta: 'Publish on Noetia →' },
  ],
};

const frCA: CompanyCopy = {
  label: 'Entreprise',
  heroTitle: <>Nous ne sommes pas une application de lecture<br />arrivée en retard.</>,
  heroBody: 'Nous sommes la première tentative délibérée de bâtir une nouvelle catégorie : la plateforme d’expression du savoir.',
  categoryTitle: 'La catégorie que nous créons',
  category: (
    <>
      <p>Les catégories les plus importantes de la dernière décennie n’ont pas été de nouvelles fonctionnalités. Ce furent de nouveaux comportements.</p>
      <div className="space-y-2 my-4 border-l-4 border-indigo-100 pl-4">
        <p className="text-sm">Instagram n’a pas inventé la photo. Instagram a créé l’<strong>identité visuelle</strong>.</p>
        <p className="text-sm">LinkedIn n’a pas inventé le curriculum vitæ. LinkedIn a créé l’<strong>identité professionnelle</strong>.</p>
        <p className="text-sm">Spotify n’a pas inventé l’audio. Spotify a créé l’<strong>identité musicale</strong>.</p>
      </div>
      <p><strong>Noetia n’a pas inventé les livres. Noetia crée l’identité intellectuelle.</strong></p>
      <p>Amazon peut bâtir la synchronisation. Spotify peut bâtir les livres audio. Google peut bâtir le partage. Ces fonctionnalités, seules, ne sont pas défendables. Ce qui est difficile à copier, c’est le comportement. Si Noetia devient l’endroit où les gens expriment ce qu’ils apprennent, nous aurons créé ce qu’aucune fonctionnalité ne peut reproduire : une habitude culturelle.</p>
    </>
  ),
  pillarsTitle: 'Quatre piliers',
  pillars: [
    { icon: '🌐', title: 'Plateforme mondiale du savoir', body: 'Des livres qui comptent, accessibles, synchronisés et vivants pour toute personne qui lit, où qu’elle soit.' },
    { icon: '✍️', title: 'Écosystème pour les créateurs', body: 'Lecteurs et auteurs réunis dans un réseau qui amplifie l’expression des deux. Chaque fragment partagé est une portée organique pour l’auteur.' },
    { icon: '🎧', title: 'Norme de lecture multimodale', body: 'Lire et écouter comme une seule expérience, et non deux expériences parallèles. La synchronisation phrase par phrase comme infrastructure.' },
    { icon: '🧠', title: 'Réseau d’identité intellectuelle', body: 'Ce que vous lisez et partagez définit la façon dont le monde vous connaît. Le profil le plus authentique qui soit : bâti avec de vraies lectures.' },
  ],
  transformationLabel: 'La transformation',
  transformationTitle: 'Ce qui arrive à une personne qui utilise Noetia pendant six mois.',
  transformation: (
    <>
      <p>Imaginez une personne qui lit sur Noetia pendant six mois :</p>
      <p>Elle a lu les <em>Pensées pour moi-même</em>, <em>Un rien peut tout changer</em>, <em>Le Prince</em> et <em>Le Nouveau Testament</em>.</p>
      <p>Elle a surligné 140 fragments. Elle en a partagé 23.</p>
      <p>Son public a vu, à travers ces 23 fragments, qu’elle réfléchit au stoïcisme, à la productivité, au pouvoir et à la foi.</p>
      <p>Ce profil n’a pas été bâti avec un formulaire. Il a été bâti avec de vraies lectures et de vrais choix.</p>
      <p className="text-white font-semibold">Voilà le résultat de Noetia. Pas une bibliothèque. Une identité visible.</p>
    </>
  ),
  operationsTitle: 'Secteurs d’activité',
  operations: [
    'Produit grand public (Web et mobile)',
    'Plateforme de publication pour les auteurs et les maisons d’édition',
    'Communautés de lecture (clubs, Escucha Juntos)',
    'Partage de contenu — fragments visuels pour les réseaux sociaux',
    'Infrastructure éditoriale (révision, données d’analyse, droits)',
    'Impact social — Causas Noetia (programme prévu; partenariats en attente)',
  ],
  publishingTitle: 'Écosystème éditorial et modèle de revenus',
  publishing: (
    <>
      <p>Noetia agit comme canal de distribution numérique pour les auteurs et les maisons d’édition qui veulent rejoindre des lecteurs avec une expérience de lecture différente.</p>
      <p><strong>Ce que nous offrons aux auteurs :</strong></p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>Portail de publication avec révision éditoriale (3 à 5 jours ouvrables)</li>
        <li>Synchronisation texte-audio au moyen de fichiers SRT/VTT ou d’un traitement Whisper</li>
        <li>Données de lecture : fragments enregistrés, partages, temps de lecture</li>
        <li>Portée organique générée par les fragments que partagent les lecteurs</li>
      </ul>
    </>
  ),
  futureTitle: 'Croissance future',
  future: [
    'Élargissement du catalogue d’auteurs en espagnol et en anglais',
    'Outils de publication pour les maisons d’édition aux grands catalogues',
    'Extension des clubs aux événements d’auteurs et aux présentations en direct',
    'Expansion vers d’autres langues (portugais, catalan)',
    'API publique pour les établissements d’enseignement et les bibliothèques numériques',
  ],
  links: [
    { href: '/how-we-build', label: 'Ingénierie', cta: 'Notre façon de bâtir →' },
    { href: '/milestones', label: 'Progrès', cta: 'Ce que nous avons bâti →' },
    { href: '/upload-guide', label: 'Pour les auteurs', cta: 'Publier sur Noetia →' },
  ],
};

export const companyCopy: Localized<CompanyCopy> = { es, en, 'fr-CA': frCA };
