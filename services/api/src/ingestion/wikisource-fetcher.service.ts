import { Injectable } from '@nestjs/common';

interface WikisourceParseResponse {
  parse?: { text?: string; links?: Array<{ title?: string; ns?: number }> };
  error?: { info: string };
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
        const mA = /(\d+)\s*$/.exec(segA);
        const mB = /(\d+)\s*$/.exec(segB);
        if (mA && mB) {
          const prefA = segA.slice(0, segA.length - mA[0].length);
          const prefB = segB.slice(0, segB.length - mB[0].length);
          if (prefA === prefB) return parseInt(mA[1], 10) - parseInt(mB[1], 10);
        }
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
