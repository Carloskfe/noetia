import { parseVtt, parseJson, parseWhisperFile } from '../../../src/ingestion/whisper-parser';

// ── VTT tests ─────────────────────────────────────────────────────────────────

describe('parseVtt', () => {
  const WORD_VTT = `WEBVTT

00:00:00.000 --> 00:00:03.500
<00:00:00.000><c> En</c><00:00:00.520><c> un</c><00:00:00.900><c> lugar</c>

00:00:03.500 --> 00:00:06.000
<00:00:03.500><c> de</c><00:00:04.000><c> la</c><00:00:04.600><c> Mancha</c>
`;

  it('parses word-level timestamps', () => {
    const words = parseVtt(WORD_VTT);
    expect(words).toHaveLength(6);
    expect(words[0]).toMatchObject({ word: 'En', start: 0 });
    expect(words[2]).toMatchObject({ word: 'lugar', start: 0.9 });
    expect(words[5]).toMatchObject({ word: 'Mancha', start: 4.6 });
  });

  it('strips leading spaces from words', () => {
    const words = parseVtt(WORD_VTT);
    for (const w of words) {
      expect(w.word).not.toMatch(/^\s/);
    }
  });

  it('fills end times from the next word start', () => {
    const words = parseVtt(WORD_VTT);
    expect(words[0].end).toBe(words[1].start);
    expect(words[1].end).toBe(words[2].start);
  });

  it('falls back to segment-level when no inline word timestamps', () => {
    const segVtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
En un lugar de la Mancha
`;
    const words = parseVtt(segVtt);
    // Segment-level cue is split into individual words with proportional timestamps
    expect(words).toHaveLength(6);
    expect(words[0]).toMatchObject({ word: 'En', start: 0 });
    expect(words[5]).toMatchObject({ word: 'Mancha', end: 5 });
    // Each word spans 5/6 seconds
    expect(words[0].end).toBeCloseTo(5 / 6, 5);
  });

  it('returns empty array for empty input', () => {
    expect(parseVtt('WEBVTT\n')).toHaveLength(0);
  });
});

// ── JSON tests ────────────────────────────────────────────────────────────────

describe('parseJson', () => {
  const WORD_JSON = JSON.stringify({
    text: 'En un lugar de la Mancha',
    segments: [
      {
        start: 0,
        end: 3.5,
        text: ' En un lugar',
        words: [
          { word: ' En', start: 0, end: 0.52 },
          { word: ' un', start: 0.52, end: 0.90 },
          { word: ' lugar', start: 0.90, end: 3.5 },
        ],
      },
      {
        start: 3.5,
        end: 6.0,
        text: ' de la Mancha',
        words: [
          { word: ' de', start: 3.5, end: 4.0 },
          { word: ' la', start: 4.0, end: 4.6 },
          { word: ' Mancha', start: 4.6, end: 6.0 },
        ],
      },
    ],
  });

  it('parses word-level timestamps from JSON', () => {
    const words = parseJson(WORD_JSON);
    expect(words).toHaveLength(6);
    expect(words[0]).toMatchObject({ word: 'En', start: 0, end: 0.52 });
    expect(words[5]).toMatchObject({ word: 'Mancha', start: 4.6, end: 6.0 });
  });

  it('strips leading spaces from words', () => {
    const words = parseJson(WORD_JSON);
    for (const w of words) expect(w.word).not.toMatch(/^\s/);
  });

  it('falls back to segment when no words array', () => {
    const segJson = JSON.stringify({
      segments: [{ start: 0, end: 5, text: ' En un lugar' }],
    });
    const words = parseJson(segJson);
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe('En un lugar');
  });
});

// ── Auto-detect tests ─────────────────────────────────────────────────────────

describe('parseWhisperFile', () => {
  it('uses JSON parser for .json filename', () => {
    const json = JSON.stringify({ segments: [{ start: 0, end: 1, text: 'hola', words: [{ word: 'hola', start: 0, end: 1 }] }] });
    const words = parseWhisperFile(json, 'audio.json');
    expect(words[0].word).toBe('hola');
  });

  it('uses VTT parser for .vtt filename', () => {
    const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhola\n';
    const words = parseWhisperFile(vtt, 'audio.vtt');
    expect(words[0].word).toBe('hola');
  });

  it('guesses JSON from content starting with {', () => {
    const json = JSON.stringify({ segments: [] });
    const words = parseWhisperFile(json, 'audio.txt');
    expect(words).toHaveLength(0);
  });
});
