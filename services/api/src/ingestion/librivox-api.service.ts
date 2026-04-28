import { Injectable } from '@nestjs/common';

@Injectable()
export class LibrivoxApiService {
  /**
   * Fetches the LibriVox book page and extracts the archive.org 64kb MP3 zip URL.
   * Using page scraping rather than the LibriVox API, which is rate-limited.
   */
  async getZipUrl(librivoxPageUrl: string): Promise<string> {
    const html = await this.fetchPage(librivoxPageUrl);
    const match = /href="(https:\/\/archive\.org\/compress\/[^"]+\.zip[^"]*)"/i.exec(html);
    if (!match) {
      throw new Error(`No archive.org zip URL found on LibriVox page: ${librivoxPageUrl}`);
    }
    return match[1].replace(/ /g, '%20');
  }

  /**
   * Fetches the LibriVox book page and extracts the first archive.org M4B streaming URL.
   * M4B files are browser-playable (MPEG-4 audio) and suitable for in-reader streaming.
   */
  async getM4bUrl(librivoxPageUrl: string): Promise<string> {
    const html = await this.fetchPage(librivoxPageUrl);
    const match = /href="(https:\/\/archive\.org\/download\/[^"]+\.m4b)"/i.exec(html);
    if (!match) {
      throw new Error(`No archive.org M4B URL found on LibriVox page: ${librivoxPageUrl}`);
    }
    return match[1];
  }

  private async fetchPage(url: string): Promise<string> {
    const res = await globalThis.fetch(url);
    if (!res.ok) {
      throw new Error(`LibriVox page fetch failed: HTTP ${res.status} — ${url}`);
    }
    return res.text();
  }
}
