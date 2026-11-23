import React from 'react';
import type { Localized } from './types';

// /upload-guide page dictionary (NEM-025 B1-A). ES/EN moved verbatim from
// app/(library)/upload-guide/content.tsx; fr-CA DRAFT pending qualified Canadian-French review.
// Spec values that were shown in English to Spanish readers stay unchanged in ES (no silent change).
type SpecRow = { label: string; value: string; highlight?: boolean };
type FaqItem = { q: string; a: string };

export interface UploadGuideCopy {
  tipLabel: string;
  warnLabel: string;
  back: string;
  title: string;
  intro: string;
  checklistTitle: string;
  checklist: string[];
  processTitle: string;
  steps: { n: string; title: string; desc: string }[];
  processNote: React.ReactNode;
  textTitle: string;
  textSpecs: SpecRow[];
  textStructureTitle: string;
  textStructure: React.ReactNode;
  textExample: React.ReactNode;
  textTip: string;
  coverTitle: string;
  coverSpecs: SpecRow[];
  coverTip: React.ReactNode;
  coverWarning: string;
  audioTitle: string;
  audioSpecs: SpecRow[];
  audioRecTitle: string;
  audioRec: React.ReactNode;
  audioTip: React.ReactNode;
  syncTitle: string;
  syncBadge: string;
  syncIntro: React.ReactNode;
  syncSpecs: SpecRow[];
  syncHowTitle: string;
  optionATitle: string;
  optionASteps: React.ReactNode;
  optionBTitle: string;
  optionBSteps: React.ReactNode;
  optionBNote: string;
  srtExampleTitle: string;
  srtExampleComment: string;
  srtLines: [string, string, string];
  vttNote: React.ReactNode;
  syncWarning: string;
  faqTitle: string;
  faq: FaqItem[];
  ctaTitle: string;
  ctaBody: string;
  ctaPortal: string;
  ctaContact: string;
}

const kbd = 'bg-gray-100 px-1 rounded text-xs';

const es: UploadGuideCopy = {
  tipLabel: 'Consejo:',
  warnLabel: 'Importante:',
  back: 'Portal de autores',
  title: 'Guía de publicación',
  intro: 'Esta guía cubre todo lo que necesitas para publicar tu libro en Noetia — desde los formatos de archivo hasta la sincronización texto-audio. Preparar bien tus archivos desde el principio evita retrasos en la revisión.',
  checklistTitle: 'Lista de verificación rápida',
  checklist: [
    '✓  Texto en .txt, codificación UTF-8',
    '✓  Portada JPG/PNG, mín. 800×1200 px',
    '✓  Audio MP3 o M4A, sin música de fondo',
    '✓  Archivo SRT/VTT para sincronización (opcional)',
    '✓  Sin numeración de páginas en el texto',
    '✓  Sin eco ni ruido en el audio',
  ],
  processTitle: '¿Cómo funciona el proceso?',
  steps: [
    { n: '1', title: 'Prepara tus archivos', desc: 'Texto, portada, audio y opcionalmente un archivo de sincronización SRT o VTT.' },
    { n: '2', title: 'Sube tu libro', desc: 'Completa el formulario en el portal de autores. Si tienes audio, añade también el archivo de sincronización para activar el modo Escucha Activa.' },
    { n: '3', title: 'Revisión editorial', desc: 'Nuestro equipo revisa el contenido para garantizar calidad. El proceso tarda entre 3 y 5 días hábiles.' },
    { n: '4', title: 'Publicación', desc: 'Recibirás un email de confirmación y tu libro quedará disponible para lectores de toda Latinoamérica.' },
  ],
  processNote: <>¿Olvidaste subir el archivo de sincronización? Puedes añadirlo en cualquier momento desde la sección <strong>Mis libros</strong> en el portal de autores, incluso después de la publicación.</>,
  textTitle: 'Texto del libro',
  textSpecs: [
    { label: 'Formato recomendado', value: '.txt (plain text)', highlight: true },
    { label: 'Formatos alternativos', value: '.epub, .pdf' },
    { label: 'Codificación', value: 'UTF-8 (required)' },
    { label: 'Tamaño máximo', value: '10 MB' },
  ],
  textStructureTitle: 'Cómo estructurar el texto',
  textStructure: (
    <>
      <li>Separa los párrafos con <strong>una línea en blanco</strong>.</li>
      <li>Los capítulos deben ir en su propia línea, en <strong>MAYÚSCULAS</strong> o precedidos de la palabra <strong>CAPÍTULO</strong>.</li>
      <li>Elimina numeración de páginas, encabezados, pies de página y tablas de contenido.</li>
      <li>Si el libro tiene notas al pie, ponlas al final del capítulo entre corchetes: <code className="bg-gray-100 px-1 rounded text-xs">[Nota: texto]</code>.</li>
    </>
  ),
  textExample: (
    <>
      <div className="text-gray-400 mb-2"># Estructura correcta</div>
      <div>CAPÍTULO I — El comienzo</div>
      <div>&nbsp;</div>
      <div>Era una noche oscura y tormentosa. El viento</div>
      <div>azotaba las ventanas del viejo caserón.</div>
      <div>&nbsp;</div>
      <div>Don Rodrigo no podía dormir. Se levantó y</div>
      <div>caminó hasta la ventana para contemplar la tormenta.</div>
    </>
  ),
  textTip: 'Si tu manuscrito está en Word (.docx), guárdalo como "Texto sin formato" (.txt) y asegúrate de seleccionar codificación UTF-8 en el cuadro de diálogo de guardado.',
  coverTitle: 'Imagen de portada',
  coverSpecs: [
    { label: 'Formatos', value: 'JPG or PNG', highlight: true },
    { label: 'Dimensiones mínimas', value: '800 × 1200 px (2:3 ratio)' },
    { label: 'Dimensiones recomendadas', value: '1600 × 2400 px' },
    { label: 'Tamaño máximo', value: '5 MB' },
    { label: 'Fondo', value: 'Sin transparencia (sin canal alpha)' },
  ],
  coverTip: <>La portada se muestra como miniatura de <strong>120 × 180 px</strong> en los listados de la app. Asegúrate de que el título y el nombre del autor sean legibles a ese tamaño. Evita texto muy pequeño y fondos con poco contraste.</>,
  coverWarning: 'No uses imágenes con copyright sin licencia. Noetia verificará que tengas los derechos sobre la portada durante la revisión editorial.',
  audioTitle: 'Audio de la narración',
  audioSpecs: [
    { label: 'Formato recomendado', value: 'MP3 (recommended)', highlight: true },
    { label: 'Formatos alternativos', value: 'M4A / AAC' },
    { label: 'Bitrate mínimo', value: '128 kbps' },
    { label: 'Bitrate recomendado', value: '192 kbps' },
    { label: 'Frecuencia de muestreo', value: '44,100 Hz or 48,000 Hz' },
    { label: 'Canales', value: 'Mono o estéreo' },
    { label: 'Tamaño máximo', value: '500 MB por archivo' },
  ],
  audioRecTitle: 'Recomendaciones de grabación',
  audioRec: (
    <>
      <li>Graba en un espacio sin eco: un armario con ropa o una habitación con alfombra funcionan bien.</li>
      <li>Deja <strong>0,5 segundos de silencio</strong> al inicio y al final del archivo.</li>
      <li><strong>Sin música de fondo</strong> — interfiere con el sistema de sincronización frase por frase.</li>
      <li>Si el libro supera <strong>2 horas</strong>, puedes dividirlo en archivos por capítulo y subirlos uno a uno.</li>
      <li>Normaliza el volumen a <strong>−14 LUFS</strong> para garantizar calidad de escucha uniforme.</li>
    </>
  ),
  audioTip: <>Audacity (gratuito) puede normalizar el volumen y exportar a MP3 192 kbps. Usa <em>Tracks → Mix → Mix and Render</em> y luego <em>Effect → Loudness Normalization → −14 LUFS</em>.</>,
  syncTitle: 'Sincronización texto-audio (SRT/VTT)',
  syncBadge: 'Recomendado',
  syncIntro: <>Este archivo activa el <strong>Modo Escucha Activa</strong>: cada frase del libro se resalta automáticamente mientras el audio la narra. Es la funcionalidad diferenciadora de Noetia y mejora significativamente la retención del lector.</>,
  syncSpecs: [
    { label: 'Formatos', value: 'SRT (.srt) or WebVTT (.vtt)', highlight: true },
    { label: 'Codificación', value: 'UTF-8' },
    { label: 'Tamaño máximo', value: '2 MB' },
    { label: 'Regla de oro', value: 'Cada entrada = una frase del libro' },
  ],
  syncHowTitle: 'Cómo crear el archivo de sincronización',
  optionATitle: 'Opción recomendada: Subtitle Edit (Windows, gratis)',
  optionASteps: (
    <>
      <li>Abre Subtitle Edit y carga tu archivo de audio (<em>Video → Open Video</em>).</li>
      <li>Escucha el audio y para cada frase: pulsa <kbd className={kbd}>F9</kbd> al inicio y <kbd className={kbd}>F10</kbd> al final.</li>
      <li>Escribe el texto de la frase en el campo de texto.</li>
      <li>Repite para cada frase del libro.</li>
      <li>Exporta: <em>File → Save As</em> → elige formato SRT.</li>
    </>
  ),
  optionBTitle: 'Opción rápida: Descript (transcripción automática)',
  optionBSteps: (
    <>
      <li>Sube tu audio a Descript y déjalo transcribir automáticamente.</li>
      <li>Corrige el texto para que coincida exactamente con el libro.</li>
      <li>Exporta: <em>File → Export → SRT Captions</em>.</li>
    </>
  ),
  optionBNote: 'La transcripción automática no es perfecta — revisa siempre el resultado antes de exportar.',
  srtExampleTitle: 'Ejemplo de formato SRT',
  srtExampleComment: '# bloque = número + tiempos + texto + línea en blanco',
  srtLines: ['Era una noche oscura y tormentosa.', 'El viento azotaba las ventanas del caserón.', 'Don Rodrigo no podía dormir.'],
  vttNote: <>El formato WebVTT es igual pero usa punto (.) en los milisegundos y empieza con la línea <code className="bg-gray-100 px-1 rounded">WEBVTT</code>.</>,
  syncWarning: 'Los tiempos del SRT deben coincidir con el archivo de audio que subas. Si grabas de nuevo, necesitarás actualizar el SRT también.',
  faqTitle: 'Preguntas frecuentes',
  faq: [
    { q: '¿Puedo subir el libro primero y el SRT después?', a: 'Sí. Desde la sección "Mis libros" en el portal hay un botón "Subir sincronización SRT/VTT" para cada libro. Puedes añadirla en cualquier momento, incluso después de que el libro esté publicado.' },
    { q: '¿Qué pasa si mi texto tiene errores tipográficos en el SRT?', a: 'Noetia usa el texto del archivo .txt como fuente de verdad para la lectura. El SRT solo controla los tiempos de sincronización — un pequeño error de tipeo en el SRT no afecta el texto visible.' },
    { q: '¿En cuánto tiempo revisan mi libro?', a: 'El proceso de revisión tarda entre 3 y 5 días hábiles. Recibirás un email cuando tu libro esté publicado o si necesitamos que corrijas algo.' },
    { q: '¿Puedo actualizar el contenido después de publicar?', a: 'Puedes actualizar el archivo de sincronización en cualquier momento. Para cambios en el texto o el audio, contáctanos a autores@noetia.app — lo revisamos caso a caso.' },
    { q: '¿El audio es obligatorio?', a: 'No. Puedes publicar solo con texto y portada. El audio y la sincronización son opcionales pero mejoran significativamente la experiencia del lector.' },
    { q: '¿Qué formatos de audio NO están permitidos?', a: 'No aceptamos WAV, FLAC ni OGG. Convierte a MP3 192 kbps antes de subir. Audacity o cualquier editor de audio puede hacerlo gratis.' },
  ],
  ctaTitle: '¿Listo para publicar?',
  ctaBody: 'Nuestro equipo está disponible para ayudarte en cada paso del proceso.',
  ctaPortal: 'Ir al portal de autores',
  ctaContact: 'Contactar al equipo',
};

const en: UploadGuideCopy = {
  tipLabel: 'Tip:',
  warnLabel: 'Important:',
  back: 'Author portal',
  title: 'Publishing Guide',
  intro: 'This guide covers everything you need to publish your book on Noetia — from file formats to text-audio synchronization. Preparing your files properly from the start avoids review delays.',
  checklistTitle: 'Quick checklist',
  checklist: [
    '✓  Text as .txt, UTF-8 encoding',
    '✓  Cover JPG/PNG, min. 800×1200 px',
    '✓  Audio MP3 or M4A, no background music',
    '✓  SRT/VTT file for sync (optional)',
    '✓  No page numbers in the text',
    '✓  No echo or noise in the audio',
  ],
  processTitle: 'How does the process work?',
  steps: [
    { n: '1', title: 'Prepare your files', desc: 'Text, cover, audio, and optionally an SRT or VTT sync file.' },
    { n: '2', title: 'Upload your book', desc: 'Fill out the form in the author portal. If you have audio, also add the sync file to activate Active Listening mode.' },
    { n: '3', title: 'Editorial review', desc: 'Our team reviews the content to ensure quality. The process takes 3–5 business days.' },
    { n: '4', title: 'Publication', desc: 'You will receive a confirmation email and your book will be available to readers across Latin America.' },
  ],
  processNote: <>Forgot to upload the sync file? You can add it at any time from the <strong>My Books</strong> section in the author portal, even after publication.</>,
  textTitle: 'Book text',
  textSpecs: [
    { label: 'Recommended format', value: '.txt (plain text)', highlight: true },
    { label: 'Alternative formats', value: '.epub, .pdf' },
    { label: 'Encoding', value: 'UTF-8 (required)' },
    { label: 'Maximum size', value: '10 MB' },
  ],
  textStructureTitle: 'How to structure the text',
  textStructure: (
    <>
      <li>Separate paragraphs with <strong>a blank line</strong>.</li>
      <li>Chapters should be on their own line, in <strong>ALL CAPS</strong> or preceded by the word <strong>CHAPTER</strong>.</li>
      <li>Remove page numbers, headers, footers, and tables of contents.</li>
      <li>If the book has footnotes, place them at the end of the chapter in brackets: <code className="bg-gray-100 px-1 rounded text-xs">[Note: text]</code>.</li>
    </>
  ),
  textExample: (
    <>
      <div className="text-gray-400 mb-2"># Correct structure</div>
      <div>CHAPTER I — The Beginning</div>
      <div>&nbsp;</div>
      <div>It was a dark and stormy night. The wind</div>
      <div>rattled the windows of the old manor.</div>
      <div>&nbsp;</div>
      <div>Don Rodrigo could not sleep. He got up and</div>
      <div>walked to the window to watch the storm.</div>
    </>
  ),
  textTip: 'If your manuscript is in Word (.docx), save it as "Plain Text" (.txt) and make sure to select UTF-8 encoding in the save dialog.',
  coverTitle: 'Cover image',
  coverSpecs: [
    { label: 'Formats', value: 'JPG or PNG', highlight: true },
    { label: 'Minimum dimensions', value: '800 × 1200 px (2:3 ratio)' },
    { label: 'Recommended dimensions', value: '1600 × 2400 px' },
    { label: 'Maximum size', value: '5 MB' },
    { label: 'Background', value: 'No transparency (no alpha channel)' },
  ],
  coverTip: <>The cover is displayed as a <strong>120 × 180 px</strong> thumbnail in app listings. Make sure the title and author name are readable at that size. Avoid very small text and low-contrast backgrounds.</>,
  coverWarning: 'Do not use copyrighted images without a license. Noetia will verify that you hold the rights to the cover during the editorial review.',
  audioTitle: 'Narration audio',
  audioSpecs: [
    { label: 'Recommended format', value: 'MP3 (recommended)', highlight: true },
    { label: 'Alternative formats', value: 'M4A / AAC' },
    { label: 'Minimum bitrate', value: '128 kbps' },
    { label: 'Recommended bitrate', value: '192 kbps' },
    { label: 'Sample rate', value: '44,100 Hz or 48,000 Hz' },
    { label: 'Channels', value: 'Mono or stereo' },
    { label: 'Maximum size', value: '500 MB per file' },
  ],
  audioRecTitle: 'Recording recommendations',
  audioRec: (
    <>
      <li>Record in an echo-free space: a closet with clothes or a carpeted room work well.</li>
      <li>Leave <strong>0.5 seconds of silence</strong> at the start and end of the file.</li>
      <li><strong>No background music</strong> — it interferes with the phrase-by-phrase sync system.</li>
      <li>If the book is longer than <strong>2 hours</strong>, you can split it into chapter files and upload them one by one.</li>
      <li>Normalize the volume to <strong>−14 LUFS</strong> for consistent listening quality.</li>
    </>
  ),
  audioTip: <>Audacity (free) can normalize volume and export to MP3 192 kbps. Use <em>Tracks → Mix → Mix and Render</em> then <em>Effect → Loudness Normalization → −14 LUFS</em>.</>,
  syncTitle: 'Text-audio synchronization (SRT/VTT)',
  syncBadge: 'Recommended',
  syncIntro: <>This file activates <strong>Active Listening Mode</strong>: each phrase of the book highlights automatically as the audio narrates it. It is Noetia&apos;s differentiating feature and significantly improves reader retention.</>,
  syncSpecs: [
    { label: 'Formats', value: 'SRT (.srt) or WebVTT (.vtt)', highlight: true },
    { label: 'Encoding', value: 'UTF-8' },
    { label: 'Maximum size', value: '2 MB' },
    { label: 'Golden rule', value: 'Each entry = one sentence from the book' },
  ],
  syncHowTitle: 'How to create the sync file',
  optionATitle: 'Recommended option: Subtitle Edit (Windows, free)',
  optionASteps: (
    <>
      <li>Open Subtitle Edit and load your audio file (<em>Video → Open Video</em>).</li>
      <li>Listen to the audio and for each sentence: press <kbd className={kbd}>F9</kbd> at the start and <kbd className={kbd}>F10</kbd> at the end.</li>
      <li>Type the sentence text in the text field.</li>
      <li>Repeat for every sentence in the book.</li>
      <li>Export: <em>File → Save As</em> → choose SRT format.</li>
    </>
  ),
  optionBTitle: 'Quick option: Descript (automatic transcription)',
  optionBSteps: (
    <>
      <li>Upload your audio to Descript and let it transcribe automatically.</li>
      <li>Correct the text to match the book exactly.</li>
      <li>Export: <em>File → Export → SRT Captions</em>.</li>
    </>
  ),
  optionBNote: 'Automatic transcription is not perfect — always review the result before exporting.',
  srtExampleTitle: 'SRT format example',
  srtExampleComment: '# block = number + timestamps + text + blank line',
  srtLines: ['It was a dark and stormy night.', 'The wind rattled the windows of the manor.', 'Don Rodrigo could not sleep.'],
  vttNote: <>WebVTT format is the same but uses a period (.) for milliseconds and starts with the line <code className="bg-gray-100 px-1 rounded">WEBVTT</code>.</>,
  syncWarning: 'SRT timestamps must match the audio file you upload. If you re-record, you will need to update the SRT as well.',
  faqTitle: 'Frequently asked questions',
  faq: [
    { q: 'Can I upload the book first and the SRT later?', a: 'Yes. In the "My Books" section of the portal there is an "Upload SRT/VTT sync" button for each book. You can add it at any time, even after the book is published.' },
    { q: 'What happens if my SRT has typos?', a: 'Noetia uses the .txt file as the source of truth for the reading text. The SRT only controls sync timestamps — a small typo in the SRT does not affect the visible text.' },
    { q: 'How long does the review take?', a: 'The review process takes 3–5 business days. You will receive an email when your book is published or if we need you to correct something.' },
    { q: 'Can I update the content after publishing?', a: 'You can update the sync file at any time. For changes to the text or audio, contact us at autores@noetia.app — we review each case individually.' },
    { q: 'Is audio required?', a: 'No. You can publish with text and cover only. Audio and synchronization are optional but significantly improve the reader experience.' },
    { q: 'What audio formats are NOT accepted?', a: 'We do not accept WAV, FLAC, or OGG. Convert to MP3 192 kbps before uploading. Audacity or any audio editor can do this for free.' },
  ],
  ctaTitle: 'Ready to publish?',
  ctaBody: 'Our team is available to help you at every step of the process.',
  ctaPortal: 'Go to author portal',
  ctaContact: 'Contact the team',
};

const frCA: UploadGuideCopy = {
  tipLabel: 'Conseil :',
  warnLabel: 'Important :',
  back: 'Portail des auteurs',
  title: 'Guide de publication',
  intro: 'Ce guide présente tout ce qu’il vous faut pour publier votre livre sur Noetia — des formats de fichier à la synchronisation texte-audio. Bien préparer vos fichiers dès le départ évite des retards lors de la révision.',
  checklistTitle: 'Liste de vérification rapide',
  checklist: [
    '✓  Texte en .txt, encodage UTF-8',
    '✓  Couverture JPG/PNG, min. 800 × 1200 px',
    '✓  Audio MP3 ou M4A, sans musique de fond',
    '✓  Fichier SRT/VTT pour la synchronisation (facultatif)',
    '✓  Aucune numérotation de pages dans le texte',
    '✓  Aucun écho ni bruit dans l’audio',
  ],
  processTitle: 'Comment fonctionne le processus?',
  steps: [
    { n: '1', title: 'Préparez vos fichiers', desc: 'Texte, couverture, audio et, au besoin, un fichier de synchronisation SRT ou VTT.' },
    { n: '2', title: 'Téléversez votre livre', desc: 'Remplissez le formulaire dans le portail des auteurs. Si vous avez de l’audio, ajoutez aussi le fichier de synchronisation pour activer le mode Écoute active.' },
    { n: '3', title: 'Révision éditoriale', desc: 'Notre équipe révise le contenu pour en garantir la qualité. Le processus prend de 3 à 5 jours ouvrables.' },
    { n: '4', title: 'Publication', desc: 'Vous recevrez un courriel de confirmation et votre livre sera offert aux lecteurs de toute l’Amérique latine.' },
  ],
  processNote: <>Vous avez oublié de téléverser le fichier de synchronisation? Vous pouvez l’ajouter en tout temps depuis la section <strong>Mes livres</strong> du portail des auteurs, même après la publication.</>,
  textTitle: 'Texte du livre',
  textSpecs: [
    { label: 'Format recommandé', value: '.txt (texte brut)', highlight: true },
    { label: 'Autres formats', value: '.epub, .pdf' },
    { label: 'Encodage', value: 'UTF-8 (obligatoire)' },
    { label: 'Taille maximale', value: '10 Mo' },
  ],
  textStructureTitle: 'Comment structurer le texte',
  textStructure: (
    <>
      <li>Séparez les paragraphes par <strong>une ligne vide</strong>.</li>
      <li>Chaque chapitre doit figurer sur sa propre ligne, en <strong>MAJUSCULES</strong> ou précédé du mot <strong>CHAPITRE</strong>.</li>
      <li>Supprimez la numérotation des pages, les en-têtes, les pieds de page et les tables des matières.</li>
      <li>Si le livre contient des notes de bas de page, placez-les à la fin du chapitre, entre crochets : <code className="bg-gray-100 px-1 rounded text-xs">[Note : texte]</code>.</li>
    </>
  ),
  textExample: (
    <>
      <div className="text-gray-400 mb-2"># Structure correcte</div>
      <div>CHAPITRE I — Le commencement</div>
      <div>&nbsp;</div>
      <div>C’était une nuit sombre et orageuse. Le vent</div>
      <div>secouait les fenêtres du vieux manoir.</div>
      <div>&nbsp;</div>
      <div>Don Rodrigo n’arrivait pas à dormir. Il se leva et</div>
      <div>marcha jusqu’à la fenêtre pour contempler l’orage.</div>
    </>
  ),
  textTip: 'Si votre manuscrit est en format Word (.docx), enregistrez-le en « Texte brut » (.txt) et veillez à choisir l’encodage UTF-8 dans la boîte de dialogue d’enregistrement.',
  coverTitle: 'Image de couverture',
  coverSpecs: [
    { label: 'Formats', value: 'JPG ou PNG', highlight: true },
    { label: 'Dimensions minimales', value: '800 × 1200 px (format 2:3)' },
    { label: 'Dimensions recommandées', value: '1600 × 2400 px' },
    { label: 'Taille maximale', value: '5 Mo' },
    { label: 'Arrière-plan', value: 'Sans transparence (sans couche alpha)' },
  ],
  coverTip: <>La couverture s’affiche en vignette de <strong>120 × 180 px</strong> dans les listes de l’application. Assurez-vous que le titre et le nom de l’auteur sont lisibles à cette taille. Évitez les textes trop petits et les arrière-plans peu contrastés.</>,
  coverWarning: 'N’utilisez pas d’images protégées par le droit d’auteur sans licence. Noetia vérifiera que vous détenez les droits sur la couverture lors de la révision éditoriale.',
  audioTitle: 'Audio de la narration',
  audioSpecs: [
    { label: 'Format recommandé', value: 'MP3 (recommandé)', highlight: true },
    { label: 'Autres formats', value: 'M4A / AAC' },
    { label: 'Débit binaire minimal', value: '128 kbit/s' },
    { label: 'Débit binaire recommandé', value: '192 kbit/s' },
    { label: 'Fréquence d’échantillonnage', value: '44 100 Hz ou 48 000 Hz' },
    { label: 'Canaux', value: 'Mono ou stéréo' },
    { label: 'Taille maximale', value: '500 Mo par fichier' },
  ],
  audioRecTitle: 'Recommandations pour l’enregistrement',
  audioRec: (
    <>
      <li>Enregistrez dans un endroit sans écho : une penderie remplie de vêtements ou une pièce avec tapis fonctionnent bien.</li>
      <li>Laissez <strong>0,5 seconde de silence</strong> au début et à la fin du fichier.</li>
      <li><strong>Pas de musique de fond</strong> — elle nuit au système de synchronisation phrase par phrase.</li>
      <li>Si le livre dure plus de <strong>2 heures</strong>, vous pouvez le diviser en fichiers par chapitre et les téléverser un à un.</li>
      <li>Normalisez le volume à <strong>−14 LUFS</strong> pour assurer une qualité d’écoute uniforme.</li>
    </>
  ),
  audioTip: <>Audacity (gratuit) peut normaliser le volume et exporter en MP3 à 192 kbit/s. Utilisez <em>Tracks → Mix → Mix and Render</em>, puis <em>Effect → Loudness Normalization → −14 LUFS</em>.</>,
  syncTitle: 'Synchronisation texte-audio (SRT/VTT)',
  syncBadge: 'Recommandé',
  syncIntro: <>Ce fichier active le <strong>mode Écoute active</strong> : chaque phrase du livre se surligne automatiquement pendant que l’audio la narre. C’est la fonctionnalité distinctive de Noetia, et elle améliore nettement la rétention des lecteurs.</>,
  syncSpecs: [
    { label: 'Formats', value: 'SRT (.srt) ou WebVTT (.vtt)', highlight: true },
    { label: 'Encodage', value: 'UTF-8' },
    { label: 'Taille maximale', value: '2 Mo' },
    { label: 'Règle d’or', value: 'Chaque entrée = une phrase du livre' },
  ],
  syncHowTitle: 'Comment créer le fichier de synchronisation',
  optionATitle: 'Option recommandée : Subtitle Edit (Windows, gratuit)',
  optionASteps: (
    <>
      <li>Ouvrez Subtitle Edit et chargez votre fichier audio (<em>Video → Open Video</em>).</li>
      <li>Écoutez l’audio et, pour chaque phrase, appuyez sur <kbd className={kbd}>F9</kbd> au début et sur <kbd className={kbd}>F10</kbd> à la fin.</li>
      <li>Saisissez le texte de la phrase dans le champ de texte.</li>
      <li>Répétez l’opération pour chaque phrase du livre.</li>
      <li>Exportez : <em>File → Save As</em> → choisissez le format SRT.</li>
    </>
  ),
  optionBTitle: 'Option rapide : Descript (transcription automatique)',
  optionBSteps: (
    <>
      <li>Téléversez votre audio dans Descript et laissez-le le transcrire automatiquement.</li>
      <li>Corrigez le texte pour qu’il corresponde exactement au livre.</li>
      <li>Exportez : <em>File → Export → SRT Captions</em>.</li>
    </>
  ),
  optionBNote: 'La transcription automatique n’est pas parfaite — vérifiez toujours le résultat avant d’exporter.',
  srtExampleTitle: 'Exemple de format SRT',
  srtExampleComment: '# bloc = numéro + horodatage + texte + ligne vide',
  srtLines: ['C’était une nuit sombre et orageuse.', 'Le vent secouait les fenêtres du manoir.', 'Don Rodrigo n’arrivait pas à dormir.'],
  vttNote: <>Le format WebVTT est identique, mais il utilise un point (.) pour les millisecondes et commence par la ligne <code className="bg-gray-100 px-1 rounded">WEBVTT</code>.</>,
  syncWarning: 'L’horodatage du fichier SRT doit correspondre au fichier audio que vous téléversez. Si vous réenregistrez, vous devrez aussi mettre à jour le fichier SRT.',
  faqTitle: 'Questions fréquentes',
  faq: [
    { q: 'Puis-je téléverser le livre d’abord et le fichier SRT plus tard?', a: 'Oui. Dans la section « Mes livres » du portail, un bouton « Téléverser la synchronisation SRT/VTT » est offert pour chaque livre. Vous pouvez l’ajouter en tout temps, même après la publication du livre.' },
    { q: 'Que se passe-t-il si mon fichier SRT contient des coquilles?', a: 'Noetia utilise le fichier .txt comme source de référence pour le texte affiché. Le fichier SRT ne contrôle que l’horodatage de la synchronisation — une petite coquille dans le SRT n’a aucun effet sur le texte visible.' },
    { q: 'Combien de temps prend la révision?', a: 'Le processus de révision prend de 3 à 5 jours ouvrables. Vous recevrez un courriel lorsque votre livre sera publié ou si nous avons besoin que vous corrigiez quelque chose.' },
    { q: 'Puis-je mettre à jour le contenu après la publication?', a: 'Vous pouvez mettre à jour le fichier de synchronisation en tout temps. Pour toute modification du texte ou de l’audio, écrivez-nous à autores@noetia.app — nous étudions chaque cas individuellement.' },
    { q: 'L’audio est-il obligatoire?', a: 'Non. Vous pouvez publier avec seulement le texte et la couverture. L’audio et la synchronisation sont facultatifs, mais ils améliorent nettement l’expérience de lecture.' },
    { q: 'Quels formats audio ne sont PAS acceptés?', a: 'Nous n’acceptons pas les formats WAV, FLAC ni OGG. Convertissez vos fichiers en MP3 à 192 kbit/s avant de les téléverser. Audacity ou tout autre éditeur audio peut le faire gratuitement.' },
  ],
  ctaTitle: 'Prêt à publier?',
  ctaBody: 'Notre équipe est là pour vous aider à chaque étape du processus.',
  ctaPortal: 'Aller au portail des auteurs',
  ctaContact: 'Communiquer avec l’équipe',
};

export const uploadGuideCopy: Localized<UploadGuideCopy> = { es, en, 'fr-CA': frCA };
