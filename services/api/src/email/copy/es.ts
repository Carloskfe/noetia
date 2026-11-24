import type { EmailCopy } from './types';

/**
 * Spanish transactional copy. Extracted verbatim from the pre-B2 EmailService templates (NEM-025 B2-A1);
 * the golden master proves byte-identical output. Do not edit wording here without a listed, approved change.
 */
export const es = {
  common: {
    tagline: 'Lee. Escucha. Comparte.',
    rightsReserved: 'Todos los derechos reservados.',
    linkFallbackBrowser: 'Si el botón no funciona, copia este enlace en tu navegador:',
    linkFallbackShort: 'Si el botón no funciona, copia este enlace:',
  },
  confirmation: {
    subject: 'Confirma tu cuenta en Noetia',
    greeting: (name) => `¡Bienvenido/a, ${name}!`,
    body: 'Gracias por crear tu cuenta. Confirma tu dirección de correo para comenzar a leer, escuchar y compartir fragmentos.',
    cta: 'Confirmar mi cuenta',
    expiry: 'Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.',
  },
  passwordReset: {
    subject: 'Recupera tu contraseña en Noetia',
    greeting: (name) => `Hola, ${name}`,
    body: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva.',
    cta: 'Restablecer contraseña',
    expiry: 'Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje — tu contraseña no será modificada.',
  },
  farewell: {
    subject: 'Tu cuenta de Noetia ha sido eliminada',
    greeting: (name) => `Hasta pronto, ${name}.`,
    body: 'Tu cuenta ha sido eliminada correctamente. Todos tus datos — fragmentos, biblioteca y preferencias — han sido borrados de nuestros sistemas.',
    registerAgain: (registerLink) =>
      `Si cambiaste de opinión o eliminaste tu cuenta por error, puedes volver a registrarte en cualquier momento en ${registerLink}.`,
    thanks: 'Gracias por haber sido parte de la comunidad Noetia. Esperamos verte de nuevo.',
  },
  waitlistConfirmation: {
    subject: '¡Estás en la lista de espera de Noetia!',
    heading: (name) => `¡Ya estás en la lista, ${name}!`,
    intro: 'Gracias por tu interés en Noetia. Somos una plataforma de lectura sincronizada con audio y generación de citas visuales para compartir en redes sociales.',
    notify: 'Te avisaremos por este correo en cuanto tu acceso beta esté disponible. No necesitas hacer nada más.',
    whatIs: '¿Qué es Noetia?',
    activeListening: 'Escucha Activa',
    activeListeningDesc: 'texto y audio sincronizados frase por frase.',
    fragments: 'Fragmentos',
    fragmentsDesc: 'captura las ideas que más te impactan.',
    share: 'Comparte',
    shareDesc: 'crea tarjetas visuales para LinkedIn, Instagram y más.',
  },
  waitlistInvite: {
    subject: '¡Tu acceso a Noetia Beta está listo!',
    eyebrow: 'Acceso Beta',
    heading: (name) => `Tu acceso está listo, ${name}`,
    body: 'Eres uno de los primeros lectores en acceder a Noetia. Crea tu cuenta y empieza a leer con el modo de Escucha Activa.',
    cta: 'Crear mi cuenta →',
  },
  giftCard: {
    subject: (buyerName, tokenCount) => `${buyerName} te regala ${tokenCount} ${tokenCount === 1 ? 'token' : 'tokens'} en Noetia`,
    heading: (buyerName) => `<strong>${buyerName}</strong> te envía un regalo`,
    tokenLabel: (tokenCount) => (tokenCount === 1 ? 'Noetia Token' : 'Noetia Tokens'),
    eachToken: 'Cada token desbloquea un libro de tu elección',
    quote: (message) => `"${message}"`,
    cta: 'Reclamar mi regalo →',
    validity: 'Este regalo es válido por 1 año.',
  },
  giftConfirmation: {
    subject: (recipientEmail) => `Tu regalo de Noetia fue enviado a ${recipientEmail}`,
    heading: '¡Tu regalo fue enviado! 🎁',
    body: (buyerName, tokenCount, recipientEmail) =>
      `Hola ${buyerName}, enviamos <strong>${tokenCount} ${tokenCount === 1 ? 'token' : 'tokens'} Noetia</strong> a <strong>${recipientEmail}</strong>. Cuando los reclamen podrán desbloquear libros de su elección.`,
    questions: (supportEmail) => `¿Tienes preguntas? Escríbenos a ${supportEmail}`,
  },
  planInvite: {
    subject: (inviterName, planName) => `${inviterName} te invita a Noetia ${planName}`,
    heading: 'Te han invitado a leer juntos',
    body: (inviterName, planName) =>
      `<strong>${inviterName}</strong> te está invitando a unirte a su plan <strong>${planName}</strong> en Noetia. Con este plan comparten tokens para desbloquear libros, cada uno con su biblioteca personal.`,
    cta: 'Aceptar invitación →',
    expiry: 'Este enlace expira en 48 horas. Si no esperabas esta invitación, puedes ignorar este mensaje.',
  },
} satisfies EmailCopy;
