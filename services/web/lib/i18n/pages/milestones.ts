import type { Localized } from './types';

// /milestones page dictionary (NEM-025 B1-A). ES/EN moved verbatim; fr-CA DRAFT pending review.
// Causas Noetia keeps 2.22% (PO-053). Factual claims are translated as-is, not updated.
export interface MilestonesCopy {
  label: string;
  heroTitle: string;
  heroBody: string;
  milestonesTitle: string;
  milestones: { title: string; desc: string }[];
  aheadTitle: string;
  ahead: string[];
  productLabel: string;
  productCta: string;
  authorsLabel: string;
  authorsCta: string;
  contactLabel: string;
  contactCta: string;
}

const es: MilestonesCopy = {
  label: 'Del concepto a la categoría',
  heroTitle: 'Lo que hemos construido.',
  heroBody: 'Las categorías no aparecen con un anuncio. Se construyen funcionalidad por funcionalidad, hasta que el comportamiento se vuelve evidente.',
  milestonesTitle: 'Hitos de plataforma',
  milestones: [
    { title: 'Plataforma en producción', desc: 'Web y móvil en producción, accesibles en noetia.app.' },
    { title: 'Motor de sincronización frase por frase', desc: 'Sincronización texto-audio frase por frase implementada y operando en producción.' },
    { title: '56 migraciones de base de datos', desc: 'Schema completo: usuarios, libros, sync maps, fragmentos, suscripciones, clubes, stats, tokens y más.' },
    { title: 'Catálogo activo en español e inglés', desc: 'Biblioteca libre con clásicos de la literatura latinoamericana, títulos en inglés y la Biblia KJV.' },
    { title: 'Pipeline de sincronización Whisper', desc: 'Alineación texto-audio con Whisper, umbral de calidad del 85% de cobertura por libro.' },
    { title: 'Modelo de suscripción con tokens', desc: 'Tres planes (Individual / Duo / Familia) con sistema de tokens y Stripe integrado.' },
    { title: 'Clubes de lectura', desc: 'Clubes públicos y privados, discusiones ancladas al texto, sondeos, sesiones Escucha Juntos.' },
    { title: 'Causas Noetia', desc: 'Programa en preparación: el 2,22% de los ingresos netos elegibles, después de las comisiones de procesamiento de pago, incorporado al modelo financiero desde el inicio. Alianzas pendientes.' },
    { title: 'CI/CD operacional', desc: 'Deploy automático en cada push a main vía GitHub Actions con migrations automáticas.' },
    { title: 'Monitoreo continuo', desc: 'Grafana + Prometheus monitoreando latencia, errores y salud de contenedores en producción.' },
    { title: 'Tarjetas de fragmentos para redes sociales', desc: 'Generación de imágenes para compartir en LinkedIn, Instagram, Facebook y Pinterest.' },
    { title: 'App iOS y Android', desc: 'React Native con soporte offline, modo de escucha activa y selección de texto.' },
    { title: 'Categoría definida: Knowledge Expression Platform', desc: 'Noetia ha nombrado y construido la infraestructura de una categoría nueva. El trabajo que queda es completarla.' },
  ],
  aheadTitle: 'Lo que viene',
  ahead: [
    'Expansión del catálogo de autores en español e inglés',
    'Herramientas avanzadas para editoriales con catálogos grandes',
    'Extensión de Clubes a eventos y presentaciones de autores en vivo',
    'API pública para instituciones educativas y bibliotecas digitales',
    'Expansión a otros idiomas: portugués, catalán',
  ],
  productLabel: 'Producto',
  productCta: 'Usar la plataforma →',
  authorsLabel: 'Autores',
  authorsCta: 'Publicar un libro →',
  contactLabel: 'Contacto',
  contactCta: 'Hablar con el equipo →',
};

const en: MilestonesCopy = {
  label: 'From concept to category',
  heroTitle: 'What we have built.',
  heroBody: 'Categories do not appear with an announcement. They are built feature by feature, until the behavior becomes obvious.',
  milestonesTitle: 'Platform milestones',
  milestones: [
    { title: 'Production platform', desc: 'Web and mobile in production, accessible at noetia.app.' },
    { title: 'Phrase-by-phrase sync engine', desc: 'Phrase-by-phrase text-audio synchronization engine implemented and running in production.' },
    { title: '56 database migrations', desc: 'Complete schema: users, books, sync maps, fragments, subscriptions, clubs, stats, tokens, and more.' },
    { title: 'Active catalog in Spanish and English', desc: 'Free library with Latin American literary classics, English titles, and the KJV Bible.' },
    { title: 'Whisper sync pipeline', desc: 'Text-audio alignment with Whisper, 85% coverage quality threshold per book.' },
    { title: 'Token-based subscription model', desc: 'Three plans (Individual / Duo / Family) with token system and Stripe integrated.' },
    { title: 'Reading clubs', desc: 'Public and private clubs, text-anchored discussions, polls, Escucha Juntos live sessions.' },
    { title: 'Causas Noetia', desc: 'A planned program: 2.22% of eligible net receipts, after payment-processing fees, designed into the financial model from the start. Partnerships pending.' },
    { title: 'Operational CI/CD', desc: 'Automatic deploy on every push to main via GitHub Actions with automatic migrations.' },
    { title: 'Continuous monitoring', desc: 'Grafana + Prometheus monitoring latency, errors, and container health in production.' },
    { title: 'Fragment cards for social networks', desc: 'Image generation for sharing on LinkedIn, Instagram, Facebook, and Pinterest.' },
    { title: 'iOS and Android app', desc: 'React Native with offline support, active listening mode, and text selection.' },
    { title: 'Category defined: Knowledge Expression Platform', desc: 'Noetia has named and built the infrastructure of a new category. The work remaining is to complete it.' },
  ],
  aheadTitle: 'What is ahead',
  ahead: [
    'Author catalog expansion in Spanish and English',
    'Advanced tools for publishers with large catalogs',
    'Extension of Clubs to live author events and presentations',
    'Public API for educational institutions and digital libraries',
    'Expansion to other languages: Portuguese, Catalan',
  ],
  productLabel: 'Product',
  productCta: 'Use the platform →',
  authorsLabel: 'Authors',
  authorsCta: 'Publish a book →',
  contactLabel: 'Contact',
  contactCta: 'Talk to the team →',
};

const frCA: MilestonesCopy = {
  label: 'Du concept à la catégorie',
  heroTitle: 'Ce que nous avons bâti.',
  heroBody: 'Les catégories n’apparaissent pas avec une annonce. Elles se bâtissent fonctionnalité par fonctionnalité, jusqu’à ce que le comportement devienne évident.',
  milestonesTitle: 'Jalons de la plateforme',
  milestones: [
    { title: 'Plateforme en production', desc: 'Web et mobile en production, accessibles sur noetia.app.' },
    { title: 'Moteur de synchronisation phrase par phrase', desc: 'Synchronisation texte-audio phrase par phrase mise en place et en fonctionnement en production.' },
    { title: '56 migrations de base de données', desc: 'Schéma complet : utilisateurs, livres, cartes de synchronisation, fragments, abonnements, clubs, statistiques, jetons et plus.' },
    { title: 'Catalogue actif en espagnol et en anglais', desc: 'Bibliothèque gratuite avec des classiques de la littérature latino-américaine, des titres en anglais et la Bible King James.' },
    { title: 'Chaîne de synchronisation Whisper', desc: 'Alignement texte-audio avec Whisper, seuil de qualité de 85 % de couverture par livre.' },
    { title: 'Modèle d’abonnement à jetons', desc: 'Trois forfaits (Individuel / Duo / Famille) avec un système de jetons et Stripe intégré.' },
    { title: 'Clubs de lecture', desc: 'Clubs publics et privés, discussions ancrées dans le texte, sondages, séances Escucha Juntos.' },
    { title: 'Causas Noetia', desc: 'Programme prévu : 2,22 % des recettes nettes admissibles, après les frais de traitement des paiements, intégré au modèle financier dès le départ. Partenariats en attente.' },
    { title: 'CI/CD opérationnel', desc: 'Déploiement automatique à chaque envoi sur la branche main au moyen de GitHub Actions, avec migrations automatiques.' },
    { title: 'Surveillance continue', desc: 'Grafana et Prometheus surveillent la latence, les erreurs et l’état des conteneurs en production.' },
    { title: 'Cartes de fragments pour les réseaux sociaux', desc: 'Génération d’images à partager sur LinkedIn, Instagram, Facebook et Pinterest.' },
    { title: 'Application iOS et Android', desc: 'React Native avec prise en charge hors ligne, mode Écoute active et sélection de texte.' },
    { title: 'Catégorie définie : plateforme d’expression du savoir', desc: 'Noetia a nommé et bâti l’infrastructure d’une nouvelle catégorie. Il reste à la compléter.' },
  ],
  aheadTitle: 'Ce qui s’en vient',
  ahead: [
    'Élargissement du catalogue d’auteurs en espagnol et en anglais',
    'Outils avancés pour les maisons d’édition aux grands catalogues',
    'Extension des clubs aux événements et présentations d’auteurs en direct',
    'API publique pour les établissements d’enseignement et les bibliothèques numériques',
    'Expansion vers d’autres langues : portugais, catalan',
  ],
  productLabel: 'Produit',
  productCta: 'Utiliser la plateforme →',
  authorsLabel: 'Auteurs',
  authorsCta: 'Publier un livre →',
  contactLabel: 'Contact',
  contactCta: 'Parler à l’équipe →',
};

export const milestonesCopy: Localized<MilestonesCopy> = { es, en, 'fr-CA': frCA };
