import type { EmailCopy } from './types';

/**
 * Canadian-French transactional copy — ENGINEERING DRAFT ONLY (NEM-025 B2-A1).
 *
 * Not human-reviewed and not approved. Unreachable at runtime: French is dispatched only when
 * FR_CA_TRANSACTIONAL_READY (code constant, ships `false`) AND FR_CA_ENABLED are both on (see ../locale.ts).
 *
 * Provisional conventions from the fr-CA terminology guide (PR #79), all pending PO decisions D-T1–D-T6:
 * "vous" register (D-T1), "jeton" for Token (D-T2), "Écoute active" (D-T3), "courriel", "forfait" for plan.
 * Québec punctuation: no space before ? ! ; a non-breaking space (U+00A0) before ":" and inside « ».
 * The farewell body is a faithful translation of the existing ES/EN data-erasure statement; it must not be
 * released before SP-1 or legal review (B2-D5).
 */
const NBSP = '\u00A0';
const jetons = (n: number) => (n <= 1 ? 'jeton' : 'jetons');

export const frCa = {
  common: {
    tagline: 'Lisez. Écoutez. Partagez.',
    rightsReserved: 'Tous droits réservés.',
    linkFallbackBrowser: `Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur${NBSP}:`,
    linkFallbackShort: `Si le bouton ne fonctionne pas, copiez ce lien${NBSP}:`,
  },
  confirmation: {
    subject: 'Confirmez votre compte Noetia',
    greeting: (name) => `Bienvenue, ${name}!`,
    body: 'Merci d’avoir créé votre compte. Confirmez votre adresse courriel pour commencer à lire, à écouter et à partager des fragments.',
    cta: 'Confirmer mon compte',
    expiry: 'Ce lien expire dans 24 heures. Si vous n’avez pas créé ce compte, vous pouvez ignorer ce courriel.',
  },
  passwordReset: {
    subject: 'Réinitialisez votre mot de passe Noetia',
    greeting: (name) => `Bonjour ${name},`,
    body: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte. Cliquez sur le bouton ci-dessous pour en créer un nouveau.',
    cta: 'Réinitialiser le mot de passe',
    expiry: `Ce lien expire dans 1 heure. Si vous n’avez pas demandé ce changement, vous pouvez ignorer ce courriel${NBSP}: votre mot de passe ne sera pas modifié.`,
  },
  farewell: {
    subject: 'Votre compte Noetia a été supprimé',
    greeting: (name) => `À bientôt, ${name}.`,
    body: 'Votre compte a bien été supprimé. Toutes vos données — fragments, bibliothèque et préférences — ont été effacées de nos systèmes.',
    registerAgain: (registerLink) =>
      `Si vous avez changé d’avis ou supprimé votre compte par erreur, vous pouvez vous réinscrire à tout moment sur ${registerLink}.`,
    thanks: 'Merci d’avoir fait partie de la communauté Noetia. Nous espérons vous revoir bientôt.',
  },
  waitlistConfirmation: {
    subject: 'Vous êtes sur la liste d’attente de Noetia!',
    heading: (name) => `Vous êtes sur la liste, ${name}!`,
    intro: 'Merci de votre intérêt pour Noetia. Nous sommes une plateforme de lecture synchronisée avec l’audio, qui permet aussi de créer des citations visuelles à partager sur les réseaux sociaux.',
    notify: 'Nous vous écrirons à cette adresse dès que votre accès bêta sera disponible. Vous n’avez rien d’autre à faire.',
    whatIs: 'Qu’est-ce que Noetia?',
    activeListening: 'Écoute active',
    activeListeningDesc: 'texte et audio synchronisés phrase par phrase.',
    fragments: 'Fragments',
    fragmentsDesc: 'saisissez les idées qui vous marquent le plus.',
    share: 'Partagez',
    shareDesc: 'créez des cartes visuelles pour LinkedIn, Instagram et plus encore.',
  },
  waitlistInvite: {
    subject: 'Votre accès à Noetia Bêta est prêt!',
    eyebrow: 'Accès bêta',
    heading: (name) => `Votre accès est prêt, ${name}`,
    body: 'Vous faites partie des premiers lecteurs à accéder à Noetia. Créez votre compte et commencez à lire avec le mode Écoute active.',
    cta: 'Créer mon compte →',
  },
  giftCard: {
    subject: (buyerName, tokenCount) => `${buyerName} vous offre ${tokenCount} ${jetons(tokenCount)} Noetia`,
    heading: (buyerName) => `<strong>${buyerName}</strong> vous offre un cadeau`,
    tokenLabel: (tokenCount) => (tokenCount <= 1 ? 'Jeton Noetia' : 'Jetons Noetia'),
    eachToken: 'Chaque jeton débloque un livre de votre choix',
    quote: (message) => `«${NBSP}${message}${NBSP}»`,
    cta: 'Réclamer mon cadeau →',
    validity: 'Ce cadeau est valide pendant 1 an.',
  },
  giftConfirmation: {
    subject: (recipientEmail) => `Votre cadeau Noetia a été envoyé à ${recipientEmail}`,
    heading: 'Votre cadeau a été envoyé! 🎁',
    body: (buyerName, tokenCount, recipientEmail) =>
      `Bonjour ${buyerName}, nous avons envoyé <strong>${tokenCount} ${jetons(tokenCount)} Noetia</strong> à <strong>${recipientEmail}</strong>. ` +
      (tokenCount <= 1
        ? 'Dès que la personne l’aura réclamé, elle pourra débloquer un livre de son choix.'
        : 'Dès que la personne les aura réclamés, elle pourra débloquer des livres de son choix.'),
    questions: (supportEmail) => `Des questions? Écrivez-nous à ${supportEmail}`,
  },
  planInvite: {
    subject: (inviterName, planName) => `${inviterName} vous invite à Noetia ${planName}`,
    heading: 'Une invitation à lire ensemble',
    body: (inviterName, planName) =>
      `<strong>${inviterName}</strong> vous invite à rejoindre son forfait <strong>${planName}</strong> sur Noetia. Avec ce forfait, vous partagez des jetons pour débloquer des livres, et chaque personne garde sa propre bibliothèque.`,
    cta: 'Accepter l’invitation →',
    expiry: 'Ce lien expire dans 48 heures. Si vous n’attendiez pas cette invitation, vous pouvez ignorer ce courriel.',
  },
} satisfies EmailCopy;
