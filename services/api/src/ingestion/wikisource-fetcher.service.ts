import { Injectable } from '@nestjs/common';

interface WikisourceParseResponse {
  parse?: { text?: string; links?: Array<{ title?: string; ns?: number }> };
  error?: { info: string };
}

@Injectable()
export class WikisourceFetcherService {
  /**
   * Fetches the full text of a Wikisource book. Wikisource structures long
   * works as an index page with per-chapter subpages (e.g. "Title/I",
   * "Title/Capítulo 1"). We detect subpages via the index page's link list
   * and concatenate every chapter; if none exist we fall back to the single
   * page. This avoids returning the raw index metadata instead of book text.
   */
  async fetch(pageTitle: string): Promise<string> {
    const subpages = await this.listSubpages(pageTitle);

    if (subpages.length === 0) {
      return this.fetchPageHtml(pageTitle);
    }

    const parts: string[] = [];
    for (const sub of subpages) {
      await this.sleep(400);
      try {
        const text = await this.fetchPageHtml(sub);
        if (text.trim().length > 100) parts.push(text);
      } catch {
        // skip chapters that can't be fetched
      }
    }

    return parts.length > 0 ? parts.join('\n\n') : this.fetchPageHtml(pageTitle);
  }

  private readonly headers = {
    'User-Agent': 'Alexandria-Ingestion/1.0 (https://github.com/Carloskfe/alexandria)',
  };

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async listSubpages(pageTitle: string): Promise<string[]> {
    const encoded = encodeURIComponent(pageTitle);
    const url =
      `https://es.wikisource.org/w/api.php` +
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
        // If both segments end with a number (e.g. "Capítulo 10" or "10"), sort numerically
        const mA = /(\d+)\s*$/.exec(segA);
        const mB = /(\d+)\s*$/.exec(segB);
        if (mA && mB) {
          const prefA = segA.slice(0, segA.length - mA[0].length);
          const prefB = segB.slice(0, segB.length - mB[0].length);
          if (prefA === prefB) return parseInt(mA[1], 10) - parseInt(mB[1], 10);
        }
        return a.localeCompare(b, 'es');
      });
  }

  private async fetchPageHtml(pageTitle: string): Promise<string> {
    const encoded = encodeURIComponent(pageTitle);
    const url =
      `https://es.wikisource.org/w/api.php` +
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

  private stripHtml(html: string): string {
    return html
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
      .replace(/&nbsp;/g, ' ')
      // Normalize spacing — preserve paragraph breaks, collapse inline spaces
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
