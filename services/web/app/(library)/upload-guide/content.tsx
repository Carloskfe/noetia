'use client';

import Link from 'next/link';
import React from 'react';
import { useTranslation } from '@/lib/i18n';

function Section({ id, title, icon, children }: { id?: string; title: string; icon: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
        <span className="text-xl">{icon}</span>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function Spec({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0 items-start">
      <span className="text-sm text-gray-500 w-44 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-blue-700' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-800 leading-relaxed">
      <span className="font-semibold">{label} </span>{children}
    </div>
  );
}

function Warning({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-800 leading-relaxed">
      <span className="font-semibold">{label} </span>{children}
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-gray-100 leading-loose overflow-x-auto">
      {children}
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function UploadGuideContent() {
  const { language } = useTranslation();
  const l = language;
  const tip   = l === 'es' ? 'Consejo:'   : 'Tip:';
  const warn  = l === 'es' ? 'Importante:' : 'Important:';

  return (
    <main className="min-h-screen bg-gray-50 pb-24">

      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 pt-12 pb-8">
          <Link href="/author" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            {l === 'es' ? 'Portal de autores' : 'Author portal'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {l === 'es' ? 'Guía de publicación' : 'Publishing Guide'}
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {l === 'es'
              ? 'Esta guía cubre todo lo que necesitas para publicar tu libro en Noetia — desde los formatos de archivo hasta la sincronización texto-audio. Preparar bien tus archivos desde el principio evita retrasos en la revisión.'
              : 'This guide covers everything you need to publish your book on Noetia — from file formats to text-audio synchronization. Preparing your files properly from the start avoids review delays.'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Quick checklist */}
        <section className="bg-blue-600 rounded-2xl p-6 text-white">
          <h2 className="font-bold text-base mb-4">
            {l === 'es' ? 'Lista de verificación rápida' : 'Quick checklist'}
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(l === 'es' ? [
              '✓  Texto en .txt, codificación UTF-8',
              '✓  Portada JPG/PNG, mín. 800×1200 px',
              '✓  Audio MP3 o M4A, sin música de fondo',
              '✓  Archivo SRT/VTT para sincronización (opcional)',
              '✓  Sin numeración de páginas en el texto',
              '✓  Sin eco ni ruido en el audio',
            ] : [
              '✓  Text as .txt, UTF-8 encoding',
              '✓  Cover JPG/PNG, min. 800×1200 px',
              '✓  Audio MP3 or M4A, no background music',
              '✓  SRT/VTT file for sync (optional)',
              '✓  No page numbers in the text',
              '✓  No echo or noise in the audio',
            ]).map((item) => (
              <div key={item} className="text-blue-100">{item}</div>
            ))}
          </div>
        </section>

        {/* Process */}
        <Section title={l === 'es' ? '¿Cómo funciona el proceso?' : 'How does the process work?'} icon="🗺️">
          <div className="space-y-4">
            {l === 'es' ? (
              <>
                <Step n="1" title="Prepara tus archivos" desc="Texto, portada, audio y opcionalmente un archivo de sincronización SRT o VTT." />
                <Step n="2" title="Sube tu libro" desc="Completa el formulario en el portal de autores. Si tienes audio, añade también el archivo de sincronización para activar el modo Escucha Activa." />
                <Step n="3" title="Revisión editorial" desc="Nuestro equipo revisa el contenido para garantizar calidad. El proceso tarda entre 3 y 5 días hábiles." />
                <Step n="4" title="Publicación" desc="Recibirás un email de confirmación y tu libro quedará disponible para lectores de toda Latinoamérica." />
              </>
            ) : (
              <>
                <Step n="1" title="Prepare your files" desc="Text, cover, audio, and optionally an SRT or VTT sync file." />
                <Step n="2" title="Upload your book" desc="Fill out the form in the author portal. If you have audio, also add the sync file to activate Active Listening mode." />
                <Step n="3" title="Editorial review" desc="Our team reviews the content to ensure quality. The process takes 3–5 business days." />
                <Step n="4" title="Publication" desc="You will receive a confirmation email and your book will be available to readers across Latin America." />
              </>
            )}
          </div>
          <div className="mt-5 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
            {l === 'es'
              ? <>¿Olvidaste subir el archivo de sincronización? Puedes añadirlo en cualquier momento desde la sección <strong>Mis libros</strong> en el portal de autores, incluso después de la publicación.</>
              : <>Forgot to upload the sync file? You can add it at any time from the <strong>My Books</strong> section in the author portal, even after publication.</>}
          </div>
        </Section>

        {/* Text */}
        <Section title={l === 'es' ? 'Texto del libro' : 'Book text'} icon="📄">
          <div className="mb-5">
            <Spec label={l === 'es' ? 'Formato recomendado' : 'Recommended format'} value=".txt (plain text)" highlight />
            <Spec label={l === 'es' ? 'Formatos alternativos' : 'Alternative formats'} value=".epub, .pdf" />
            <Spec label={l === 'es' ? 'Codificación' : 'Encoding'} value="UTF-8 (required)" />
            <Spec label={l === 'es' ? 'Tamaño máximo' : 'Maximum size'} value="10 MB" />
          </div>

          <div className="mb-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">
              {l === 'es' ? 'Cómo estructurar el texto' : 'How to structure the text'}
            </p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              {l === 'es' ? (
                <>
                  <li>Separa los párrafos con <strong>una línea en blanco</strong>.</li>
                  <li>Los capítulos deben ir en su propia línea, en <strong>MAYÚSCULAS</strong> o precedidos de la palabra <strong>CAPÍTULO</strong>.</li>
                  <li>Elimina numeración de páginas, encabezados, pies de página y tablas de contenido.</li>
                  <li>Si el libro tiene notas al pie, ponlas al final del capítulo entre corchetes: <code className="bg-gray-100 px-1 rounded text-xs">[Nota: texto]</code>.</li>
                </>
              ) : (
                <>
                  <li>Separate paragraphs with <strong>a blank line</strong>.</li>
                  <li>Chapters should be on their own line, in <strong>ALL CAPS</strong> or preceded by the word <strong>CHAPTER</strong>.</li>
                  <li>Remove page numbers, headers, footers, and tables of contents.</li>
                  <li>If the book has footnotes, place them at the end of the chapter in brackets: <code className="bg-gray-100 px-1 rounded text-xs">[Note: text]</code>.</li>
                </>
              )}
            </ul>
          </div>

          <CodeBlock>
            {l === 'es' ? (
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
            ) : (
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
            )}
          </CodeBlock>

          <div className="mt-4">
            <Tip label={tip}>
              {l === 'es'
                ? 'Si tu manuscrito está en Word (.docx), guárdalo como "Texto sin formato" (.txt) y asegúrate de seleccionar codificación UTF-8 en el cuadro de diálogo de guardado.'
                : 'If your manuscript is in Word (.docx), save it as "Plain Text" (.txt) and make sure to select UTF-8 encoding in the save dialog.'}
            </Tip>
          </div>
        </Section>

        {/* Cover */}
        <Section title={l === 'es' ? 'Imagen de portada' : 'Cover image'} icon="🖼️">
          <div className="mb-5">
            <Spec label={l === 'es' ? 'Formatos' : 'Formats'} value="JPG or PNG" highlight />
            <Spec label={l === 'es' ? 'Dimensiones mínimas' : 'Minimum dimensions'} value="800 × 1200 px (2:3 ratio)" />
            <Spec label={l === 'es' ? 'Dimensiones recomendadas' : 'Recommended dimensions'} value="1600 × 2400 px" />
            <Spec label={l === 'es' ? 'Tamaño máximo' : 'Maximum size'} value="5 MB" />
            <Spec label={l === 'es' ? 'Fondo' : 'Background'} value={l === 'es' ? 'Sin transparencia (sin canal alpha)' : 'No transparency (no alpha channel)'} />
          </div>
          <Tip label={tip}>
            {l === 'es'
              ? <>La portada se muestra como miniatura de <strong>120 × 180 px</strong> en los listados de la app. Asegúrate de que el título y el nombre del autor sean legibles a ese tamaño. Evita texto muy pequeño y fondos con poco contraste.</>
              : <>The cover is displayed as a <strong>120 × 180 px</strong> thumbnail in app listings. Make sure the title and author name are readable at that size. Avoid very small text and low-contrast backgrounds.</>}
          </Tip>
          <div className="mt-4">
            <Warning label={warn}>
              {l === 'es'
                ? 'No uses imágenes con copyright sin licencia. Noetia verificará que tengas los derechos sobre la portada durante la revisión editorial.'
                : 'Do not use copyrighted images without a license. Noetia will verify that you hold the rights to the cover during the editorial review.'}
            </Warning>
          </div>
        </Section>

        {/* Audio */}
        <Section title={l === 'es' ? 'Audio de la narración' : 'Narration audio'} icon="🎙️">
          <div className="mb-5">
            <Spec label={l === 'es' ? 'Formato recomendado' : 'Recommended format'} value="MP3 (recommended)" highlight />
            <Spec label={l === 'es' ? 'Formatos alternativos' : 'Alternative formats'} value="M4A / AAC" />
            <Spec label={l === 'es' ? 'Bitrate mínimo' : 'Minimum bitrate'} value="128 kbps" />
            <Spec label={l === 'es' ? 'Bitrate recomendado' : 'Recommended bitrate'} value="192 kbps" />
            <Spec label={l === 'es' ? 'Frecuencia de muestreo' : 'Sample rate'} value="44,100 Hz or 48,000 Hz" />
            <Spec label={l === 'es' ? 'Canales' : 'Channels'} value={l === 'es' ? 'Mono o estéreo' : 'Mono or stereo'} />
            <Spec label={l === 'es' ? 'Tamaño máximo' : 'Maximum size'} value={l === 'es' ? '500 MB por archivo' : '500 MB per file'} />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">
              {l === 'es' ? 'Recomendaciones de grabación' : 'Recording recommendations'}
            </p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              {l === 'es' ? (
                <>
                  <li>Graba en un espacio sin eco: un armario con ropa o una habitación con alfombra funcionan bien.</li>
                  <li>Deja <strong>0,5 segundos de silencio</strong> al inicio y al final del archivo.</li>
                  <li><strong>Sin música de fondo</strong> — interfiere con el sistema de sincronización frase por frase.</li>
                  <li>Si el libro supera <strong>2 horas</strong>, puedes dividirlo en archivos por capítulo y subirlos uno a uno.</li>
                  <li>Normaliza el volumen a <strong>−14 LUFS</strong> para garantizar calidad de escucha uniforme.</li>
                </>
              ) : (
                <>
                  <li>Record in an echo-free space: a closet with clothes or a carpeted room work well.</li>
                  <li>Leave <strong>0.5 seconds of silence</strong> at the start and end of the file.</li>
                  <li><strong>No background music</strong> — it interferes with the phrase-by-phrase sync system.</li>
                  <li>If the book is longer than <strong>2 hours</strong>, you can split it into chapter files and upload them one by one.</li>
                  <li>Normalize the volume to <strong>−14 LUFS</strong> for consistent listening quality.</li>
                </>
              )}
            </ul>
          </div>

          <div className="mt-4">
            <Tip label={tip}>
              {l === 'es'
                ? <>Audacity (gratuito) puede normalizar el volumen y exportar a MP3 192 kbps. Usa <em>Tracks → Mix → Mix and Render</em> y luego <em>Effect → Loudness Normalization → −14 LUFS</em>.</>
                : <>Audacity (free) can normalize volume and export to MP3 192 kbps. Use <em>Tracks → Mix → Mix and Render</em> then <em>Effect → Loudness Normalization → −14 LUFS</em>.</>}
            </Tip>
          </div>
        </Section>

        {/* Sync */}
        <Section id="sync" title={l === 'es' ? 'Sincronización texto-audio (SRT/VTT)' : 'Text-audio synchronization (SRT/VTT)'} icon="🔗">
          <div className="flex gap-2 items-start mb-5">
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
              {l === 'es' ? 'Recomendado' : 'Recommended'}
            </span>
            <p className="text-sm text-gray-600">
              {l === 'es'
                ? <>Este archivo activa el <strong>Modo Escucha Activa</strong>: cada frase del libro se resalta automáticamente mientras el audio la narra. Es la funcionalidad diferenciadora de Noetia y mejora significativamente la retención del lector.</>
                : <>This file activates <strong>Active Listening Mode</strong>: each phrase of the book highlights automatically as the audio narrates it. It is Noetia&apos;s differentiating feature and significantly improves reader retention.</>}
            </p>
          </div>

          <div className="mb-5">
            <Spec label={l === 'es' ? 'Formatos' : 'Formats'} value="SRT (.srt) or WebVTT (.vtt)" highlight />
            <Spec label={l === 'es' ? 'Codificación' : 'Encoding'} value="UTF-8" />
            <Spec label={l === 'es' ? 'Tamaño máximo' : 'Maximum size'} value="2 MB" />
            <Spec label={l === 'es' ? 'Regla de oro' : 'Golden rule'} value={l === 'es' ? 'Cada entrada = una frase del libro' : 'Each entry = one sentence from the book'} />
          </div>

          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              {l === 'es' ? 'Cómo crear el archivo de sincronización' : 'How to create the sync file'}
            </p>
            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">A</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {l === 'es' ? 'Opción recomendada: Subtitle Edit (Windows, gratis)' : 'Recommended option: Subtitle Edit (Windows, free)'}
                  </p>
                  <ol className="text-sm text-gray-600 mt-1 space-y-1 list-decimal list-inside">
                    {l === 'es' ? (
                      <>
                        <li>Abre Subtitle Edit y carga tu archivo de audio (<em>Video → Open Video</em>).</li>
                        <li>Escucha el audio y para cada frase: pulsa <kbd className="bg-gray-100 px-1 rounded text-xs">F9</kbd> al inicio y <kbd className="bg-gray-100 px-1 rounded text-xs">F10</kbd> al final.</li>
                        <li>Escribe el texto de la frase en el campo de texto.</li>
                        <li>Repite para cada frase del libro.</li>
                        <li>Exporta: <em>File → Save As</em> → elige formato SRT.</li>
                      </>
                    ) : (
                      <>
                        <li>Open Subtitle Edit and load your audio file (<em>Video → Open Video</em>).</li>
                        <li>Listen to the audio and for each sentence: press <kbd className="bg-gray-100 px-1 rounded text-xs">F9</kbd> at the start and <kbd className="bg-gray-100 px-1 rounded text-xs">F10</kbd> at the end.</li>
                        <li>Type the sentence text in the text field.</li>
                        <li>Repeat for every sentence in the book.</li>
                        <li>Export: <em>File → Save As</em> → choose SRT format.</li>
                      </>
                    )}
                  </ol>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">B</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {l === 'es' ? 'Opción rápida: Descript (transcripción automática)' : 'Quick option: Descript (automatic transcription)'}
                  </p>
                  <ol className="text-sm text-gray-600 mt-1 space-y-1 list-decimal list-inside">
                    {l === 'es' ? (
                      <>
                        <li>Sube tu audio a Descript y déjalo transcribir automáticamente.</li>
                        <li>Corrige el texto para que coincida exactamente con el libro.</li>
                        <li>Exporta: <em>File → Export → SRT Captions</em>.</li>
                      </>
                    ) : (
                      <>
                        <li>Upload your audio to Descript and let it transcribe automatically.</li>
                        <li>Correct the text to match the book exactly.</li>
                        <li>Export: <em>File → Export → SRT Captions</em>.</li>
                      </>
                    )}
                  </ol>
                  <p className="text-xs text-gray-400 mt-1">
                    {l === 'es'
                      ? 'La transcripción automática no es perfecta — revisa siempre el resultado antes de exportar.'
                      : 'Automatic transcription is not perfect — always review the result before exporting.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              {l === 'es' ? 'Ejemplo de formato SRT' : 'SRT format example'}
            </p>
            <CodeBlock>
              <div className="text-gray-400 mb-1">
                {l === 'es' ? '# bloque = número + tiempos + texto + línea en blanco' : '# block = number + timestamps + text + blank line'}
              </div>
              <div>&nbsp;</div>
              <div>1</div>
              <div>00:00:01,000 --&gt; 00:00:03,500</div>
              <div>{l === 'es' ? 'Era una noche oscura y tormentosa.' : 'It was a dark and stormy night.'}</div>
              <div>&nbsp;</div>
              <div>2</div>
              <div>00:00:03,700 --&gt; 00:00:06,200</div>
              <div>{l === 'es' ? 'El viento azotaba las ventanas del caserón.' : 'The wind rattled the windows of the manor.'}</div>
              <div>&nbsp;</div>
              <div>3</div>
              <div>00:00:06,500 --&gt; 00:00:09,100</div>
              <div>{l === 'es' ? 'Don Rodrigo no podía dormir.' : 'Don Rodrigo could not sleep.'}</div>
            </CodeBlock>
            <p className="text-xs text-gray-400 mt-1.5">
              {l === 'es'
                ? <>El formato WebVTT es igual pero usa punto (.) en los milisegundos y empieza con la línea <code className="bg-gray-100 px-1 rounded">WEBVTT</code>.</>
                : <>WebVTT format is the same but uses a period (.) for milliseconds and starts with the line <code className="bg-gray-100 px-1 rounded">WEBVTT</code>.</>}
            </p>
          </div>

          <Warning label={warn}>
            {l === 'es'
              ? 'Los tiempos del SRT deben coincidir con el archivo de audio que subas. Si grabas de nuevo, necesitarás actualizar el SRT también.'
              : 'SRT timestamps must match the audio file you upload. If you re-record, you will need to update the SRT as well.'}
          </Warning>
        </Section>

        {/* FAQ */}
        <Section title={l === 'es' ? 'Preguntas frecuentes' : 'Frequently asked questions'} icon="❓">
          <div className="space-y-5">
            {(l === 'es' ? [
              {
                q: '¿Puedo subir el libro primero y el SRT después?',
                a: 'Sí. Desde la sección "Mis libros" en el portal hay un botón "Subir sincronización SRT/VTT" para cada libro. Puedes añadirla en cualquier momento, incluso después de que el libro esté publicado.',
              },
              {
                q: '¿Qué pasa si mi texto tiene errores tipográficos en el SRT?',
                a: 'Noetia usa el texto del archivo .txt como fuente de verdad para la lectura. El SRT solo controla los tiempos de sincronización — un pequeño error de tipeo en el SRT no afecta el texto visible.',
              },
              {
                q: '¿En cuánto tiempo revisan mi libro?',
                a: 'El proceso de revisión tarda entre 3 y 5 días hábiles. Recibirás un email cuando tu libro esté publicado o si necesitamos que corrijas algo.',
              },
              {
                q: '¿Puedo actualizar el contenido después de publicar?',
                a: 'Puedes actualizar el archivo de sincronización en cualquier momento. Para cambios en el texto o el audio, contáctanos a autores@noetia.app — lo revisamos caso a caso.',
              },
              {
                q: '¿El audio es obligatorio?',
                a: 'No. Puedes publicar solo con texto y portada. El audio y la sincronización son opcionales pero mejoran significativamente la experiencia del lector.',
              },
              {
                q: '¿Qué formatos de audio NO están permitidos?',
                a: 'No aceptamos WAV, FLAC ni OGG. Convierte a MP3 192 kbps antes de subir. Audacity o cualquier editor de audio puede hacerlo gratis.',
              },
            ] : [
              {
                q: 'Can I upload the book first and the SRT later?',
                a: 'Yes. In the "My Books" section of the portal there is an "Upload SRT/VTT sync" button for each book. You can add it at any time, even after the book is published.',
              },
              {
                q: 'What happens if my SRT has typos?',
                a: 'Noetia uses the .txt file as the source of truth for the reading text. The SRT only controls sync timestamps — a small typo in the SRT does not affect the visible text.',
              },
              {
                q: 'How long does the review take?',
                a: 'The review process takes 3–5 business days. You will receive an email when your book is published or if we need you to correct something.',
              },
              {
                q: 'Can I update the content after publishing?',
                a: 'You can update the sync file at any time. For changes to the text or audio, contact us at autores@noetia.app — we review each case individually.',
              },
              {
                q: 'Is audio required?',
                a: 'No. You can publish with text and cover only. Audio and synchronization are optional but significantly improve the reader experience.',
              },
              {
                q: 'What audio formats are NOT accepted?',
                a: 'We do not accept WAV, FLAC, or OGG. Convert to MP3 192 kbps before uploading. Audacity or any audio editor can do this for free.',
              },
            ]).map(({ q, a }) => (
              <div key={q} className="border-b border-gray-50 pb-5 last:border-0 last:pb-0">
                <p className="text-sm font-semibold text-gray-900 mb-1">{q}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* CTA */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-7 text-center text-white">
          <h2 className="text-lg font-bold mb-2">
            {l === 'es' ? '¿Listo para publicar?' : 'Ready to publish?'}
          </h2>
          <p className="text-blue-100 text-sm mb-5 leading-relaxed">
            {l === 'es'
              ? 'Nuestro equipo está disponible para ayudarte en cada paso del proceso.'
              : 'Our team is available to help you at every step of the process.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/author"
              className="bg-white text-blue-600 font-semibold px-7 py-3 rounded-xl hover:bg-blue-50 transition text-sm"
            >
              {l === 'es' ? 'Ir al portal de autores' : 'Go to author portal'}
            </Link>
            <a
              href="mailto:autores@noetia.app"
              className="bg-white/10 border border-white/30 text-white font-semibold px-7 py-3 rounded-xl hover:bg-white/20 transition text-sm"
            >
              {l === 'es' ? 'Contactar al equipo' : 'Contact the team'}
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}
