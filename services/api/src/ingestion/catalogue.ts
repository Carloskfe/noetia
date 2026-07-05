export type TextSource = 'gutenberg' | 'wikisource' | 'vatican';

export interface CatalogueEntry {
  title: string;
  author: string;
  description: string;
  /** Omitted for pendingRights entries — source fetcher is not yet wired for 'vatican' */
  source?: TextSource;
  gutenbergId?: number;
  wikisourceTitle?: string;
  /** Fetch and concatenate multiple individual Wikisource pages (for collected works with no index page) */
  wikisourceTitles?: string[];
  /** Absent for non-LibriVox audio sources or pendingRights entries */
  librivoxAudioUrl?: string;
  /** Non-LibriVox audio source URL (e.g. Vatican News podcast page) — for reference/future ingestion */
  externalAudioUrl?: string;
  /** When true, ingestAll() skips this entry — used for titles awaiting rights authorization */
  pendingRights?: boolean;
  /** Override search string passed to LibriVox API when the full title doesn't match */
  librivoxSearchTitle?: string;
  /** Hardcoded cover image URL — skips Open Library search when present */
  coverUrl?: string;
  /** Collection this book belongs to (sets books.collection and filters from general catalog) */
  collection?: string;
  /** BCP-47 language code of the ingested text — defaults to 'es' if omitted */
  language?: string;
  /**
   * First line/phrase of the actual narrative. Everything before this pattern
   * (preamble, scholarly introduction, publisher info) is stripped from the
   * stored text so the aligner sees only content that is actually read aloud.
   */
  narrativeStartPattern?: string;
  /**
   * Marker that ends the narrative. Everything from this pattern onward
   * (glossaries, indexes, appendices) is stripped from the stored text.
   */
  narrativeEndPattern?: string;
  /**
   * Optional post-processing applied to the fetched text before storage and
   * phrase splitting. Use to strip non-spoken elements (verse line numbers,
   * illustration captions) that appear in the source but are absent from the
   * audio recording.
   */
  textPostProcess?: (text: string) => string;
}

export const CATALOGUE: CatalogueEntry[] = [
  {
    title: 'Lazarillo de Tormes',
    author: 'Anónimo',
    description: 'Novela picaresca anónima del siglo XVI, fundadora del género en la literatura española.',
    source: 'wikisource',
    wikisourceTitle: 'El Lazarillo de Tormes',
    librivoxAudioUrl: 'https://librivox.org/lazarillo-de-tormes/',
  },
  {
    title: 'El Sombrero de Tres Picos',
    author: 'Pedro Antonio de Alarcón',
    description: 'Comedia costumbrista del siglo XIX basada en una historia popular andaluza.',
    source: 'wikisource',
    wikisourceTitle: 'El sombrero de tres picos (1874)',
    librivoxAudioUrl: 'https://librivox.org/el-sombrero-de-tres-picos-by-pedro-antonio-de-alarcon-y-ariza/',
    librivoxSearchTitle: 'Sombrero de Tres Picos',
  },
  {
    title: 'Leyendas',
    author: 'Gustavo Adolfo Bécquer',
    description: 'Colección de leyendas románticas del poeta y narrador sevillano del siglo XIX.',
    source: 'wikisource',
    // Order matches the LibriVox audio's actual chapter sequence (confirmed
    // from each chapter file's spoken title announcement) — same bug class
    // as Cuentos de la Selva. The recording also includes 5 extra Bécquer
    // pieces not in this catalogue entry ("Es raro", "La Arquitectura Árabe
    // en Toledo", "La creación", "Las hojas secas", "3 fechas" — likely
    // Rimas/poems or prose essays, not leyendas) scattered between the
    // legends; those chapter files must be excluded before merging, not
    // just reordered.
    wikisourceTitles: [
      'Creed en Dios',
      'El Cristo de la calavera',
      'El beso',
      'El caudillo de las manos rojas',
      'El gnomo',
      'El miserere (Bécquer)',
      'El monte de las ánimas',
      'El rayo de luna',
      'La ajorca de oro',
      'La corza blanca',
      'La cruz del Diablo',
      'La cueva de la mora',
      'La promesa',
      'La rosa de pasión',
      'Los ojos verdes',
      'Maese Pérez el organista',
    ],
    librivoxAudioUrl: 'https://librivox.org/leyendas-by-gustavo-adolfo-becquer/',
  },
  {
    title: 'Don Juan Tenorio',
    author: 'José Zorrilla',
    description: 'Drama romántico en verso sobre el legendario seductor español.',
    source: 'wikisource',
    wikisourceTitle: 'Don Juan Tenorio (1844)',
    librivoxAudioUrl: 'https://librivox.org/don-juan-by-jose-zorrilla-y-moral/',
  },
  {
    title: 'Marianela',
    author: 'Benito Pérez Galdós',
    description: 'Novela social de Galdós que explora la belleza, la pobreza y el amor en la España rural.',
    source: 'wikisource',
    wikisourceTitle: 'Marianela',
    librivoxAudioUrl: 'https://librivox.org/marianela-by-benito-perez-galdos/',
  },
  {
    title: 'Doña Perfecta',
    author: 'Benito Pérez Galdós',
    description: 'Novela que denuncia el fanatismo religioso y la intolerancia en la España del siglo XIX.',
    source: 'wikisource',
    wikisourceTitle: 'Doña Perfecta',
    librivoxAudioUrl: 'https://librivox.org/dona-perfecta-by-benito-perez-galdos/',
  },
  {
    title: 'Niebla',
    author: 'Miguel de Unamuno',
    description: 'Nivola existencialista en la que el protagonista cuestiona su propia realidad ante su creador.',
    source: 'gutenberg',
    gutenbergId: 49836,
    librivoxAudioUrl: 'https://librivox.org/niebla-by-miguel-de-unamuno/',
    // BUG FOUND 2026-06-24: original startPattern '\nPRÓLOGO\n' has embedded
    // newlines but the real Gutenberg file uses \r\n — silently never
    // matched, leaving ~800 chars of title page / transcriber's note
    // attached. "PRÓLOGO" alone isn't safe either (also appears as
    // "PRÓLOGO DE\nVÍCTOR GOTI" on the title page, and twice more in a
    // back-of-book table of contents) — anchoring on the real opening
    // sentence instead, confirmed unique.
    narrativeStartPattern: 'Se empeña don Miguel de Unamuno en que ponga yo un',
    narrativeEndPattern: '—¡Y luego dirán que no matan las penas!',
  },
  {
    title: 'El Gaucho Martín Fierro',
    author: 'José Hernández',
    description: 'Poema épico gauchesco argentino, símbolo de la identidad nacional latinoamericana.',
    source: 'gutenberg',
    gutenbergId: 14765,
    librivoxAudioUrl: 'https://librivox.org/el-gaucho-martin-fierro-by-jose-hernandez/',
    librivoxSearchTitle: 'Martin Fierro',
    // No front/back-matter issue — the dedicatory "Carta del Autor" is
    // genuinely narrated (confirmed in the chapter 0 transcript) and the
    // ending is clean. The real issue: 395 standalone verse-stanza numbers
    // ("392", "393"...), each followed by a single newline (not a blank
    // line + space), so they glue onto the next sentence as "392\nY
    // cuando..." instead of being filtered as a heading — never narrated,
    // guaranteed to fail alignment. La Odisea's existing fix
    // (`/^\d{1,4} /gm`, requires a space) doesn't match this format.
    textPostProcess: (text: string) => text.replace(/^\d{1,3}\r?\n/gm, ''),
  },
  {
    title: 'Cuentos de Amor de Locura y de Muerte',
    author: 'Horacio Quiroga',
    description: 'Cuentos del maestro rioplatense del género, ambientados en la selva misionera.',
    source: 'gutenberg',
    gutenbergId: 13507,
    librivoxAudioUrl: 'https://librivox.org/cuentos-de-amor-de-locura-y-de-muerte-by-horacio-quiroga/',
  },
  {
    title: 'Los Cuatro Jinetes del Apocalipsis',
    author: 'Vicente Blasco Ibáñez',
    description: 'Novela antibélica ambientada en la Primera Guerra Mundial, bestseller mundial de 1916.',
    source: 'gutenberg',
    gutenbergId: 24536,
    librivoxAudioUrl: 'https://librivox.org/los-cuatro-jinetes-del-apocalipsis-by-vicente-blasco-ibanez/',
    librivoxSearchTitle: 'Cuatro Jinetes',
    // Gutenberg 24536 opens with a transcriber's note, title/copyright page,
    // and a full ÍNDICE (table of contents listing every part and chapter)
    // before Chapter I — none of it narrated. Ends cleanly at "FIN".
    // No illustrations or footnotes in this text (unlike La Divina Comedia).
    narrativeStartPattern: 'Debían encontrarse á las cinco de la tarde en el pequeño jardín de la',
    narrativeEndPattern: 'caderas de ánfora.',
  },
  {
    title: 'La Isla del Tesoro',
    author: 'Robert Louis Stevenson',
    description: 'Clásico de aventuras piratas narrado por el joven Jim Hawkins en busca de un tesoro oculto.',
    source: 'wikisource',
    wikisourceTitle: 'La isla del tesoro (Manuel Caballero)',
    librivoxAudioUrl: 'https://librivox.org/la-isla-del-tesoro-by-robert-louis-stevenson/',
    librivoxSearchTitle: 'Isla del Tesoro',
  },
  {
    title: 'Viaje al Centro de la Tierra',
    author: 'Julio Verne',
    description: 'Novela de ciencia ficción en la que el profesor Lidenbrock y su sobrino descienden al interior de la Tierra.',
    source: 'wikisource',
    wikisourceTitle: 'Viaje al centro de la Tierra',
    librivoxAudioUrl: 'https://librivox.org/viaje-al-centro-de-la-tierra-by-jules-verne/',
  },
  {
    title: 'Romeo y Julieta',
    author: 'William Shakespeare',
    description: 'La más célebre tragedia de amor de la literatura universal.',
    source: 'wikisource',
    wikisourceTitle: 'Romeo y Julieta (Menéndez y Pelayo tr.)',
    librivoxAudioUrl: 'https://librivox.org/romeo-y-julieta-by-william-shakespeare/',
  },
  {
    title: 'Crimen y Castigo',
    author: 'Fiódor Dostoyevski',
    description: 'Novela psicológica sobre un estudiante que comete un crimen y lidia con su conciencia.',
    source: 'gutenberg',
    gutenbergId: 61851,
    librivoxAudioUrl: 'https://librivox.org/crimen-y-castigo-by-fyodor-dostoyevsky/',
    // Gutenberg 61851 opens with a transcriber's note and title/publisher
    // page before "PRIMERA PARTE" (no duplicate index — single occurrence,
    // safe to anchor directly). Ends cleanly at "FIN". 20 translator
    // footnotes explain Russian terms/names to Spanish readers — never
    // narrated. Previously assumed to be a pure edition mismatch; this had
    // never actually been verified against the real source until now.
    narrativeStartPattern: 'PRIMERA PARTE',
    narrativeEndPattern: 'el que hemos querido ofrecer al lector, está terminado.',
    textPostProcess: (text: string) => {
      let cleaned = text.replace(/\[Ilustración[^\[]*?\]/g, '');
      cleaned = cleaned.replace(/^[ \t]+\[\d+\][^\n]*(\n[ \t]+\S[^\n]*)*\n?/gm, '');
      cleaned = cleaned.replace(/\[\d{1,3}\]/g, '');
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      return cleaned.trim();
    },
  },
  {
    title: 'La Odisea',
    author: 'Homero',
    description: 'Epopeya griega sobre el largo viaje de Odiseo de regreso a Ítaca tras la guerra de Troya.',
    source: 'gutenberg',
    gutenbergId: 58221,
    librivoxAudioUrl: 'https://librivox.org/la-odisea-by-homero/',
    librivoxSearchTitle: 'Odisea',
    // Gutenberg 58221 has a long scholarly preamble (AL LECTOR + NOTAS) before Canto I
    // and a 1700-entry glossary (ÍNDICE DE NOMBRES PROPIOS) after FIN.
    // Both sections are absent from the LibriVox audio.
    //
    // BUG FOUND 2026-06-24: the original endPattern '\nFIN\n' has embedded
    // newlines, but the real Gutenberg file uses \r\n line endings — plain
    // indexOf() silently never matched, so the entire ~276,000-character
    // glossary has been attached to this book's stored text since this fix
    // was first written. 'FIN' (no embedded newline, confirmed to appear
    // exactly once in the source) is the safe single-line replacement — see
    // docs/whisper-sync-troubleshooting.md §3's CRLF warning.
    narrativeStartPattern: 'CANTO PRIMERO',
    narrativeEndPattern: 'FIN',
    textPostProcess: (text: string) => {
      // Remove [Ilustración ...] captions — not read aloud, may span multiple lines
      let cleaned = text.replace(/\[Ilustración[^\[]*?\]/g, '');
      // Remove verse line numbers at paragraph starts (Greek line refs, e.g. "1 Háblame")
      cleaned = cleaned.replace(/^\d{1,4} /gm, '');
      // Collapse blank lines left by removed content
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      return cleaned.trim();
    },
  },
  {
    title: 'La Divina Comedia',
    author: 'Dante Alighieri',
    description: 'Poema épico medieval que narra el viaje de Dante por el Infierno, el Purgatorio y el Paraíso.',
    source: 'gutenberg',
    gutenbergId: 57303,
    librivoxAudioUrl: 'https://librivox.org/la-divina-comedia-by-dante-alighieri/',
    librivoxSearchTitle: 'Divina Comedia',
    // Gutenberg 57303 has a transcriber's note, title pages, and a full
    // Francesco De Sanctis critical essay before Canto I, plus a table of
    // contents and printer's colophon after the poem's final line.
    // None of this is read aloud in the LibriVox recording.
    narrativeStartPattern: 'CANTO PRIMERO',
    narrativeEndPattern: 'por el Amor que mueve el Sol y las demás estrellas.',
    textPostProcess: (text: string) => {
      // Remove [Ilustración] captions — not read aloud (176 occurrences, one per canto)
      let cleaned = text.replace(/\[Ilustración[^\[]*?\]/g, '');
      // Remove translator's footnote definition blocks, e.g.:
      //   "       [220] Los ojos de la Virgen María."
      // (may wrap onto further indented lines before the next blank line)
      cleaned = cleaned.replace(/^[ \t]+\[\d+\][^\n]*(\n[ \t]+\S[^\n]*)*\n?/gm, '');
      // Remove the remaining inline footnote reference markers, e.g. "venera,[220] fijos"
      cleaned = cleaned.replace(/\[\d{1,3}\]/g, '');
      // Collapse blank lines left by removed content
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      return cleaned.trim();
    },
  },
  {
    title: 'Don Quijote de la Mancha — Vol. I',
    author: 'Miguel de Cervantes',
    description: 'Primera parte de la obra cumbre de la literatura española y universal.',
    source: 'gutenberg',
    gutenbergId: 2000,
    librivoxAudioUrl: 'https://librivox.org/don-quijote-vol-1-by-miguel-de-cervantes-saavedra/',
    librivoxSearchTitle: 'Don Quijote',
    // Gutenberg 2000 is the COMPLETE Don Quijote (Parts I + II in one file), so
    // BOTH volumes used to fetch the same ~9,340-phrase text and each aligned
    // against only its own half of the audio → ~55% coverage apiece. We carve the
    // single text into its two parts here. Part I (1605) = "...ingenioso HIDALGO...";
    // Part II (1615) = "...ingenioso CABALLERO...". The Part II heading also appears
    // in the file's table of contents (~index 5,456), so the boundary search starts
    // past the front matter (offset 50,000) to land on the real structural heading
    // (~index 1,049,572). Indices verified against pg2000.txt on 2026-06-29.
    //
    // We start at the Tasa front matter (the "TASA" section heading, ~index 13,399),
    // NOT at the "Primera parte" structural heading (~index 39,983): the recording
    // opens by reading the entire legal front matter (Tasa, Testimonio de erratas, El
    // Rey privilegio, Prólogo, verses). Anchoring at "Primera parte" dropped all of
    // that, leaving ~hundreds of leading audio cues with no text — past the aligner's
    // MAX_DRIFT window, so it never locked on (52% coverage, 25% confidence). Starting
    // at TASA skips only the unread title page + TOC and aligns from cue 0.
    textPostProcess: (text: string) => {
      const PART2 = 'Segunda parte del ingenioso caballero don Quijote de la Mancha';
      const boundary = text.indexOf(PART2, 50000);
      // Start at the Tasa front matter (the recording reads it), skipping the
      // unread title page + TOC. Falls back to text start if not found.
      const tasa = text.indexOf('TASA');
      const start = tasa >= 0 ? tasa : 0;
      return text.slice(start, boundary >= 0 ? boundary : text.length).trim();
    },
  },
  {
    title: 'Don Quijote de la Mancha — Vol. II',
    author: 'Miguel de Cervantes',
    description: 'Segunda parte de la inmortal novela del caballero manchego y su escudero Sancho Panza.',
    source: 'gutenberg',
    gutenbergId: 2000,
    librivoxAudioUrl: 'https://librivox.org/don-quijote-volume-2-by-miguel-de-cervantes-saavedra/',
    librivoxSearchTitle: 'Don Quijote',
    // See Vol. I note: Gutenberg 2000 holds both parts. Here we keep Part II only,
    // then skip its ~11.5k chars of unread legal front matter (Tasa, Fee de erratas,
    // Aprobaciones, Dedicatoria) by starting at the 1615 prologue ("¡Válame Dios..."),
    // which the recording does read (prologue @ ~index 1,061,059).
    textPostProcess: (text: string) => {
      const PART2 = 'Segunda parte del ingenioso caballero don Quijote de la Mancha';
      const boundary = text.indexOf(PART2, 50000);
      let part = boundary >= 0 ? text.slice(boundary) : text;
      const prologue = part.search(/¡?V[aá]lame Dios, y con cu[aá]nta gana/i);
      if (prologue >= 0) part = part.slice(prologue);
      return part.trim();
    },
  },
  {
    title: 'Orgullo y Prejuicio',
    author: 'Jane Austen',
    description: 'Novela de la escritora inglesa sobre el amor, el matrimonio y los prejuicios sociales en la Inglaterra del siglo XIX.',
    source: 'wikisource',
    wikisourceTitle: 'Orgullo y prejuicio',
    librivoxAudioUrl: 'https://librivox.org/orgullo-y-prejuicio1-by-jane-austen/',
    librivoxSearchTitle: 'Orgullo Prejuicio',
  },
  // ── Spanish free-library second wave (added 2026-06-30; isFree pending sync) ──
  // Six Spanish titles toward the 18-ES target. All text is Spanish Wikisource
  // (no Gutenberg ES exists for any). THREE are translations — El Príncipe
  // (Italian), Meditaciones + Cartas a Lucilio (Latin) — and therefore carry the
  // #1 sync-failure risk (translation mismatch): the Wikisource edition must line
  // up with the exact translation the LibriVox narrator read, else coverage falls
  // below the 90% gate and the title stays isFree=false. Cartas a Lucilio is a
  // *selección* on LibriVox, so also expect text/audio length mismatch. The other
  // three (María, Rimas, La Edad de Oro) are original Spanish — low sync risk.
  {
    title: 'El Príncipe',
    author: 'Nicolás Maquiavelo',
    description: 'Tratado político del Renacimiento sobre el poder, el liderazgo y el arte de gobernar.',
    source: 'wikisource',
    // 'El príncipe' is an editions disambiguation page (no text). Real text lives
    // in the Sánchez Rojas translation (26 chapters as /Capítulo N subpages, auto-
    // crawled). Translation → match must be confirmed by Whisper alignment; if it
    // falls below 90% try 'El príncipe (1854)' instead.
    wikisourceTitle: 'El príncipe (Sánchez Rojas tr.)',
    librivoxAudioUrl: 'https://librivox.org/el-principe-by-niccolo-machiavelli/',
  },
  {
    title: 'María',
    author: 'Jorge Isaacs',
    description: 'Novela romántica del escritor colombiano sobre un amor trágico en el Valle del Cauca del siglo XIX.',
    source: 'wikisource',
    // 'María' is a disambiguation page (5 works share the title). The Isaacs novel
    // is 'María (Isaacs)' — 65 chapters (/I…/LXV) auto-crawled.
    wikisourceTitle: 'María (Isaacs)',
    librivoxAudioUrl: 'https://librivox.org/maria-by-jorge-isaacs/',
  },
  {
    title: 'Rimas',
    author: 'Gustavo Adolfo Bécquer',
    description: 'Colección de poemas del poeta romántico sevillano sobre el amor, la soledad y la poesía misma.',
    source: 'wikisource',
    // 'Rimas (Bécquer)' is an index of individual 'Rima N' pages (no /subpages).
    // The 1885 edition holds all 75 rimas as /Rima I…/Rima LXXV subpages, auto-
    // crawled and Roman-numeral sorted.
    wikisourceTitle: 'Rimas (Bécquer, 1885)',
    librivoxAudioUrl: 'https://librivox.org/rimas-by-gustavo-adolfo-becquer/',
  },
  {
    title: 'Meditaciones',
    author: 'Marco Aurelio',
    description: 'Reflexiones estoicas del emperador romano sobre la virtud, el deber y la serenidad ante la vida.',
    source: 'wikisource',
    // Marco Aurelio's Meditations is on es.wikisource as 'Soliloquios' (12 books as
    // /Libro I…/Libro XII subpages + Biografía/Prefacio front matter, auto-crawled).
    // Translation → confirm the match via Whisper alignment.
    wikisourceTitle: 'Soliloquios',
    librivoxAudioUrl: 'https://librivox.org/meditaciones-by-marcus-aurelius/',
  },
  {
    title: 'Cartas a Lucilio',
    author: 'Séneca',
    description: 'Cartas del filósofo estoico a su amigo Lucilio sobre cómo vivir con sabiduría y templanza.',
    source: 'wikisource',
    // 'Cartas a Lucilio' is a disambiguation page; the real text is the Wikisource
    // translation, whose 63 available letters live at '(Wikisource tr.)/Carta N'
    // (the '… - Carta N' names are redirects, so they must be listed explicitly —
    // the index links to the redirects, not the /subpages, so auto-crawl finds 0).
    // NOTE: Wikisource has only 63 of the 124 letters AND the LibriVox recording is
    // a *selección* — the two subsets won't line up, so this title is expected to
    // stay below the 90% gate (isFree=false); the text is at least correct/readable.
    wikisourceTitles: [
      'Cartas a Lucilio (Wikisource tr.)/Carta 1',
      'Cartas a Lucilio (Wikisource tr.)/Carta 2',
      'Cartas a Lucilio (Wikisource tr.)/Carta 3',
      'Cartas a Lucilio (Wikisource tr.)/Carta 4',
      'Cartas a Lucilio (Wikisource tr.)/Carta 5',
      'Cartas a Lucilio (Wikisource tr.)/Carta 6',
      'Cartas a Lucilio (Wikisource tr.)/Carta 7',
      'Cartas a Lucilio (Wikisource tr.)/Carta 8',
      'Cartas a Lucilio (Wikisource tr.)/Carta 9',
      'Cartas a Lucilio (Wikisource tr.)/Carta 10',
      'Cartas a Lucilio (Wikisource tr.)/Carta 11',
      'Cartas a Lucilio (Wikisource tr.)/Carta 12',
      'Cartas a Lucilio (Wikisource tr.)/Carta 13',
      'Cartas a Lucilio (Wikisource tr.)/Carta 14',
      'Cartas a Lucilio (Wikisource tr.)/Carta 15',
      'Cartas a Lucilio (Wikisource tr.)/Carta 16',
      'Cartas a Lucilio (Wikisource tr.)/Carta 17',
      'Cartas a Lucilio (Wikisource tr.)/Carta 19',
      'Cartas a Lucilio (Wikisource tr.)/Carta 20',
      'Cartas a Lucilio (Wikisource tr.)/Carta 21',
      'Cartas a Lucilio (Wikisource tr.)/Carta 23',
      'Cartas a Lucilio (Wikisource tr.)/Carta 24',
      'Cartas a Lucilio (Wikisource tr.)/Carta 25',
      'Cartas a Lucilio (Wikisource tr.)/Carta 26',
      'Cartas a Lucilio (Wikisource tr.)/Carta 27',
      'Cartas a Lucilio (Wikisource tr.)/Carta 29',
      'Cartas a Lucilio (Wikisource tr.)/Carta 30',
      'Cartas a Lucilio (Wikisource tr.)/Carta 31',
      'Cartas a Lucilio (Wikisource tr.)/Carta 32',
      'Cartas a Lucilio (Wikisource tr.)/Carta 33',
      'Cartas a Lucilio (Wikisource tr.)/Carta 34',
      'Cartas a Lucilio (Wikisource tr.)/Carta 35',
      'Cartas a Lucilio (Wikisource tr.)/Carta 36',
      'Cartas a Lucilio (Wikisource tr.)/Carta 37',
      'Cartas a Lucilio (Wikisource tr.)/Carta 38',
      'Cartas a Lucilio (Wikisource tr.)/Carta 39',
      'Cartas a Lucilio (Wikisource tr.)/Carta 40',
      'Cartas a Lucilio (Wikisource tr.)/Carta 41',
      'Cartas a Lucilio (Wikisource tr.)/Carta 43',
      'Cartas a Lucilio (Wikisource tr.)/Carta 44',
      'Cartas a Lucilio (Wikisource tr.)/Carta 45',
      'Cartas a Lucilio (Wikisource tr.)/Carta 46',
      'Cartas a Lucilio (Wikisource tr.)/Carta 47',
      'Cartas a Lucilio (Wikisource tr.)/Carta 48',
      'Cartas a Lucilio (Wikisource tr.)/Carta 49',
      'Cartas a Lucilio (Wikisource tr.)/Carta 50',
      'Cartas a Lucilio (Wikisource tr.)/Carta 51',
      'Cartas a Lucilio (Wikisource tr.)/Carta 52',
      'Cartas a Lucilio (Wikisource tr.)/Carta 53',
      'Cartas a Lucilio (Wikisource tr.)/Carta 54',
      'Cartas a Lucilio (Wikisource tr.)/Carta 55',
      'Cartas a Lucilio (Wikisource tr.)/Carta 56',
      'Cartas a Lucilio (Wikisource tr.)/Carta 57',
      'Cartas a Lucilio (Wikisource tr.)/Carta 58',
      'Cartas a Lucilio (Wikisource tr.)/Carta 59',
      'Cartas a Lucilio (Wikisource tr.)/Carta 60',
      'Cartas a Lucilio (Wikisource tr.)/Carta 61',
      'Cartas a Lucilio (Wikisource tr.)/Carta 62',
      'Cartas a Lucilio (Wikisource tr.)/Carta 63',
      'Cartas a Lucilio (Wikisource tr.)/Carta 64',
      'Cartas a Lucilio (Wikisource tr.)/Carta 65',
      'Cartas a Lucilio (Wikisource tr.)/Carta 67',
      'Cartas a Lucilio (Wikisource tr.)/Carta 68',
    ],
    librivoxAudioUrl: 'https://librivox.org/cartas-a-lucilio-seleccionadas-by-lucius-annaeus-seneca/',
    librivoxSearchTitle: 'Cartas a Lucilio',
  },
  {
    title: 'La Edad de Oro',
    author: 'José Martí',
    description: 'Revista para niños del héroe cubano: cuentos, poemas y ensayos sobre la libertad y el saber.',
    source: 'wikisource',
    // 'La Edad de Oro' is an index; its ~23 pieces are standalone pages (not
    // /subpages), so they're listed explicitly in the magazine's reading order
    // (4 números; Prólogo first, 'La última página' closes número 1). Original
    // Spanish — low translation risk.
    wikisourceTitles: [
      'La Edad de Oro/Prólogo',
      'Tres héroes',
      'Dos milagros (Martí)',
      'Meñique',
      'Cada uno a su oficio',
      'La Ilíada de Homero',
      'Un juego nuevo y otros viejos',
      'Bebé y el señor don Pomposo',
      'La Edad de Oro/La última página',
      'La historia del hombre, contada por sus casas',
      'Los dos príncipes',
      'Nené traviesa',
      'La perla de la mora',
      'Las ruinas indias',
      'Músicos, poetas y pintores',
      'La exposición de París',
      'El camarón encantado',
      'El Padre las Casas',
      'Los zapaticos de rosa',
      'Un paseo por la tierra de los anamitas',
      'Historia de la cuchara y el tenedor',
      'La muñeca negra',
      'Cuentos de elefantes',
      'Los dos ruiseñores',
      'La galería de las máquinas',
    ],
    librivoxAudioUrl: 'https://librivox.org/la-edad-de-oro-by-jose-marti/',
  },
  {
    title: 'Génesis',
    author: 'Anónimo',
    description: 'El primer libro del Antiguo Testamento: la creación del mundo, Adán y Eva, Noé, Abraham, Isaac, Jacob y José. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Génesis',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/genesis-reina-valera-version/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Salmos',
    author: 'Anónimo',
    description: 'La gran colección de cánticos y oraciones del pueblo de Israel: 150 salmos de alabanza, lamento, gratitud y confianza en Dios. Versión Reina-Valera.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Salmos',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-reina-valera-antigua-19-salmos-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Mateo',
    author: 'Anónimo',
    description: 'El primer evangelio: la vida, enseñanzas, muerte y resurrección de Jesucristo, presentado como el Mesías prometido a Israel. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Mateo',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-reina-valera-nt-01-mateo-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Juan',
    author: 'Anónimo',
    description: 'El cuarto evangelio, centrado en la divinidad de Jesús. Incluye Juan 3:16, los siete milagros y las declaraciones "Yo soy" de Cristo. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Juan',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-reina-valera-nt-04-juan-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Romanos',
    author: 'Anónimo',
    description: 'La carta más sistemática de Pablo: la justificación por la fe, el poder del Espíritu y la vida cristiana en comunidad. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Romanos',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-nt-06-romanos-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Marcos',
    author: 'Anónimo',
    description: 'El evangelio más breve y dinámico: la vida de Jesús narrada con urgencia y acción, desde su bautismo hasta su resurrección. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Marcos',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/el-bible-reina-valera-nt-02-evangelio-segun-marcos-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Lucas',
    author: 'Anónimo',
    description: 'El evangelio más extenso: relato detallado de la vida de Jesús, con especial énfasis en los pobres, las mujeres y la misericordia divina. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Lucas',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-reina-valera-nt-03-lucas-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Hechos',
    author: 'Anónimo',
    description: 'La historia de la iglesia primitiva: el Espíritu Santo en Pentecostés, los apóstoles y los viajes misioneros de Pablo por el mundo mediterráneo. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Hechos',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-reina-valera-nt-05-hechos-de-los-apostoles-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: '1 Corintios',
    author: 'Anónimo',
    description: 'La carta de Pablo a una iglesia dividida: unidad, el himno al amor, los dones espirituales y la resurrección de Cristo. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/1 Corintios',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/1-corintios-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Efesios',
    author: 'Anónimo',
    description: 'Pablo describe la iglesia como cuerpo de Cristo: la gracia, la unidad entre judíos y gentiles, y la armadura de Dios. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Efesios',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-reina-valera-nt-10-la-epistola-del-apostol-san-pablo-a-los-efesios-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Filipenses',
    author: 'Anónimo',
    description: 'La carta de la alegría: Pablo desde prisión anima a los creyentes a regocijarse en Cristo y a buscar la paz que sobrepasa todo entendimiento. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Filipenses',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-reina-valera-nt-11-filipenses-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Hebreos',
    author: 'Anónimo',
    description: 'Jesús como sumo sacerdote eterno: argumentación teológica sobre la superioridad del nuevo pacto y el llamado a la fe perseverante. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Hebreos',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/hebreos-version-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Santiago',
    author: 'Anónimo',
    description: 'Fe sin obras es muerta: enseñanza práctica sobre la vida cristiana, la sabiduría, la oración y el cuidado de los pobres. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Santiago',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/carta-del-apostol-santiago-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Apocalipsis',
    author: 'Anónimo',
    description: 'La visión de Juan en Patmos: cartas a las siete iglesias, los sellos, las trompetas y la Nueva Jerusalén al final de los tiempos. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Apocalipsis',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-reina-valera-nt-27-apocalipsis-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Éxodo',
    author: 'Anónimo',
    description: 'La liberación de Israel de Egipto: Moisés, las diez plagas, el paso del Mar Rojo y la entrega de los Diez Mandamientos en el Sinaí. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Éxodo',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-reina-valera-02-exodo-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Proverbios',
    author: 'Anónimo',
    description: '31 capítulos de sabiduría práctica atribuida a Salomón: consejos sobre la familia, el trabajo, la honestidad y el temor a Dios. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Proverbios',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/bible-reina-valera-1909-20-libro-de-los-proverbios-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },
  {
    title: 'Isaías',
    author: 'Anónimo',
    description: 'El gran profeta del Antiguo Testamento: mensajes de juicio y restauración para Israel, y las profecías del Siervo Sufriente. Versión Reina-Valera 1909.',
    source: 'wikisource',
    wikisourceTitle: 'Biblia Reina-Valera 1909/Isaías',
    collection: 'Biblia Reina-Valera',
    librivoxAudioUrl: 'https://librivox.org/isaias-by-reina-valera/',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
  },

  {
    title: 'Platero y yo',
    author: 'Juan Ramón Jiménez',
    description: 'Elegía andaluza en prosa lírica sobre la amistad entre un poeta y su burro Platero en Moguer. Nobel de Literatura 1956.',
    source: 'gutenberg',
    gutenbergId: 39209,
    librivoxAudioUrl: 'https://librivox.org/platero-y-yo-by-juan-ramon-jimenez/',
    librivoxSearchTitle: 'Platero',
    // No narrativeStartPattern needed — the "Advertencia á los hombres..."
    // front matter is genuinely narrated in the audio (confirmed directly
    // in the chapter 0 transcript), unlike most other books. Back matter
    // is a real gap: a full chapter-by-chapter ÍNDICE after "FIN" that is
    // NOT narrated. 'FIN' confirmed unique, no embedded newline.
    narrativeEndPattern: 'FIN',
  },
  {
    title: 'Pepita Jiménez',
    author: 'Juan Valera',
    description: 'Novela epistolar en la que un joven seminarista descubre que el amor humano puede ser tan sagrado como la vocación religiosa.',
    source: 'gutenberg',
    gutenbergId: 17223,
    librivoxAudioUrl: 'https://librivox.org/pepita-jimenez-by-juan-valera/',
    librivoxSearchTitle: 'Pepita Jiménez',
  },

  // ── English Classics ──────────────────────────────────────────────────────

  {
    title: 'Treasure Island',
    author: 'Robert Louis Stevenson',
    description: 'A young boy discovers a treasure map and sails to a remote island with a crew harboring deadly secrets — the definitive pirate adventure.',
    source: 'gutenberg',
    gutenbergId: 120,
    librivoxAudioUrl: 'https://librivox.org/treasure-island-by-robert-louis-stevenson/',
    language: 'en',
  },
  {
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    description: 'The spirited Elizabeth Bennet navigates love, family, and social convention in Regency England — Austen\'s most beloved novel.',
    source: 'gutenberg',
    gutenbergId: 1342,
    librivoxAudioUrl: 'https://librivox.org/pride-and-prejudice-by-jane-austen/',
    language: 'en',
  },
  {
    title: 'The Call of the Wild',
    author: 'Jack London',
    description: 'A domesticated dog is thrust into the brutal Klondike gold rush and discovers his primal nature — London\'s masterpiece of nature and survival.',
    source: 'gutenberg',
    gutenbergId: 215,
    librivoxAudioUrl: 'https://librivox.org/call-of-the-wild-by-jack-london/',
    language: 'en',
  },
  {
    title: 'Frankenstein',
    author: 'Mary Shelley',
    description: 'Victor Frankenstein creates life from death and is haunted by his creation — the founding work of science fiction and a meditation on ambition.',
    source: 'gutenberg',
    gutenbergId: 84,
    librivoxAudioUrl: 'https://librivox.org/frankenstein-or-modern-prometheus-by-mary-w-shelley/',
    language: 'en',
  },
  {
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    description: 'A portrait ages while its subject stays young and sins freely — Wilde\'s only novel, a dark fable about beauty, corruption, and the soul.',
    source: 'gutenberg',
    gutenbergId: 174,
    librivoxAudioUrl: 'https://librivox.org/the-picture-of-dorian-gray-by-oscar-wilde/',
    language: 'en',
  },
  {
    title: 'The Strange Case of Dr Jekyll and Mr Hyde',
    author: 'Robert Louis Stevenson',
    description: 'A respected doctor unleashes a murderous alter ego — a chilling exploration of duality and the shadow self.',
    source: 'gutenberg',
    gutenbergId: 43,
    librivoxAudioUrl: 'https://librivox.org/the-strange-case-of-dr-jekyll-and-mr-hyde-by-robert-louis-stevenson/',
    language: 'en',
  },
  {
    title: 'The Adventures of Tom Sawyer',
    author: 'Mark Twain',
    description: 'Tom Sawyer\'s boyhood pranks on the Mississippi River — witnessing a murder, searching for treasure, and finding love.',
    source: 'gutenberg',
    gutenbergId: 74,
    librivoxAudioUrl: 'https://librivox.org/tom-sawyer-by-mark-twain/',
    language: 'en',
  },
  {
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    description: 'A girl tumbles down a rabbit hole into a world of impossible logic — Carroll\'s timeless fantasy that invented literary nonsense.',
    source: 'gutenberg',
    gutenbergId: 11,
    librivoxAudioUrl: 'https://librivox.org/alices-adventures-in-wonderland-by-lewis-carroll/',
    language: 'en',
  },
  {
    title: 'The Time Machine',
    author: 'H. G. Wells',
    description: 'A Victorian inventor travels 800,000 years into the future and discovers a humanity divided into two frightening species.',
    source: 'gutenberg',
    gutenbergId: 35,
    librivoxAudioUrl: 'https://librivox.org/the-time-machine-by-hg-wells/',
    language: 'en',
  },
  {
    title: 'Anne of Green Gables',
    author: 'L. M. Montgomery',
    description: 'An orphan girl with a vivid imagination finds a home and family on Prince Edward Island — one of literature\'s most beloved coming-of-age stories.',
    source: 'gutenberg',
    gutenbergId: 45,
    librivoxAudioUrl: 'https://librivox.org/anne-of-green-gables-by-lucy-maud-montgomery/',
    language: 'en',
  },
  {
    title: 'Dracula',
    author: 'Bram Stoker',
    description: 'A solicitor travels to Transylvania and encounters the undead — Stoker\'s epistolary masterpiece that defined the vampire in modern culture.',
    source: 'gutenberg',
    gutenbergId: 345,
    librivoxAudioUrl: 'https://librivox.org/dracula-by-bram-stoker/',
    language: 'en',
  },
  {
    title: 'The Scarlet Letter',
    author: 'Nathaniel Hawthorne',
    description: 'A woman in Puritan Boston bears a scarlet A for adultery while the true sinner hides in plain sight — Hawthorne\'s masterwork on guilt and redemption.',
    source: 'gutenberg',
    gutenbergId: 25344,
    librivoxAudioUrl: 'https://librivox.org/the-scarlet-letter-by-nathaniel-hawthorne/',
    language: 'en',
  },

  {
    title: 'Walden',
    author: 'Henry David Thoreau',
    description: 'Two years alone in a cabin by Walden Pond — the defining American meditation on self-reliance, simplicity, and living deliberately in nature.',
    source: 'gutenberg',
    gutenbergId: 205,
    librivoxAudioUrl: 'https://librivox.org/walden-by-henry-david-thoreau',
    language: 'en',
    // BUG FOUND 2026-06-24: original pattern had embedded newlines but the
    // real Gutenberg file uses \r\n — silently never matched. Also "ON THE
    // DUTY OF CIVIL DISOBEDIENCE" alone isn't safe regardless — it appears
    // in the title page and table of contents before the real second-essay
    // heading. Anchoring on "THE END" (confirmed unique, appears right
    // after Walden's real closing line and before the second essay begins).
    narrativeEndPattern: 'THE END',
  },

  {
    title: 'Meditations',
    author: 'Marcus Aurelius',
    description: 'Personal reflections of the Roman Emperor Marcus Aurelius — the definitive Stoic guide to resilience, duty, and the art of living with purpose.',
    source: 'gutenberg',
    gutenbergId: 2680,
    language: 'en',
    librivoxAudioUrl: 'https://librivox.org/the-meditations-of-marcus-aurelius/',
    librivoxSearchTitle: 'Meditations Marcus Aurelius',
    // BUG FOUND 2026-06-24: original endPattern '\nAPPENDIX\n' has embedded
    // newlines but the real Gutenberg file uses \r\n — silently never
    // matched. Also "APPENDIX" alone isn't safe regardless — it appears
    // first in a front-of-book table of contents, which indexOf would
    // match instead of the real appendix heading. Anchoring on the real
    // closing sentence of Book Twelve instead, confirmed unique.
    narrativeStartPattern: 'THE FIRST BOOK',
    narrativeEndPattern: 'dismisseth thee.',
  },
  {
    title: 'Jane Eyre',
    author: 'Charlotte Brontë',
    description: 'A plain-spoken orphan grows into a fiercely independent woman — Brontë\'s masterwork on love, identity, and the courage to refuse compromise.',
    source: 'gutenberg',
    gutenbergId: 1260,
    language: 'en',
    librivoxAudioUrl: 'https://librivox.org/jane-eyre-by-charlotte-bront/',
    librivoxSearchTitle: 'Jane Eyre',
  },

  // ── English self-development / leadership (first wave) ─────────────────────
  // Public-domain business & personal-growth classics. Gutenberg IDs + LibriVox
  // recordings verified 2026-06-30. isFree stays false until each clears the 90%
  // sync gate. NOTE: for translated works (Art of War = Giles), the LibriVox
  // reader must use the SAME translation as the Gutenberg text or the aligner
  // hits an edition mismatch (see troubleshooting §6).
  {
    title: 'As a Man Thinketh',
    author: 'James Allen',
    description: 'A short, enduring meditation on how thought shapes character, circumstance, and destiny — the seed text of the modern self-development movement.',
    source: 'gutenberg',
    gutenbergId: 4507,
    librivoxAudioUrl: 'https://librivox.org/as-a-man-thinketh-by-james-allen/',
    language: 'en',
  },
  {
    title: 'The Art of War',
    author: 'Sun Tzu',
    description: 'The oldest treatise on strategy, leadership, and competition — Lionel Giles’ classic translation, read for centuries by generals and now by founders.',
    source: 'gutenberg',
    gutenbergId: 132,
    librivoxAudioUrl: 'https://librivox.org/the-art-of-war-by-sun-tzu/',
    librivoxSearchTitle: 'Art of War',
    language: 'en',
  },
  {
    title: 'The Science of Getting Rich',
    author: 'Wallace D. Wattles',
    description: 'The 1910 classic on purposeful action and the mindset of wealth that inspired a century of prosperity writing, from Napoleon Hill to modern coaches.',
    source: 'gutenberg',
    gutenbergId: 59844,
    librivoxAudioUrl: 'https://librivox.org/the-science-of-getting-rich-by-wallace-d-wattles/',
    language: 'en',
  },
  {
    title: 'The Game of Life and How to Play It',
    author: 'Florence Scovel Shinn',
    description: 'A practical guide to the laws of intuition, faith, and the spoken word — one of the most quoted texts on mindset and manifestation.',
    source: 'gutenberg',
    gutenbergId: 74878,
    librivoxAudioUrl: 'https://librivox.org/the-game-of-life-and-how-to-play-it-by-florence-scovel-shinn/',
    librivoxSearchTitle: 'Game of Life and How to Play It',
    language: 'en',
  },
  {
    title: 'How to Live on 24 Hours a Day',
    author: 'Arnold Bennett',
    description: 'A brisk, witty manual on reclaiming your time and living deliberately — the original productivity classic, as sharp now as in 1908.',
    source: 'gutenberg',
    gutenbergId: 2274,
    librivoxAudioUrl: 'https://librivox.org/how-to-live-on-twenty-four-hours-a-day-by-arnold-bennett/',
    librivoxSearchTitle: 'Twenty-Four Hours a Day',
    language: 'en',
  },
  {
    title: 'Up from Slavery',
    author: 'Booker T. Washington',
    description: 'Washington’s landmark autobiography — rising from enslavement to found Tuskegee — a defining American story of self-reliance, education, and leadership.',
    source: 'gutenberg',
    gutenbergId: 2376,
    librivoxAudioUrl: 'https://librivox.org/up-from-slavery-from-booker-t-washington/',
    librivoxSearchTitle: 'Up from Slavery',
    language: 'en',
  },

  // ── English Bible (KJV) — collection: 'Bible' ─────────────────────────────

  {
    title: 'Genesis',
    author: 'Anonymous',
    description: 'The first book of the Old Testament: creation, Adam and Eve, Noah, Abraham, Isaac, Jacob, and Joseph. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Genesis',
    librivoxAudioUrl: 'https://librivox.org/bible-kjv-01-03-genesis-exodus-and-leviticus/',
    librivoxSearchTitle: 'King James Bible Genesis',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Exodus',
    author: 'Anonymous',
    description: 'Israel\'s liberation from Egypt: Moses, the ten plagues, the parting of the Red Sea, and the Ten Commandments at Sinai. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Exodus',
    librivoxAudioUrl: 'https://librivox.org/bible-kjv-01-03-genesis-exodus-and-leviticus/',
    librivoxSearchTitle: 'King James Bible Exodus',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Psalms',
    author: 'Anonymous',
    description: '150 poems of praise, lament, trust, and thanksgiving — the prayer book of ancient Israel and the most-read book of the Bible. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Psalms',
    librivoxAudioUrl: 'https://librivox.org/the-book-of-psalms-king-james-version/',
    librivoxSearchTitle: 'King James Bible Psalms',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Proverbs',
    author: 'Anonymous',
    description: '31 chapters of practical wisdom on family, work, honesty, and the fear of God, attributed to Solomon. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Proverbs',
    librivoxAudioUrl: 'https://librivox.org/proverbs-king-james-version/',
    librivoxSearchTitle: 'King James Bible Proverbs',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Isaiah',
    author: 'Anonymous',
    description: 'The great prophet of the Old Testament: messages of judgment and restoration for Israel, and the Suffering Servant prophecies. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Isaiah',
    librivoxAudioUrl: 'https://librivox.org/isaiah-king-james-version/',
    librivoxSearchTitle: 'King James Bible Isaiah',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Matthew',
    author: 'Anonymous',
    description: 'The first Gospel: the life, teachings, death, and resurrection of Jesus Christ, presented as the promised Messiah. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Matthew',
    librivoxAudioUrl: 'https://librivox.org/matthew-king-james-version/',
    librivoxSearchTitle: 'King James Bible Matthew',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Mark',
    author: 'Anonymous',
    description: 'The shortest and most urgent Gospel — the life of Jesus narrated with action and immediacy from baptism to resurrection. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Mark',
    librivoxAudioUrl: 'https://librivox.org/gospel-of-mark-king-james-version/',
    librivoxSearchTitle: 'King James Bible Mark',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Luke',
    author: 'Anonymous',
    description: 'The most detailed Gospel, with special emphasis on the poor, women, and the mercy of God — includes the parables of the prodigal son and good Samaritan. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Luke',
    librivoxAudioUrl: 'https://librivox.org/bible-kjv-nt-03-luke/',
    librivoxSearchTitle: 'King James Bible Luke',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'John',
    author: 'Anonymous',
    description: 'The fourth Gospel, focused on the divinity of Jesus. Includes John 3:16, the seven signs, and the great "I am" sayings. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/John',
    librivoxAudioUrl: 'https://librivox.org/john-by-king-james-version/',
    librivoxSearchTitle: 'King James Bible John',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Acts',
    author: 'Anonymous',
    description: 'The history of the early church: the Holy Spirit at Pentecost, the apostles, and Paul\'s missionary journeys across the Mediterranean world. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Acts',
    librivoxAudioUrl: 'https://librivox.org/acts-king-james-version/',
    librivoxSearchTitle: 'King James Bible Acts',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Romans',
    author: 'Anonymous',
    description: 'Paul\'s most systematic letter: justification by faith, the power of the Spirit, and Christian life in community. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Romans',
    librivoxAudioUrl: 'https://librivox.org/romans-king-james-version/',
    librivoxSearchTitle: 'King James Bible Romans',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: '1 Corinthians',
    author: 'Anonymous',
    description: 'Paul\'s letter to a divided church: unity, the hymn to love (chapter 13), spiritual gifts, and the resurrection. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/1 Corinthians',
    librivoxAudioUrl: 'https://librivox.org/1-corinthians-king-james-version/',
    librivoxSearchTitle: 'King James Bible 1 Corinthians',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Ephesians',
    author: 'Anonymous',
    description: 'Paul describes the church as the body of Christ: grace, unity between Jews and Gentiles, and the armor of God. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Ephesians',
    librivoxAudioUrl: 'https://librivox.org/4-epistles-king-james-version/',
    librivoxSearchTitle: 'King James Bible Ephesians',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Philippians',
    author: 'Anonymous',
    description: 'The letter of joy: Paul from prison encourages believers to rejoice in Christ and seek the peace that passes all understanding. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Philippians',
    librivoxAudioUrl: 'https://librivox.org/4-epistles-king-james-version/',
    librivoxSearchTitle: 'King James Bible Philippians',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Hebrews',
    author: 'Anonymous',
    description: 'Jesus as eternal high priest — a theological argument for the superiority of the new covenant and a call to persevering faith. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Hebrews',
    librivoxAudioUrl: 'https://librivox.org/hebrews-king-james-version/',
    librivoxSearchTitle: 'King James Bible Hebrews',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'James',
    author: 'Anonymous',
    description: 'Faith without works is dead — practical teaching on Christian living, wisdom, prayer, and care for the poor. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/James',
    librivoxAudioUrl: 'https://librivox.org/book-of-james-kjv/',
    librivoxSearchTitle: 'King James Bible James',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },
  {
    title: 'Revelation',
    author: 'Anonymous',
    description: 'John\'s vision on Patmos: letters to the seven churches, the seals and trumpets, and the New Jerusalem at the end of time. King James Version.',
    source: 'wikisource',
    wikisourceTitle: 'Bible (King James)/Revelation',
    librivoxAudioUrl: 'https://librivox.org/revelation-king-james-version/',
    librivoxSearchTitle: 'King James Bible Revelation',
    coverUrl: 'https://covers.openlibrary.org/b/id/12324628-L.jpg',
    collection: 'Bible',
    language: 'en',
  },

  // ── Literatura Infantil ────────────────────────────────────────────────────

  {
    title: 'Fábulas y Verdades',
    author: 'Rafael Pombo',
    description:
      'La obra más querida del poeta colombiano: fábulas en verso para niños que incluyen El Renacuajo Paseador, Simón el Bobito, La Pobre Viejecita y Mirringa Mirronga. Dominio público.',
    source: 'wikisource',
    wikisourceTitles: [
      'El renacuajo paseador',
      'Simón el bobito',
      'La pobre viejecita',
      'Mirringa Mirronga',
      'El gato bandido',
      'Pastorcita',
      'Cutufato y su gato',
      'El búho y el palomo',
      'El niño y la mariposa',
      'La marrana peripuesta',
      'El coche',
    ],
    librivoxAudioUrl: 'https://librivox.org/fabulas-y-verdades-by-rafael-pombo/',
    coverUrl: '/covers/fabulas-pombo.png',
  },
  {
    title: 'Cuentos de la Selva',
    author: 'Horacio Quiroga',
    description:
      'Ocho cuentos para niños ambientados en la selva misionera: La Abeja Haragana, Las Medias de los Flamencos, La Tortuga Gigante y más. Obra hermana de los Cuentos de Amor ya disponibles en Noetia. Dominio público.',
    source: 'wikisource',
    // Order matches the LibriVox audio's actual chapter sequence (confirmed
    // from each chapter file's spoken title announcement), not the order the
    // stories are usually published in. The two orders are unrelated — the
    // previous list order silently misaligned every story against the wrong
    // audio chapter.
    wikisourceTitles: [
      'La abeja haragana',
      'Historia de dos cachorros de coatí y de dos cachorros de hombre',
      'Las medias de los flamencos',
      'La tortuga gigante',
      'El paso del Yabebirí',
      'El loro pelado',
      'La guerra de los yacarés',
      'La gama ciega',
    ],
    librivoxAudioUrl: 'https://librivox.org/cuentos-de-la-selva-para-los-ninos-by-horacio-quiroga/',
    librivoxSearchTitle: 'Cuentos de la Selva',
    coverUrl: '/covers/cuentos-selva.png',
  },

  // ── Pending rights — do NOT ingest until authorization is confirmed ────────

  // Rights request sent 2026-06-10 to diritti.lev@spc.va (LEV Ufficio Diritti) from pronoiallc@gmail.com.
  // Requested: free reproduction of full text, Vatican News EN audio licensing, advance auth for future ES audio.
  // Text source: https://www.vatican.va/content/leo-xiv/es/encyclicals/documents/20260515-magnifica-humanitas.html
  // Audio: no Spanish recording exists as of 2026-06-10.
  {
    pendingRights: true,
    source: 'vatican',
    title: 'Magnifica Humanitas',
    author: 'León XIV',
    description:
      'Carta encíclica del Papa León XIV sobre la salvaguarda de la persona humana en tiempos de inteligencia artificial. Introducción + 5 capítulos + Conclusión; 245 párrafos; ~37.000 palabras.',
    language: 'es',
  },

  // Rights request sent 2026-06-10 to diritti.lev@spc.va (LEV Ufficio Diritti) from pronoiallc@gmail.com.
  // Text source: https://www.vatican.va/content/leo-xiv/en/encyclicals/documents/20260515-magnifica-humanitas.html
  // Audio: Vatican News EN audiobook (7 files, ~4.5–6h, narrator Sr. Bernadette Reis FSP) — licensing TBD.
  {
    pendingRights: true,
    source: 'vatican',
    title: 'Magnifica Humanitas',
    author: 'Leo XIV',
    description:
      'Encyclical letter of Pope Leo XIV on safeguarding the human person in the time of artificial intelligence. Introduction + 5 chapters + Conclusion; 245 paragraphs; ~37,000 words.',
    language: 'en',
    externalAudioUrl: 'https://www.vaticannews.va/en/podcast/magnifica-humanitas.html',
  },
];
