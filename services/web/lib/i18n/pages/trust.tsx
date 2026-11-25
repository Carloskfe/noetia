import React from 'react';
import type { Localized } from './types';

// /trust page dictionary (NEM-025 B1-A). ES/EN moved verbatim; fr-CA DRAFT pending review.
// Legal-adjacent privacy/security statements: the French wording needs legal review before exposure.
// The legal agreements themselves (Terms, Privacy, Cookies) are NOT translated here.
export interface TrustCopy {
  label: string;
  heroTitle: string;
  heroBody: string;
  heroNote: string;
  privacyTitle: string;
  privacy: React.ReactNode;
  securityTitle: string;
  security: string[];
  controlTitle: string;
  controlIntro: string;
  controls: string[];
  reliabilityTitle: string;
  reliability: React.ReactNode;
  links: { href: string; label: string; cta: string }[];
}

const es: TrustCopy = {
  label: 'Privacidad, Seguridad y Confianza',
  heroTitle: 'Tu identidad intelectual es tuya.',
  heroBody: 'Los libros que lees, los pasajes que resaltas, las ideas que te definen — son tuyos. Noetia los hace visibles cuando tú lo decides, en la medida que tú decides.',
  heroNote: 'Eso no es marketing. Es el diseño de la plataforma.',
  privacyTitle: 'Privacidad de datos',
  privacy: (
    <>
      <p>Recopilamos los datos mínimos necesarios para que la plataforma funcione y para construir tu identidad intelectual <em>contigo</em> — nunca sin ti.</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>Correo electrónico y nombre para crear tu cuenta</li>
        <li>Progreso de lectura para sincronizar tu posición entre dispositivos</li>
        <li>Fragmentos guardados — tuyos, siempre, sin excepción</li>
        <li>Preferencias de idioma y notificaciones</li>
      </ul>
      <p>Los datos de lectura nunca se comparten con autores ni editoriales de forma individual. Los autores solo ven métricas agregadas y anónimas.</p>
      <p><strong>No vendemos datos. No construimos perfiles publicitarios. No monetizamos lo que piensas.</strong></p>
    </>
  ),
  securityTitle: 'Principios de seguridad',
  security: [
    'Contraseñas almacenadas con bcrypt (nunca en texto plano)',
    'Tokens JWT con expiración corta (15 minutos) y refresh tokens rotativos',
    'Tokens sociales cifrados con AES-256-CBC en Redis',
    'Comunicaciones cifradas con TLS en todos los endpoints',
    "Certificados SSL automáticos vía Let's Encrypt",
    'Firewall configurado — solo puertos 80, 443 y SSH expuestos',
    'fail2ban activo en acceso SSH',
  ],
  controlTitle: 'Tu control sobre tu identidad intelectual',
  controlIntro: 'Noetia está construida para que tú controles exactamente qué de tu identidad intelectual es visible — y para quién.',
  controls: [
    'Eliminar tu cuenta en cualquier momento — eliminación real, no desactivación',
    'Controlar qué datos son visibles para otros (progreso, biblioteca, perfil, fragmentos)',
    'Exportar tus fragmentos en cualquier momento',
    'Cambiar tu idioma sin perder ningún dato',
    'Leer en modo privado sin compartir fragmentos automáticamente',
  ],
  reliabilityTitle: 'Confiabilidad y uso responsable de la tecnología',
  reliability: (
    <>
      <p>Noetia corre en infraestructura dedicada con monitoreo continuo. Usamos Grafana + Prometheus para vigilar latencia, errores y salud de cada servicio. Monitoreo activo, alertas configuradas y el hábito de resolver problemas rápido.</p>
      <p>Usamos herramientas de IA en nuestro proceso de desarrollo. Lo que <strong>no</strong> hacemos: usar IA para generar contenido de libros, modificar textos de autores, o tomar decisiones de moderación sin revisión humana. El contenido de la plataforma es responsabilidad humana.</p>
      <p><strong>Propiedad de contenido:</strong> los autores conservan todos los derechos. Noetia recibe una licencia limitada para distribuir. Los fragmentos pertenecen al lector como cita, no como reproducción del texto completo.</p>
    </>
  ),
  links: [
    { href: '/legal/privacy', label: 'Legal', cta: 'Política de privacidad →' },
    { href: '/legal/terms', label: 'Legal', cta: 'Términos de uso →' },
    { href: '/contact', label: 'Contacto legal', cta: 'legal@noetia.app →' },
  ],
};

const en: TrustCopy = {
  label: 'Privacy, Security & Trust',
  heroTitle: 'Your intellectual identity is yours.',
  heroBody: 'The books you read, the passages you highlight, the ideas that define you — they are yours. Noetia makes them visible when you decide, to the extent you decide.',
  heroNote: 'That is not marketing. It is the design of the platform.',
  privacyTitle: 'Data privacy',
  privacy: (
    <>
      <p>We collect the minimum data necessary for the platform to work and to build your intellectual identity <em>with you</em> — never without you.</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>Email and name to create your account</li>
        <li>Reading progress to sync your position across devices</li>
        <li>Saved fragments — yours, always, without exception</li>
        <li>Language and notification preferences</li>
      </ul>
      <p>Reading data is never shared with authors or publishers on an individual basis. Authors only see aggregated, anonymous metrics.</p>
      <p><strong>We do not sell data. We do not build advertising profiles. We do not monetize what you think.</strong></p>
    </>
  ),
  securityTitle: 'Security principles',
  security: [
    'Passwords stored with bcrypt (never in plain text)',
    'JWT tokens with short expiry (15 minutes) and rotating refresh tokens',
    'Social tokens encrypted with AES-256-CBC in Redis',
    'TLS-encrypted communications on all endpoints',
    "Automatic SSL certificates via Let's Encrypt",
    'Configured firewall — only ports 80, 443, and SSH exposed',
    'fail2ban active on SSH access',
  ],
  controlTitle: 'Your control over your intellectual identity',
  controlIntro: 'Noetia is built so that you control exactly which of your intellectual identity is visible — and to whom.',
  controls: [
    'Delete your account at any time — real deletion, not deactivation',
    'Control which data is visible to others (progress, library, profile, fragments)',
    'Export your fragments at any time',
    'Change your language without losing any data',
    'Read in private mode without sharing fragments automatically',
  ],
  reliabilityTitle: 'Reliability and responsible use of technology',
  reliability: (
    <>
      <p>Noetia runs on dedicated infrastructure with continuous monitoring. We use Grafana + Prometheus to watch latency, errors, and health of each service. Active monitoring, configured alerts, and the habit of fixing problems quickly.</p>
      <p>We use AI tools in our development process. What we do <strong>not</strong> do: use AI to generate book content, modify author texts, or make moderation decisions without human review. Platform content is a human responsibility.</p>
      <p><strong>Content ownership:</strong> authors retain all rights. Noetia receives a limited license to distribute. Fragments belong to the reader as quotations — not as full-text reproduction.</p>
    </>
  ),
  links: [
    { href: '/legal/privacy', label: 'Legal', cta: 'Privacy policy →' },
    { href: '/legal/terms', label: 'Legal', cta: 'Terms of use →' },
    { href: '/contact', label: 'Legal contact', cta: 'legal@noetia.app →' },
  ],
};

const frCA: TrustCopy = {
  label: 'Confidentialité, sécurité et confiance',
  heroTitle: 'Votre identité intellectuelle vous appartient.',
  heroBody: 'Les livres que vous lisez, les passages que vous surlignez, les idées qui vous définissent — ils vous appartiennent. Noetia les rend visibles quand vous le décidez, dans la mesure où vous le décidez.',
  heroNote: 'Ce n’est pas du marketing. C’est la conception même de la plateforme.',
  privacyTitle: 'Confidentialité des données',
  privacy: (
    <>
      <p>Nous recueillons le minimum de données nécessaires au fonctionnement de la plateforme et pour bâtir votre identité intellectuelle <em>avec vous</em> — jamais sans vous.</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>Votre courriel et votre nom pour créer votre compte</li>
        <li>Votre progression de lecture pour synchroniser votre position d’un appareil à l’autre</li>
        <li>Vos fragments enregistrés — à vous, toujours, sans exception</li>
        <li>Vos préférences de langue et de notifications</li>
      </ul>
      <p>Les données de lecture ne sont jamais communiquées individuellement aux auteurs ni aux maisons d’édition. Les auteurs ne voient que des mesures agrégées et anonymes.</p>
      <p><strong>Nous ne vendons pas de données. Nous ne créons pas de profils publicitaires. Nous ne monétisons pas ce que vous pensez.</strong></p>
    </>
  ),
  securityTitle: 'Principes de sécurité',
  security: [
    'Mots de passe stockés avec bcrypt (jamais en texte clair)',
    'Jetons JWT à courte durée de validité (15 minutes) et jetons d’actualisation renouvelés',
    'Jetons des réseaux sociaux chiffrés avec AES-256-CBC dans Redis',
    'Communications chiffrées par TLS sur tous les points de terminaison',
    "Certificats SSL automatiques par l’intermédiaire de Let's Encrypt",
    'Pare-feu configuré — seuls les ports 80, 443 et SSH sont exposés',
    'fail2ban actif sur l’accès SSH',
  ],
  controlTitle: 'Votre contrôle sur votre identité intellectuelle',
  controlIntro: 'Noetia est conçue pour que vous contrôliez exactement quelle part de votre identité intellectuelle est visible — et pour qui.',
  controls: [
    'Supprimer votre compte en tout temps — une vraie suppression, pas une désactivation',
    'Contrôler quelles données sont visibles par les autres (progression, bibliothèque, profil, fragments)',
    'Exporter vos fragments en tout temps',
    'Changer de langue sans perdre aucune donnée',
    'Lire en mode privé sans partager automatiquement vos fragments',
  ],
  reliabilityTitle: 'Fiabilité et utilisation responsable de la technologie',
  reliability: (
    <>
      <p>Noetia fonctionne sur une infrastructure dédiée avec une surveillance continue. Nous utilisons Grafana et Prometheus pour surveiller la latence, les erreurs et l’état de chaque service. Surveillance active, alertes configurées et l’habitude de régler les problèmes rapidement.</p>
      <p>Nous utilisons des outils d’IA dans notre processus de développement. Ce que nous ne faisons <strong>pas</strong> : utiliser l’IA pour générer le contenu des livres, modifier les textes des auteurs ou prendre des décisions de modération sans révision humaine. Le contenu de la plateforme relève de la responsabilité humaine.</p>
      <p><strong>Propriété du contenu :</strong> les auteurs conservent tous leurs droits. Noetia reçoit une licence limitée de distribution. Les fragments appartiennent au lecteur à titre de citation — et non de reproduction du texte intégral.</p>
    </>
  ),
  links: [
    { href: '/legal/privacy', label: 'Juridique', cta: 'Politique de confidentialité →' },
    { href: '/legal/terms', label: 'Juridique', cta: 'Conditions d’utilisation →' },
    { href: '/contact', label: 'Contact juridique', cta: 'legal@noetia.app →' },
  ],
};

export const trustCopy: Localized<TrustCopy> = { es, en, 'fr-CA': frCA };
