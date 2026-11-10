import { chunkText, codePointSlice, sliceCodePointRanges, toCodePoints } from '../../../../src/knowledge/retrieval/chunker';

const OPTS = { targetChars: 100, overlapRatio: 0.1 };
const words = (n: number, w = 'palabra') => Array.from({ length: n }, (_, i) => `${w}${i}`).join(' ');

function assertInvariants(text: string, opts = OPTS) {
  const cps = toCodePoints(text);
  const chunks = chunkText(text, opts);
  chunks.forEach((c, i) => {
    expect(c.chunkIndex).toBe(i);
    expect(c.charStart).toBeGreaterThanOrEqual(0);
    expect(c.charEnd).toBeLessThanOrEqual(cps.length);
    expect(c.charStart).toBeLessThan(c.charEnd);
    const s = codePointSlice(cps, c.charStart, c.charEnd);
    expect(s).toBe(s.trim()); // no edge whitespace
    // never splits a word: the characters outside each edge are whitespace or the text boundary
    expect(c.charStart === 0 || /\s/u.test(cps[c.charStart - 1])).toBe(true);
    expect(c.charEnd === cps.length || /\s/u.test(cps[c.charEnd])).toBe(true);
    if (i > 0) expect(c.charStart).toBeGreaterThan(chunks[i - 1].charStart); // progress
  });
  // coverage: every non-space code point is inside some chunk
  const covered = new Array(cps.length).fill(false);
  for (const c of chunks) for (let i = c.charStart; i < c.charEnd; i++) covered[i] = true;
  cps.forEach((ch, i) => { if (!/\s/u.test(ch)) expect(covered[i]).toBe(true); });
  return chunks;
}

describe('chunkText (NEM-023 §5.2)', () => {
  it('empty and whitespace-only text produce no chunks', () => {
    expect(chunkText('', OPTS)).toEqual([]);
    expect(chunkText(' \n\t ', OPTS)).toEqual([]);
  });

  it('short text is one trimmed chunk', () => {
    expect(chunkText('  Hola mundo.  ', OPTS)).toEqual([{ chunkIndex: 0, charStart: 2, charEnd: 13 }]);
  });

  it('long text: bounded chunks, overlap, word-safe edges, full coverage', () => {
    const chunks = assertInvariants(words(200));
    expect(chunks.length).toBeGreaterThan(10);
    for (const c of chunks) expect(c.charEnd - c.charStart).toBeLessThanOrEqual(100);
    // overlap: consecutive chunks share text
    expect(chunks.some((c, i) => i > 0 && c.charStart < chunks[i - 1].charEnd)).toBe(true);
  });

  it('prefers a paragraph break, then a sentence end, over a plain space', () => {
    const para = `${'a'.repeat(30)} ${'b'.repeat(25)}\n\n${'c'.repeat(10)} ${'d'.repeat(60)}`;
    expect(chunkText(para, OPTS)[0].charEnd).toBe(56);
    const sent = `${'a'.repeat(30)} ${'b'.repeat(25)}. ${'c'.repeat(10)} ${'d'.repeat(60)}`;
    expect(chunkText(sent, OPTS)[0].charEnd).toBe(57);
  });

  it('a word longer than the window is never split', () => {
    const long = 'x'.repeat(250);
    const chunks = assertInvariants(`intro ${long} outro`);
    expect(chunks.some((c) => c.charEnd - c.charStart >= 250)).toBe(true);
  });

  it('offsets are Unicode code points (astral characters, combining marks, CRLF)', () => {
    const text = `${'𝔘𝔫𝔦𝔠𝔬𝔡𝔢 '.repeat(20)}\r\n\r\n${'niño canción '.repeat(10)}é`;
    const chunks = assertInvariants(text);
    const cps = toCodePoints(text);
    expect(cps.length).toBeLessThan(text.length); // astral chars are 2 UTF-16 units but 1 code point
    expect(codePointSlice(text, chunks[0].charStart, chunks[0].charEnd).startsWith('𝔘𝔫𝔦𝔠𝔬𝔡𝔢')).toBe(true);
  });

  it('is deterministic and zero overlap is allowed', () => {
    const t = words(300, 'mot');
    expect(chunkText(t, OPTS)).toEqual(chunkText(t, OPTS));
    const z = assertInvariants(t, { targetChars: 100, overlapRatio: 0 });
    z.forEach((c, i) => { if (i > 0) expect(c.charStart).toBeGreaterThanOrEqual(z[i - 1].charEnd); });
  });

  it('rejects invalid options', () => {
    expect(() => chunkText('x', { targetChars: 10, overlapRatio: 0.1 })).toThrow(/targetChars/);
    expect(() => chunkText('x', { targetChars: 100.5, overlapRatio: 0.1 })).toThrow(/targetChars/);
    expect(() => chunkText('x', { targetChars: 100, overlapRatio: 0.5 })).toThrow(/overlapRatio/);
    expect(() => chunkText('x', { targetChars: 100, overlapRatio: -0.1 })).toThrow(/overlapRatio/);
  });
});

describe('sliceCodePointRanges', () => {
  const text = 'a𝔘bñc𝔫';
  it('matches codePointSlice for every range, in input order, in one pass', () => {
    const ranges = [{ start: 3, end: 6 }, { start: 0, end: 2 }, { start: 1, end: 4 }];
    expect(sliceCodePointRanges(text, ranges)).toEqual(ranges.map((r) => codePointSlice(text, r.start, r.end)));
  });
  it('returns null for out-of-range, empty, or negative ranges', () => {
    expect(sliceCodePointRanges(text, [{ start: 4, end: 7 }, { start: 2, end: 2 }, { start: -1, end: 2 }, { start: 0, end: 6 }]))
      .toEqual([null, null, null, text]);
    expect(sliceCodePointRanges('', [{ start: 0, end: 1 }])).toEqual([null]);
  });
  it('handles a lone surrogate as one code point', () => {
    expect(sliceCodePointRanges('a\ud800b', [{ start: 2, end: 3 }])).toEqual(['b']);
  });
});
