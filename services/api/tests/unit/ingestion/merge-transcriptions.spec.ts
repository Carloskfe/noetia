import {
  parseTimestamp, formatTimestamp,
  parseVttCues, lastEndTime, renderVtt,
  extractSequenceNumber, mergeVttDirectory,
  stripAnnouncement,
} from '../../../src/ingestion/merge-transcriptions';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Timestamp helpers ──────────────────────────────────────────────────────────

describe('parseTimestamp', () => {
  it('parses HH:MM:SS.mmm', () => {
    expect(parseTimestamp('00:01:30.500')).toBeCloseTo(90.5);
  });
  it('parses MM:SS.mmm', () => {
    expect(parseTimestamp('01:30.500')).toBeCloseTo(90.5);
  });
  it('parses zero', () => {
    expect(parseTimestamp('00:00:00.000')).toBe(0);
  });
});

describe('formatTimestamp', () => {
  it('formats seconds to HH:MM:SS.mmm', () => {
    expect(formatTimestamp(90.5)).toBe('00:01:30.500');
  });
  it('formats zero', () => {
    expect(formatTimestamp(0)).toBe('00:00:00.000');
  });
  it('round-trips with parseTimestamp', () => {
    const secs = 3723.456;
    expect(parseTimestamp(formatTimestamp(secs))).toBeCloseTo(secs, 2);
  });
});

// ── VTT parser ─────────────────────────────────────────────────────────────────

const SAMPLE_VTT = `WEBVTT

00:00:01.000 --> 00:00:03.500
<00:00:01.000><c>En</c><00:00:01.500><c>un</c>

00:00:03.500 --> 00:00:06.000
<00:00:03.500><c>lugar</c><00:00:04.000><c>de</c>
`;

describe('parseVttCues', () => {
  it('parses cue count', () => {
    const cues = parseVttCues(SAMPLE_VTT);
    expect(cues).toHaveLength(2);
  });
  it('parses start and end times', () => {
    const cues = parseVttCues(SAMPLE_VTT);
    expect(cues[0].startTime).toBeCloseTo(1);
    expect(cues[0].endTime).toBeCloseTo(3.5);
    expect(cues[1].startTime).toBeCloseTo(3.5);
    expect(cues[1].endTime).toBeCloseTo(6);
  });
  it('returns empty array for empty input', () => {
    expect(parseVttCues('WEBVTT\n')).toHaveLength(0);
  });
});

describe('lastEndTime', () => {
  it('returns the largest end time', () => {
    const cues = parseVttCues(SAMPLE_VTT);
    expect(lastEndTime(cues)).toBeCloseTo(6);
  });
  it('returns 0 for empty array', () => {
    expect(lastEndTime([])).toBe(0);
  });
});

// ── renderVtt ──────────────────────────────────────────────────────────────────

describe('renderVtt', () => {
  it('starts with WEBVTT header', () => {
    const cues = parseVttCues(SAMPLE_VTT);
    expect(renderVtt(cues)).toMatch(/^WEBVTT/);
  });
  it('round-trips cue count', () => {
    const cues = parseVttCues(SAMPLE_VTT);
    const reparsed = parseVttCues(renderVtt(cues));
    expect(reparsed).toHaveLength(cues.length);
  });
});

// ── stripAnnouncement ────────────────────────────────────────────────────────────

function cue(payload: string): { startTime: number; endTime: number; payload: string } {
  return { startTime: 0, endTime: 1, payload };
}

describe('stripAnnouncement', () => {
  it('drops a standalone "Fin del canto..." cue', () => {
    expect(stripAnnouncement(cue('Fin del canto primero del infierno.'))).toBeNull();
  });

  it('drops a standalone "Canto segundo del..." announcement cue', () => {
    expect(stripAnnouncement(cue('Canto segundo del infierno de Dante.'))).toBeNull();
  });

  it('drops a standalone "Fin de la primera parte..." cue', () => {
    expect(stripAnnouncement(cue('Fin de la primera parte del ingenioso Hidalgo Don Quijote de la Mancha.'))).toBeNull();
  });

  it('drops an English "Chapter N of..." announcement cue', () => {
    expect(stripAnnouncement(cue('Chapter 1 of Meditations of Marcus Aurelius by Marcus'))).toBeNull();
  });

  it('drops any cue mentioning LibriVox', () => {
    expect(stripAnnouncement(cue('Esta es una grabación de LibriVox. Todas las grabaciones de LibriVox son de dominio público.'))).toBeNull();
  });

  it('drops a translator-credit cue (Spanish)', () => {
    expect(stripAnnouncement(cue('Orgullo y Prejuicio, primer volumen, de Jane Austen. Traducido por José Jordán de Urríez y Azara.'))).toBeNull();
  });

  it('drops a translator-credit cue (English)', () => {
    expect(stripAnnouncement(cue('Don Quijote, translated by John Ormsby.'))).toBeNull();
  });

  it('strips a trailing announcement appended without a cue break, keeping the real text', () => {
    const result = stripAnnouncement(cue('visiteo y el adquirir noticias fin del capítulo primero'));
    expect(result).not.toBeNull();
    expect(result!.payload).toBe('visiteo y el adquirir noticias');
  });

  it('strips a multi-word trailing announcement (e.g. "Fin del canto décimo séptimo del purgatorio")', () => {
    const result = stripAnnouncement(cue('al pie de una torre. Fin del canto séptimo del infierno.'));
    expect(result).not.toBeNull();
    expect(result!.payload).toBe('al pie de una torre.');
  });

  it('strips a trailing announcement with no terminating period', () => {
    const result = stripAnnouncement(cue('de vuestro monte que de sí la rechaza». Fin del Canto XXIII del Purgatorio'));
    expect(result).not.toBeNull();
    expect(result!.payload).toBe('de vuestro monte que de sí la rechaza».');
  });

  it('leaves ordinary narrative text untouched', () => {
    const result = stripAnnouncement(cue('En un lugar de la Mancha, de cuyo nombre no quiero acordarme.'));
    expect(result!.payload).toBe('En un lugar de la Mancha, de cuyo nombre no quiero acordarme.');
  });

  it('leaves a cue unchanged (same object identity check not required) when no match', () => {
    const c = cue('Pero los lirios que venían conmigo olían más en la frescura tibia.');
    const result = stripAnnouncement(c);
    expect(result).toEqual(c);
  });
});

// ── extractSequenceNumber ──────────────────────────────────────────────────────

describe('extractSequenceNumber', () => {
  it('extracts leading number', () => {
    expect(extractSequenceNumber('01_prologo.vtt')).toBe(1);
    expect(extractSequenceNumber('002_tratado.vtt')).toBe(2);
  });
  it('extracts number from middle of name', () => {
    expect(extractSequenceNumber('track_003_chapter.vtt')).toBe(3);
  });
  it('returns 0 when no number found', () => {
    expect(extractSequenceNumber('no-numbers.vtt')).toBe(0);
  });
});

// ── mergeVttDirectory ──────────────────────────────────────────────────────────

describe('mergeVttDirectory', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noetia-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeVtt(filename: string, content: string) {
    fs.writeFileSync(path.join(tmpDir, filename), content, 'utf-8');
  }

  it('merges two files with correct timestamp offset', () => {
    writeVtt('01_part.vtt', `WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nhello\n`);
    writeVtt('02_part.vtt', `WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nworld\n`);

    const merged = mergeVttDirectory(tmpDir, 2);

    expect(merged).toHaveLength(2);
    expect(merged[0].startTime).toBeCloseTo(1);
    expect(merged[0].endTime).toBeCloseTo(5);
    // second file offset = 5 (last end of file 1) + 2 (gap) = 7
    expect(merged[1].startTime).toBeCloseTo(7);
    expect(merged[1].endTime).toBeCloseTo(10);
  });

  it('respects the gap parameter', () => {
    writeVtt('01.vtt', `WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nfoo\n`);
    writeVtt('02.vtt', `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nbar\n`);

    const merged = mergeVttDirectory(tmpDir, 5);
    expect(merged[1].startTime).toBeCloseTo(15); // 10 + 5 gap
  });

  it('sorts files by sequence number, not alphabetically', () => {
    // "10" alphabetically before "9" — must sort numerically
    writeVtt('part09.vtt', `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nnine\n`);
    writeVtt('part10.vtt', `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nten\n`);

    const merged = mergeVttDirectory(tmpDir, 0);
    expect(merged[0].payload).toBe('nine');
    expect(merged[1].payload).toBe('ten');
  });

  it('shifts inline word timestamps inside the payload', () => {
    writeVtt('01.vtt', `WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nfoo\n`);
    writeVtt('02.vtt', `WEBVTT\n\n00:00:00.500 --> 00:00:02.000\n<00:00:00.500><c>word</c>\n`);

    const merged = mergeVttDirectory(tmpDir, 2);
    // offset = 10 + 2 = 12; inline ts 0.5 + 12 = 12.5
    expect(merged[1].payload).toContain('00:00:12.500');
  });

  it('throws when directory contains no VTT files', () => {
    expect(() => mergeVttDirectory(tmpDir)).toThrow(/No .vtt files/);
  });

  it('strips chapter-boundary announcements and computes offset from the cleaned last cue', () => {
    writeVtt('01.vtt', [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:05.000',
      'En un lugar de la Mancha.',
      '',
      '00:00:05.000 --> 00:00:07.000',
      'Fin del capítulo primero.',
      '',
    ].join('\n'));
    writeVtt('02.vtt', [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:03.000',
      'Capítulo 2 de Don Quijote de Cervantes.',
      '',
      '00:00:03.000 --> 00:00:06.000',
      'De cuyo nombre no quiero acordarme.',
      '',
    ].join('\n'));

    const merged = mergeVttDirectory(tmpDir, 2);

    expect(merged).toHaveLength(2);
    expect(merged[0].payload).toBe('En un lugar de la Mancha.');
    // file2's announcement cue (its first cue) is stripped, leaving only the
    // real second cue; offset is based on file1's cleaned last end (5s), not
    // the stripped announcement's end time (7s): 3 (original start) + 5 + 2 = 10
    expect(merged[1].startTime).toBeCloseTo(10);
    expect(merged[1].payload).toBe('De cuyo nombre no quiero acordarme.');
  });
});
