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

  it('drops a Spanish closing-credit cue with no trailing period ("leído por … 2026")', () => {
    // El Príncipe: Whisper rendered the closing credit as one period-less cue.
    expect(stripAnnouncement(cue('de maquiavelo leído por ficción narrada en málaga a 4 de enero de 2026'))).toBeNull();
  });

  it('keeps narrative prose that merely contains "por" and a year', () => {
    expect(stripAnnouncement(cue('En el año 2026 el mundo había cambiado por completo.'))).not.toBeNull();
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

  it('drops a "Sección N de..." chapter-start announcement cue', () => {
    expect(stripAnnouncement(cue('Sección 1 de Fábulas y Verdades. Esta es una grabación de LibriVox.'))).toBeNull();
  });

  it('drops a "Fin de la sección N..." closing announcement, including trailing book/author credit', () => {
    expect(stripAnnouncement(cue('Fin de la sección 22. Fin de Pepita Jiménez. De Juan Valera.'))).toBeNull();
  });

  it('drops a LibriVox notice even when Whisper mis-hears it as "LIBRAVOX"', () => {
    expect(stripAnnouncement(cue('THIS IS A LIBRAVOX RECORDING'))).toBeNull();
    expect(stripAnnouncement(cue('FOR MORE INFORMATION OR TO VOLUNTEER PLEASE VISIT LIBRAVOX DOT ORG'))).toBeNull();
  });

  it('drops a standalone testament-division intro cue', () => {
    expect(stripAnnouncement(cue('The Old Testament.'))).toBeNull();
    expect(stripAnnouncement(cue('The New Testament.'))).toBeNull();
  });

  it('drops a Bible-book track outro ("End of Genesis 37-41", "End of Genesis chapters 28 through 31.")', () => {
    expect(stripAnnouncement(cue('End of Genesis 37-41'))).toBeNull();
    expect(stripAnnouncement(cue('End of Genesis chapters 28 through 31.'))).toBeNull();
    expect(stripAnnouncement(cue('End of the Book of Exodus.'))).toBeNull();
  });

  it('keeps verse text that merely contains "end of" mid-sentence (not a book-anchored outro)', () => {
    const v1 = cue('And when Jacob had made an end of commanding his sons.');
    expect(stripAnnouncement(v1)).toEqual(v1);
    const v2 = cue('And God said unto Noah, The end of all flesh is come before me.');
    expect(stripAnnouncement(v2)).toEqual(v2);
  });

  it('strips a trailing "Fin de la sección N" with no further text', () => {
    const result = stripAnnouncement(cue('sabré resistir y no pecar, Dios me protege. Fin de la sección 12'));
    expect(result).not.toBeNull();
    expect(result!.payload).toBe('sabré resistir y no pecar, Dios me protege.');
  });

  it('drops a standalone Amara.org subtitling-credit cue', () => {
    expect(stripAnnouncement(cue('Subtítulos realizados por la comunidad de Amara.org'))).toBeNull();
  });

  it('strips an embedded "Leído por [reader]." credit, keeping real text on both sides', () => {
    const result = stripAnnouncement(cue('público. Leído por Luje Calderón. Capítulo 1. 6 de junio. La anodriza de Pepita, hoy su ama de'));
    expect(result).not.toBeNull();
    expect(result!.payload).toBe('público. Capítulo 1. 6 de junio. La anodriza de Pepita, hoy su ama de');
  });

  it('drops a cue that starts with "Leído por" even with no period in this cue (split across Whisper segments)', () => {
    expect(stripAnnouncement(cue('Leído por Gabriela Cahuen en Kingston,'))).toBeNull();
  });

  it('drops a standalone "Grabado por [reader]." cue', () => {
    expect(stripAnnouncement(cue('Grabado por Claudia Barrett.'))).toBeNull();
  });

  it('strips an embedded "Grabado por [reader]." credit, keeping real text around it', () => {
    const result = stripAnnouncement(cue('sección de Platero y Yo, grabado por Claudia Barrett.'));
    expect(result).not.toBeNull();
    expect(result!.payload).toBe('sección de Platero y Yo,');
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
    // file2's announcement cue (its first cue) is stripped from the TEXT, leaving
    // only the real second cue. The chapter offset uses file1's RAW last end (7s)
    // — the announcement's audio still plays in the concatenated file, so the next
    // chapter's audio (and thus its cues) starts after it; using the cleaned end
    // (5s) would drift the text ahead of the audio. 3 (original start) + 7 + 2 = 12.
    expect(merged[1].startTime).toBeCloseTo(12);
    expect(merged[1].payload).toBe('De cuyo nombre no quiero acordarme.');
  });
});
