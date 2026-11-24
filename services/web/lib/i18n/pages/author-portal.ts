import type { Localized } from './types';

// Author portal /author (NEM-025 B1-A, B1-D1: included as a public-facing product workflow).
// ES moved verbatim from app/(admin)/author/page.tsx (previously Spanish for every interface language);
// EN and fr-CA added. fr-CA DRAFT pending review. Book-language options keep their native names, and
// French is intentionally not offered as an upload language (the French catalogue is governed by NEM-026).
export interface AuthorPortalCopy {
  title: string;
  subtitle: string;
  plan: (tier: string) => string;
  tiers: { basic: string; starter: string; pro: string };
  quotaUsage: (used: number, limit: number) => string;
  limitReached: string;
  activityTitle: string;
  readersLabel: string;
  sharesLabel: string;
  storageLabel: string;
  readers: (n: number) => string;
  shares: (n: number) => string;
  uploadTitle: string;
  uploadIntro: string;
  formatGuide: string;
  quotaFullTitle: string;
  quotaFullBody: [string, string, string];
  titleLabel: string;
  titlePlaceholder: string;
  authorLabel: string;
  authorPlaceholder: string;
  categoryLabel: string;
  select: string;
  categories: { leadership: string; 'personal-development': string; business: string; classic: string };
  languageLabel: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  isbnPlaceholder: string;
  filesLabel: string;
  cover: string;
  coverHint: string;
  text: string;
  textHint: string;
  audio: string;
  audioHint: string;
  syncToggle: (open: boolean) => string;
  recommended: string;
  syncHint: string;
  syncHowTo: string;
  syncFile: string;
  syncFileHint: string;
  courtesyQuestion: string;
  courtesyLabel: string;
  courtesyHint: string;
  uploadingFiles: string;
  uploadingPct: (pct: number) => string;
  processing: string;
  submit: string;
  submitError: (status?: number) => string;
  submitSuccess: (title: string) => string;
  myBooks: string;
  noBooks: string;
  noBooksNote: string;
  published: string;
  inReview: string;
  uploadSrt: string;
  uploading: string;
  srtSaved: string;
  srtError: string;
  helpTitle: string;
  helpBody: string;
  helpGuide: string;
}

const es: AuthorPortalCopy = {
  title: 'Portal de autores',
  subtitle: 'Publica tu libro, audiolibro o curso en Noetia y llega a miles de lectores.',
  plan: (tier) => `Plan ${tier}`,
  tiers: { basic: 'Básico', starter: 'Starter', pro: 'Pro' },
  quotaUsage: (used, limit) => `${used} de ${limit} libro${limit !== 1 ? 's' : ''} utilizado${used !== 1 ? 's' : ''}`,
  limitReached: 'Límite alcanzado',
  activityTitle: 'Actividad reciente',
  readersLabel: 'Lectores',
  sharesLabel: 'Compartidos',
  storageLabel: 'Almacenamiento',
  readers: (n) => `${n} lectores`,
  shares: (n) => `${n} compartidos`,
  uploadTitle: 'Subir nuevo libro',
  uploadIntro: 'Todos los libros pasan por revisión antes de publicarse.',
  formatGuide: 'Ver guía de formatos →',
  quotaFullTitle: 'Has alcanzado el límite de tu plan',
  quotaFullBody: ['Actualiza tu plan o introduce un ', 'código de cortesía', ' en el campo de abajo para publicar este libro.'],
  titleLabel: 'Título',
  titlePlaceholder: 'El nombre completo de tu libro',
  authorLabel: 'Autor',
  authorPlaceholder: 'Nombre completo del autor',
  categoryLabel: 'Categoría',
  select: 'Seleccionar…',
  categories: { leadership: 'Liderazgo', 'personal-development': 'Desarrollo Personal', business: 'Negocios', classic: 'Clásico' },
  languageLabel: 'Idioma',
  descriptionLabel: 'Descripción',
  descriptionPlaceholder: 'Breve descripción del libro para los lectores (2–4 oraciones).',
  isbnPlaceholder: '978-…  (opcional)',
  filesLabel: 'Archivos',
  cover: 'Portada',
  coverHint: 'JPG o PNG · Mínimo 800 × 1200 px (proporción 2:3) · Máx 5 MB',
  text: 'Texto del libro',
  textHint: '.txt preferido (UTF-8, párrafos separados por línea en blanco) · Máx 10 MB',
  audio: 'Audio de la narración',
  audioHint: 'MP3 o M4A · 128 kbps mínimo · Máx 500 MB · Sin música de fondo',
  syncToggle: (open) => `${open ? 'Ocultar' : 'Añadir'} sincronización texto-audio`,
  recommended: 'Recomendado',
  syncHint: 'Activa el resaltado frase por frase en Modo Escucha Activa.',
  syncHowTo: '¿Cómo crear el archivo?',
  syncFile: 'Archivo de sincronización',
  syncFileHint: 'SRT o WebVTT · Cada cue = una frase · Máx 2 MB',
  courtesyQuestion: '¿Tienes un código de cortesía?',
  courtesyLabel: 'Código de cortesía',
  courtesyHint: 'Un código válido te permite subir este libro sin que cuente contra tu cuota de plan.',
  uploadingFiles: 'Subiendo archivos…',
  uploadingPct: (pct) => `Subiendo… ${pct}%`,
  processing: 'Procesando…',
  submit: 'Enviar para revisión',
  submitError: (status) => `Error al enviar (${status || 'sin conexión'})`,
  submitSuccess: (title) => `"${title}" enviado correctamente. Te notificaremos cuando sea publicado (3–5 días hábiles).`,
  myBooks: 'Mis libros',
  noBooks: 'Aún no has enviado ningún libro.',
  noBooksNote: 'Cuando lo hagas aparecerá aquí.',
  published: 'Publicado',
  inReview: 'En revisión',
  uploadSrt: 'Subir sincronización SRT/VTT',
  uploading: 'Subiendo…',
  srtSaved: 'Sincronización guardada.',
  srtError: 'Error al subir',
  helpTitle: '¿Tienes preguntas?',
  helpBody: 'Revisa la guía de formatos o contáctanos directamente.',
  helpGuide: 'Guía de publicación',
};

const en: AuthorPortalCopy = {
  title: 'Author portal',
  subtitle: 'Publish your book, audiobook or course on Noetia and reach thousands of readers.',
  plan: (tier) => `${tier} plan`,
  tiers: { basic: 'Basic', starter: 'Starter', pro: 'Pro' },
  quotaUsage: (used, limit) => `${used} of ${limit} book${limit !== 1 ? 's' : ''} used`,
  limitReached: 'Limit reached',
  activityTitle: 'Recent activity',
  readersLabel: 'Readers',
  sharesLabel: 'Shares',
  storageLabel: 'Storage',
  readers: (n) => `${n} reader${n === 1 ? '' : 's'}`,
  shares: (n) => `${n} share${n === 1 ? '' : 's'}`,
  uploadTitle: 'Upload a new book',
  uploadIntro: 'Every book is reviewed before it is published.',
  formatGuide: 'See the format guide →',
  quotaFullTitle: 'You have reached your plan limit',
  quotaFullBody: ['Upgrade your plan or enter a ', 'courtesy code', ' in the field below to publish this book.'],
  titleLabel: 'Title',
  titlePlaceholder: 'The full title of your book',
  authorLabel: 'Author',
  authorPlaceholder: "The author's full name",
  categoryLabel: 'Category',
  select: 'Select…',
  categories: { leadership: 'Leadership', 'personal-development': 'Personal Development', business: 'Business', classic: 'Classic' },
  languageLabel: 'Language',
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'A short description of the book for readers (2–4 sentences).',
  isbnPlaceholder: '978-…  (optional)',
  filesLabel: 'Files',
  cover: 'Cover',
  coverHint: 'JPG or PNG · Minimum 800 × 1200 px (2:3 ratio) · Max 5 MB',
  text: 'Book text',
  textHint: '.txt preferred (UTF-8, paragraphs separated by a blank line) · Max 10 MB',
  audio: 'Narration audio',
  audioHint: 'MP3 or M4A · 128 kbps minimum · Max 500 MB · No background music',
  syncToggle: (open) => `${open ? 'Hide' : 'Add'} text-audio synchronization`,
  recommended: 'Recommended',
  syncHint: 'Turns on phrase-by-phrase highlighting in Active Listening mode.',
  syncHowTo: 'How do I create the file?',
  syncFile: 'Sync file',
  syncFileHint: 'SRT or WebVTT · Each cue = one sentence · Max 2 MB',
  courtesyQuestion: 'Do you have a courtesy code?',
  courtesyLabel: 'Courtesy code',
  courtesyHint: 'A valid code lets you upload this book without counting against your plan quota.',
  uploadingFiles: 'Uploading files…',
  uploadingPct: (pct) => `Uploading… ${pct}%`,
  processing: 'Processing…',
  submit: 'Submit for review',
  submitError: (status) => `Upload failed (${status || 'no connection'})`,
  submitSuccess: (title) => `"${title}" was submitted. We'll let you know when it is published (3–5 business days).`,
  myBooks: 'My books',
  noBooks: "You haven't submitted any books yet.",
  noBooksNote: 'When you do, they will appear here.',
  published: 'Published',
  inReview: 'In review',
  uploadSrt: 'Upload SRT/VTT sync',
  uploading: 'Uploading…',
  srtSaved: 'Sync saved.',
  srtError: 'Upload failed',
  helpTitle: 'Questions?',
  helpBody: 'Check the format guide or contact us directly.',
  helpGuide: 'Publishing guide',
};

const frCA: AuthorPortalCopy = {
  title: 'Portail des auteurs',
  subtitle: 'Publiez votre livre, votre livre audio ou votre cours sur Noetia et rejoignez des milliers de lecteurs.',
  plan: (tier) => `Forfait ${tier}`,
  tiers: { basic: 'Base', starter: 'Starter', pro: 'Pro' },
  quotaUsage: (used, limit) => `${used} livre${used > 1 ? 's' : ''} utilisé${used > 1 ? 's' : ''} sur ${limit}`,
  limitReached: 'Limite atteinte',
  activityTitle: 'Activité récente',
  readersLabel: 'Lecteurs',
  sharesLabel: 'Partages',
  storageLabel: 'Stockage',
  readers: (n) => `${n} lecteur${n > 1 ? 's' : ''}`,
  shares: (n) => `${n} partage${n > 1 ? 's' : ''}`,
  uploadTitle: 'Téléverser un nouveau livre',
  uploadIntro: 'Chaque livre est révisé avant sa publication.',
  formatGuide: 'Voir le guide des formats →',
  quotaFullTitle: 'Vous avez atteint la limite de votre forfait',
  quotaFullBody: ['Changez de forfait ou entrez un ', 'code de courtoisie', ' dans le champ ci-dessous pour publier ce livre.'],
  titleLabel: 'Titre',
  titlePlaceholder: 'Le titre complet de votre livre',
  authorLabel: 'Auteur',
  authorPlaceholder: 'Le nom complet de l’auteur',
  categoryLabel: 'Catégorie',
  select: 'Sélectionner…',
  categories: { leadership: 'Leadership', 'personal-development': 'Développement personnel', business: 'Affaires', classic: 'Classique' },
  languageLabel: 'Langue',
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'Une brève description du livre pour les lecteurs (2 à 4 phrases).',
  isbnPlaceholder: '978-…  (facultatif)',
  filesLabel: 'Fichiers',
  cover: 'Couverture',
  coverHint: 'JPG ou PNG · Minimum 800 × 1200 px (format 2:3) · Max. 5 Mo',
  text: 'Texte du livre',
  textHint: '.txt de préférence (UTF-8, paragraphes séparés par une ligne vide) · Max. 10 Mo',
  audio: 'Audio de la narration',
  audioHint: 'MP3 ou M4A · 128 kbit/s minimum · Max. 500 Mo · Sans musique de fond',
  syncToggle: (open) => `${open ? 'Masquer' : 'Ajouter'} la synchronisation texte-audio`,
  recommended: 'Recommandé',
  syncHint: 'Active le surlignage phrase par phrase en mode Écoute active.',
  syncHowTo: 'Comment créer le fichier?',
  syncFile: 'Fichier de synchronisation',
  syncFileHint: 'SRT ou WebVTT · Chaque repère = une phrase · Max. 2 Mo',
  courtesyQuestion: 'Vous avez un code de courtoisie?',
  courtesyLabel: 'Code de courtoisie',
  courtesyHint: 'Un code valide vous permet de téléverser ce livre sans qu’il soit compté dans le quota de votre forfait.',
  uploadingFiles: 'Téléversement des fichiers…',
  uploadingPct: (pct) => `Téléversement… ${pct} %`,
  processing: 'Traitement…',
  submit: 'Soumettre pour révision',
  submitError: (status) => `L’envoi a échoué (${status || 'aucune connexion'})`,
  submitSuccess: (title) => `« ${title} » a été soumis. Nous vous aviserons lorsqu’il sera publié (3 à 5 jours ouvrables).`,
  myBooks: 'Mes livres',
  noBooks: 'Vous n’avez encore soumis aucun livre.',
  noBooksNote: 'Lorsque vous le ferez, il apparaîtra ici.',
  published: 'Publié',
  inReview: 'En révision',
  uploadSrt: 'Téléverser la synchronisation SRT/VTT',
  uploading: 'Téléversement…',
  srtSaved: 'Synchronisation enregistrée.',
  srtError: 'Le téléversement a échoué',
  helpTitle: 'Vous avez des questions?',
  helpBody: 'Consultez le guide des formats ou écrivez-nous directement.',
  helpGuide: 'Guide de publication',
};

export const authorPortalCopy: Localized<AuthorPortalCopy> = { es, en, 'fr-CA': frCA };
