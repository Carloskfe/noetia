import { Injectable } from '@nestjs/common';

interface WikisourceParseResponse {
  parse?: { text?: string; links?: Array<{ title?: string; ns?: number }> };
  error?: { info: string };
}

const STRICT_ROMAN_NUMERAL = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

/** Converts a strict Roman numeral string to its integer value, or null if
 *  the string isn't a valid Roman numeral (used for sorting Wikisource
 *  subpages named just "I", "II", "IX", "XIV"... — plain alphabetical sort
 *  puts "IX" before "V" and "XIX" before "XV", scrambling chapter order). */
export function romanToInt(value: string): number | null {
  if (!value || !STRICT_ROMAN_NUMERAL.test(value)) return null;
  const upper = value.toUpperCase();
  let result = 0;
  for (let i = 0; i < upper.length; i++) {
    const current = ROMAN_VALUES[upper[i]];
    const next = ROMAN_VALUES[upper[i + 1]];
    result += next && current < next ? -current : current;
  }
  return result;
}

interface TrailingNumber {
  prefix: string;
  value: number;
}

// Spelled-out Spanish ordinals (e.g. Lazarillo de Tormes' "Tratado primero",
// "Tratado segundo"...). Keys are accent-stripped lowercase; lookup
// normalizes the candidate word the same way. Covers 1st-30th, which is
// more than any catalogued book currently needs.
const SPANISH_ORDINAL_WORDS: Record<string, number> = {
  primero: 1, primer: 1, segundo: 2, tercero: 3, tercer: 3, cuarto: 4, quinto: 5,
  sexto: 6, septimo: 7, setimo: 7, octavo: 8, noveno: 9, nono: 9, decimo: 10,
  undecimo: 11, decimoprimero: 11, duodecimo: 12, decimosegundo: 12,
  decimotercero: 13, decimotercio: 13, decimocuarto: 14, decimoquinto: 15,
  decimosexto: 16, decimoseptimo: 17, decimoctavo: 18, decimonoveno: 19,
  decimonono: 19, vigesimo: 20, vigesimoprimero: 21, vigesimosegundo: 22,
  vigesimotercero: 23, vigesimocuarto: 24, vigesimoquinto: 25, vigesimosexto: 26,
  vigesimoseptimo: 27, vigesimoctavo: 28, vigesimonoveno: 29, trigesimo: 30,
};

function stripAccents(word: string): string {
  return word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Extracts a trailing Arabic numeral, Roman numeral, or spelled-out
 *  Spanish ordinal word, plus the prefix before it (e.g. "Capítulo IX" →
 *  { prefix: "Capítulo ", value: 9 }, "Tratado primero" →
 *  { prefix: "Tratado ", value: 1 }), or null if the segment doesn't end in
 *  a recognizable number. Tries Arabic digits first (cheapest, unambiguous),
 *  then Roman numerals, then ordinal words. */
function extractTrailingNumber(segment: string): TrailingNumber | null {
  const arabic = /(\d+)\s*$/.exec(segment);
  if (arabic) {
    return { prefix: segment.slice(0, segment.length - arabic[0].length), value: parseInt(arabic[1], 10) };
  }
  const roman = /\b([IVXLCDM]+)\s*$/i.exec(segment);
  if (roman) {
    const value = romanToInt(roman[1]);
    if (value !== null) {
      return { prefix: segment.slice(0, segment.length - roman[0].length), value };
    }
  }
  const word = /([a-záéíóúñ]+)\s*$/i.exec(segment);
  if (word) {
    const value = SPANISH_ORDINAL_WORDS[stripAccents(word[1])];
    if (value !== undefined) {
      return { prefix: segment.slice(0, segment.length - word[0].length), value };
    }
  }
  return null;
}

// Un-numbered front/back-matter subpages (e.g. "Prefacio") don't match any
// numeral pattern, so plain sort logic falls through to alphabetical —
// which puts "Prefacio" (P) after "Capítulo XXXVI" (C), appending it at the
// very END of the book instead of the very start. Confirmed via the live
// Wikisource API for El sombrero de tres picos (1874): 36 numbered chapters
// sort correctly, but "Prefacio" lands last. Whether this content is
// actually narrated is book-specific (handle via catalogue.ts
// narrativeStartPattern/textPostProcess) — this only fixes the ORDER so
// that downstream trimming has a sane position to work with.
const FRONT_MATTER_KEYWORDS = ['prologo', 'prefacio', 'introduccion', 'proemio', 'advertencia', 'dedicatoria'];
const BACK_MATTER_KEYWORDS = ['epilogo', 'apendice', 'indice', 'conclusion', 'glosario', 'notas'];

/** Returns -1 for recognized front-matter keywords, Infinity for recognized
 *  back-matter keywords, or null if the segment isn't one of these (i.e. a
 *  normal numbered chapter, sorted by extractTrailingNumber instead). */
function frontOrBackMatterRank(segment: string): number | null {
  const normalized = stripAccents(segment.trim());
  if (FRONT_MATTER_KEYWORDS.includes(normalized)) return -1;
  if (BACK_MATTER_KEYWORDS.includes(normalized)) return Infinity;
  return null;
}

@Injectable()
export class WikisourceFetcherService {
  /**
   * Fetches and concatenates multiple individual Wikisource pages into one text.
   * Used for collected works whose individual poems/stories exist as separate pages
   * but have no shared index page (e.g. Rafael Pombo's fables).
   */
  async fetchMultiple(pageTitles: string[], lang = 'es'): Promise<string> {
    const parts: string[] = [];
    for (const title of pageTitles) {
      await this.sleep(400);
      try {
        const text = await this.fetchPageHtml(title, lang);
        if (text.trim().length > 20) {
          const shortTitle = title.split('/').pop() ?? title;
          parts.push(`\n\n##HEADING## ${shortTitle}\n\n${text}`);
        }
      } catch {
        // skip pages that can't be fetched
      }
    }
    if (parts.length === 0) throw new Error(`None of the provided pages could be fetched`);
    return parts.join('\n\n');
  }

  /**
   * Fetches the full text of a Wikisource book. Wikisource structures long
   * works as an index page with per-chapter subpages (e.g. "Title/I",
   * "Title/Capítulo 1"). We detect subpages via the index page's link list
   * and concatenate every chapter; if none exist we fall back to the single
   * page. This avoids returning the raw index metadata instead of book text.
   */
  async fetch(pageTitle: string, lang = 'es'): Promise<string> {
    const subpages = await this.listSubpages(pageTitle, lang);

    if (subpages.length === 0) {
      return this.fetchPageHtml(pageTitle, lang);
    }

    const parts: string[] = [];
    for (const sub of subpages) {
      await this.sleep(400);
      try {
        const text = await this.fetchPageHtml(sub, lang);
        if (text.trim().length > 100) parts.push(text);
      } catch {
        // skip chapters that can't be fetched
      }
    }
    const concatenated = parts.join('\n\n');

    // Some pages expose incidental wikilinks to a few of their own subpages
    // without being a real chapter index. "Bible (King James)/Genesis" is a
    // single page holding all 50 chapters inline, yet it links to only 14
    // scattered "/Chapter N" subpages (1-9, 13, 15, 25, 29, 31); following
    // just those yields a truncated, out-of-order third of the book. A genuine
    // index page holds little prose of its own — the chapters live on the
    // subpages, so the concatenated subpages dwarf it — whereas an
    // incidental-link page is the reverse. Fetch the single page too and keep
    // whichever yields more text. (A failed/empty single-page fetch folds to
    // '' so the subpage text still wins.)
    await this.sleep(400);
    const singlePage = await this.fetchPageHtml(pageTitle, lang).catch(() => '');

    if (concatenated.trim().length === 0) return singlePage;
    return singlePage.length > concatenated.length ? singlePage : concatenated;
  }

  private readonly headers = {
    'User-Agent': 'Noetia-Ingestion/1.0 (https://github.com/Carloskfe/noetia)',
  };

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async listSubpages(pageTitle: string, lang = 'es'): Promise<string[]> {
    const encoded = encodeURIComponent(pageTitle);
    const url =
      `https://${lang}.wikisource.org/w/api.php` +
      `?action=parse&page=${encoded}&prop=links&format=json&formatversion=2`;
    const res = await globalThis.fetch(url, { headers: this.headers });
    if (!res.ok) return [];
    const data = (await res.json()) as WikisourceParseResponse;
    return (data.parse?.links ?? [])
      .filter((l) => typeof l.title === 'string' && l.title.startsWith(`${pageTitle}/`))
      .map((l) => l.title as string)
      .sort((a, b) => {
        const segA = a.split('/').pop() ?? '';
        const segB = b.split('/').pop() ?? '';
        const fbA = frontOrBackMatterRank(segA);
        const fbB = frontOrBackMatterRank(segB);
        if (fbA !== null || fbB !== null) {
          const rankA = fbA ?? 0;
          const rankB = fbB ?? 0;
          if (rankA !== rankB) return rankA - rankB;
        }
        const numA = extractTrailingNumber(segA);
        const numB = extractTrailingNumber(segB);
        if (numA && numB && numA.prefix === numB.prefix) return numA.value - numB.value;
        return a.localeCompare(b, lang);
      });
  }

  private async fetchPageHtml(pageTitle: string, lang = 'es'): Promise<string> {
    const encoded = encodeURIComponent(pageTitle);
    const url =
      `https://${lang}.wikisource.org/w/api.php` +
      `?action=parse&page=${encoded}&prop=text&format=json&formatversion=2`;
    const res = await globalThis.fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Wikisource fetch failed for "${pageTitle}": HTTP ${res.status}`);
    }
    const data = (await res.json()) as WikisourceParseResponse;
    if (data.error) {
      throw new Error(`Wikisource API error for "${pageTitle}": ${data.error.info}`);
    }
    if (!data.parse?.text) {
      throw new Error(`No text returned by Wikisource for "${pageTitle}"`);
    }
    return this.stripHtml(data.parse.text);
  }

  /**
   * Removes a balanced <tag>…</tag> block that contains the given attribute
   * string, handling nested tags of the same name. Used to strip Wikisource
   * elements that are present in rendered HTML but are not part of the book
   * text: navigation templates (<div id="headertemplate">, ws-data, …) and
   * sidenote spans (<span class="wst-marginnote">, which wraps both the
   * "‖ Some read…" marginal notes and the running "…before the Common Account
   * called Anno Dom." chronology headers in the KJV edition).
   */
  private removeBalancedTag(html: string, tag: string, attr: string): string {
    const open = `<${tag}`;
    const close = `</${tag}>`;
    let result = html;
    // Loop until no more matching blocks remain (a chapter can hold 100+).
    for (let guard = 0; guard < 5000; guard++) {
      const attrIdx = result.indexOf(attr);
      if (attrIdx < 0) break;
      const start = result.lastIndexOf(open, attrIdx);
      if (start < 0) break;
      let depth = 0;
      let i = start;
      let found = -1;
      while (i < result.length) {
        if (result[i] === '<') {
          if (result.slice(i, i + open.length).toLowerCase() === open) depth++;
          else if (result.slice(i, i + close.length).toLowerCase() === close) {
            depth--;
            if (depth === 0) { found = i; break; }
          }
        }
        i++;
      }
      if (found < 0) break;
      result = result.slice(0, start) + result.slice(found + close.length);
    }
    return result;
  }

  private removeDiv(html: string, attr: string): string {
    return this.removeBalancedTag(html, 'div', attr);
  }

  /**
   * Removes the KJV per-chapter "argument" summaries — the table-of-contents
   * blocks printed under each chapter heading ("1 The genealogy of Christ from
   * Abraham to Joseph. 18 The miraculous conception of Mary…"). They are never
   * narrated, so each one becomes an alignment exception (≈40 in Matthew).
   * They render as <div class="wst-hanging-indent"> whose body holds
   * verse-anchor links (href="#chapter:verse"). Poetry (Psalms, Proverbs) uses
   * the same div class but never contains those anchors, so requiring a verse
   * anchor strips only the arguments and leaves poetic indentation intact.
   */
  private removeArgumentDivs(html: string): string {
    const cls = 'class="wst-hanging-indent"';
    const verseAnchor = /href="#\d+:\d+"/;
    let result = html;
    let from = 0;
    for (let guard = 0; guard < 5000; guard++) {
      const clsIdx = result.indexOf(cls, from);
      if (clsIdx < 0) break;
      const start = result.lastIndexOf('<div', clsIdx);
      if (start < 0) break;
      let depth = 0;
      let i = start;
      let end = -1;
      while (i < result.length) {
        if (result[i] === '<') {
          if (result.slice(i, i + 4).toLowerCase() === '<div') depth++;
          else if (result.slice(i, i + 6).toLowerCase() === '</div>') {
            depth--;
            if (depth === 0) { end = i; break; }
          }
        }
        i++;
      }
      if (end < 0) break;
      const blockEnd = end + 6;
      if (verseAnchor.test(result.slice(start, blockEnd))) {
        result = result.slice(0, start) + result.slice(blockEnd);
        from = start;
      } else {
        from = blockEnd; // poetry hanging-indent — keep it, scan past
      }
    }
    return result;
  }

  private stripHtml(html: string): string {
    // Strip Wikisource navigation/metadata blocks before extracting text
    let processed = html;
    processed = this.removeDiv(processed, 'id="headertemplate"');
    processed = this.removeDiv(processed, 'id="footertemplate"');
    processed = this.removeDiv(processed, 'id="ws-data"');
    processed = this.removeDiv(processed, 'class="ws-noexport"');
    processed = this.removeDiv(processed, 'class="notes"');
    // KJV sidenotes: marginal notes ("‖ Some read…") and running chronology
    // headers ("…before the Common Account called Anno Dom.") — never narrated.
    processed = this.removeBalancedTag(processed, 'span', 'class="wst-marginnote"');
    // KJV inline marginal glosses — the dense "† Heb. expansion.", "Or, creeping.",
    // "† Gr. Maleleel." translator notes, wrapped in <span class="wst-sidenote
    // wst-sidenote-right">…</span> (Genesis alone has 146). The narrator skips all
    // marginalia, so leaving them in caps verse confidence near 30%. Match on the
    // class prefix (the attribute carries a trailing modifier class).
    processed = this.removeBalancedTag(processed, 'span', 'class="wst-sidenote');
    // KJV per-chapter argument/TOC summaries — never narrated.
    processed = this.removeArgumentDivs(processed);

    return processed
      // Remove non-content blocks entirely
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Convert headings to structural markers before stripping
      .replace(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, '\n\n##HEADING## $1\n\n')
      // Paragraph endings become double newlines
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // Strip remaining tags
      .replace(/<[^>]+>/g, ' ')
      // Decode entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#160;/g, ' ')
      .replace(/&#32;/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, ' ')
      // Drop the in-text double-vertical-line markers (U+2016) that flag a KJV
      // marginal note; the note span itself is already removed above.
      .replace(/‖/g, ' ')
      // The KJV Old Testament pages are transcribed from the 1611 facsimile, which
      // sets medial/initial s as the archaic "long s" (ſ, U+017F) — "ſerpent",
      // "fleſh", "bleſſed" — plus the long-s ligatures ﬅ (ſt) and ﬆ (st). LibriVox
      // narrators read these as a normal "s", so fold them to "s" for both reader
      // display and phrase alignment. (NFKD does not map U+017F → s, so it must be
      // done explicitly.) NT books use a modern edition and are unaffected.
      .replace(/ſ/g, 's')
      .replace(/[ﬅﬆ]/g, 'st')
      // The inline "†" caret that anchors a KJV sidenote sits just outside the
      // <span class="wst-sidenote"> (now removed above), so it would otherwise
      // survive as a stray marker mid-verse ("Let there be a † firmament"). The
      // dagger is never narrated, so drop any that remain.
      .replace(/†/g, ' ')
      // Normalize spacing — preserve paragraph breaks, collapse inline spaces
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
