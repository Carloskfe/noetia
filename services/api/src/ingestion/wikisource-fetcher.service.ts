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

    return parts.length > 0 ? parts.join('\n\n') : this.fetchPageHtml(pageTitle, lang);
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
   * Removes a balanced <div> block that contains the given attribute string.
   * Used to strip Wikisource navigation templates (headertemplate, ws-data, etc.)
   * that are present in rendered HTML but are not part of the book text.
   */
  private removeDiv(html: string, attr: string): string {
    let result = html;
    // Repeat until no more matching blocks (handles duplicates)
    for (let pass = 0; pass < 10; pass++) {
      const attrIdx = result.indexOf(attr);
      if (attrIdx < 0) break;
      const divStart = result.lastIndexOf('<div', attrIdx);
      if (divStart < 0) break;
      let depth = 0;
      let i = divStart;
      let found = -1;
      while (i < result.length) {
        if (result[i] === '<') {
          if (result.slice(i, i + 4).toLowerCase() === '<div') depth++;
          else if (result.slice(i, i + 6).toLowerCase() === '</div>') {
            depth--;
            if (depth === 0) { found = i; break; }
          }
        }
        i++;
      }
      if (found < 0) break;
      result = result.slice(0, divStart) + result.slice(found + 6);
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
      // Normalize spacing — preserve paragraph breaks, collapse inline spaces
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
