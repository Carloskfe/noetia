import { Injectable } from '@nestjs/common';
import { SyncPhrase, SyncSource } from './sync-map.entity';

const TIMING_RE = /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s+-->\s+(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/;

@Injectable()
export class SrtParserService {
  parse(raw: string): { phrases: SyncPhrase[]; source: Exclude<SyncSource, 'auto' | 'manual'> } {
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const isVtt = normalized.trimStart().startsWith('WEBVTT');
    const source = isVtt ? 'vtt' : 'srt';
    const separator = isVtt ? '.' : ',';

    const blocks = normalized.split(/\n{2,}/);
    const phrases: SyncPhrase[] = [];
    let index = 0;

    for (const block of blocks) {
      const lines = block.trim().split('\n').map((l) => l.trim());
      if (!lines.length) continue;

      // Skip VTT header, NOTE, STYLE, REGION blocks
      if (lines[0].startsWith('WEBVTT')) continue;
      if (lines[0].startsWith('NOTE') || lines[0].startsWith('STYLE') || lines[0].startsWith('REGION')) continue;

      // Find the timing line
      const timingIdx = lines.findIndex((l) => TIMING_RE.test(l));
      if (timingIdx === -1) continue;

      const match = TIMING_RE.exec(lines[timingIdx])!;
      const startTime = this.parseTimestamp(match[1], separator);
      const endTime = this.parseTimestamp(match[2], separator);

      // Text lines come after the timing line
      const textLines = lines.slice(timingIdx + 1);
      const text = this.normalizeCueText(textLines);
      if (!text) continue;

      phrases.push({ index: index++, text, startTime, endTime, type: 'text' });
    }

    return { phrases, source };
  }

  private parseTimestamp(ts: string, _separator: ',' | '.'): number {
    // Handle both separators regardless of format (defensive)
    const normalized = ts.replace(',', '.').replace('.', '.');
    // Split on last occurrence of the separator between seconds and milliseconds
    const dotIdx = normalized.lastIndexOf('.');
    const timePart = dotIdx !== -1 ? normalized.slice(0, dotIdx) : normalized;
    const msPart = dotIdx !== -1 ? normalized.slice(dotIdx + 1) : '0';

    const parts = timePart.split(':');
    const hh = Number(parts[0] ?? 0);
    const mm = Number(parts[1] ?? 0);
    const ss = Number(parts[2] ?? 0);
    const ms = Number(msPart.padEnd(3, '0').slice(0, 3));

    return hh * 3600 + mm * 60 + ss + ms / 1000;
  }

  private normalizeCueText(lines: string[]): string {
    return lines
      .join(' ')
      .replace(/<[^>]+>/g, '') // strip HTML tags (VTT voice spans, etc.)
      .replace(/\s+/g, ' ')
      .trim();
  }
}
