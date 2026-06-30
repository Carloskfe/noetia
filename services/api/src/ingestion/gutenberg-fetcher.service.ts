import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GutenbergFetcherService {
  private readonly logger = new Logger(GutenbergFetcherService.name);

  async fetch(
    gutenbergId: number,
    narrativeStartPattern?: string,
    narrativeEndPattern?: string,
  ): Promise<string> {
    const raw = await this.fetchRaw(gutenbergId);
    let text = this.stripHeaders(raw);
    text = this.trimNarrative(text, narrativeStartPattern, narrativeEndPattern);
    return text;
  }

  /**
   * Fetch the raw Project Gutenberg text, trying the primary cache URL first and
   * falling back to the pglaf mirror. gutenberg.org rate-limits/blocks datacenter
   * IPs (server-side re-ingestion hits ETIMEDOUT), so the mirror is a necessary
   * fallback. Each attempt has a hard timeout so a hanging host fails fast to the
   * next source instead of stalling the whole ingestion.
   */
  private async fetchRaw(gutenbergId: number): Promise<string> {
    const urls = this.buildUrls(gutenbergId);
    let lastError: unknown;
    for (const url of urls) {
      try {
        const res = await this.fetchWithTimeout(url, 25000);
        if (res.ok) return await res.text();
        lastError = new Error(`Gutenberg fetch failed for ID ${gutenbergId}: HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
        const code =
          (err as { cause?: { code?: string }; name?: string })?.cause?.code ||
          (err as Error)?.name ||
          'error';
        this.logger.warn(`Gutenberg source unavailable (${code}): ${url}`);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Gutenberg fetch failed for ID ${gutenbergId}`);
  }

  private async fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await globalThis.fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Candidate URLs in priority order: the primary cache/epub plain-text file,
   * then the pglaf mirror's UTF-8 (`-0.txt`) and ASCII (`.txt`) variants. The
   * mirror path follows Gutenberg's directory scheme: every digit of the id
   * except the last, slash-separated, then the id directory.
   */
  private buildUrls(gutenbergId: number): string[] {
    const id = String(gutenbergId);
    const dir = id.slice(0, -1).split('').join('/') || '0';
    return [
      `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
      `https://gutenberg.pglaf.org/${dir}/${gutenbergId}/${gutenbergId}-0.txt`,
      `https://gutenberg.pglaf.org/${dir}/${gutenbergId}/${gutenbergId}.txt`,
    ];
  }

  private stripHeaders(raw: string): string {
    const startRe = /\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\n/i;
    const endRe = /\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG/i;

    let text = raw;

    const startMatch = startRe.exec(raw);
    if (startMatch) {
      text = raw.slice(startMatch.index + startMatch[0].length);
    }

    const endMatch = endRe.exec(text);
    if (endMatch) {
      text = text.slice(0, endMatch.index);
    }

    return text.trim();
  }

  private trimNarrative(text: string, startPattern?: string, endPattern?: string): string {
    let result = text;
    if (startPattern) {
      const idx = result.indexOf(startPattern);
      if (idx >= 0) result = result.slice(idx);
    }
    if (endPattern) {
      const idx = result.indexOf(endPattern);
      if (idx >= 0) result = result.slice(0, idx + endPattern.length);
    }
    return result.trim();
  }
}
