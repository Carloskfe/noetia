import { sliceCodePointRanges } from '../../../../src/knowledge/retrieval/chunker';
import { decodeUtf8 } from '../../../../src/knowledge/retrieval/retrieval.types';
import { isStrictUtf8, sliceUtf8CodePointRanges } from '../../../../src/knowledge/retrieval/utf8-slice';

/**
 * PO-045 §3.4 — the byte-level slicer must equal the accepted reference, `sliceCodePointRanges(decodeUtf8(bytes))`,
 * for every passage boundary, and `isStrictUtf8` must accept exactly what `decodeUtf8` accepts.
 */
type R = { start: number; end: number };
const ref = (bytes: Uint8Array, ranges: R[]) => sliceCodePointRanges(decodeUtf8(bytes), ranges);
const same = (bytes: Uint8Array, ranges: R[]) => expect(sliceUtf8CodePointRanges(bytes, ranges)).toEqual(ref(bytes, ranges));
const decodes = (b: Uint8Array) => { try { decodeUtf8(b); return true; } catch { return false; } };
const cpLen = (s: string) => [...s].length;

/** Deterministic PRNG (mulberry32) so failures are reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ALPHABET = ['a', 'b', ' ', 'E', 'é', 'ñ', 'Ñ', 'ü', '¿', '¡', '—', '€', '中', '́', '̈', '😀', '𝔘', '👍🏽', '\r\n', '\n', '\r', ' ', ' ', '﻿', '\t', '\u0000', '�', '￿', '\u{10FFFF}'];
function randomText(r: () => number, n: number) {
  let s = r() < 0.2 ? '﻿' : '';
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(r() * ALPHABET.length)];
  return s;
}
function randomRanges(r: () => number, len: number, k: number): R[] {
  const pick = () => {
    const x = r();
    if (x < 0.05) return -1 - Math.floor(r() * 3);
    if (x < 0.08) return len + 1 + Math.floor(r() * 3);
    if (x < 0.10) return len;
    if (x < 0.12) return 0.5 + Math.floor(r() * len);
    if (x < 0.13) return Number.NaN;
    return Math.floor(r() * (len + 1));
  };
  return Array.from({ length: k }, () => ({ start: pick(), end: pick() }));
}

describe('sliceUtf8CodePointRanges ≡ sliceCodePointRanges(decodeUtf8(·)) (PO-045 §3.4)', () => {
  const T = 'Érase una vez un niño que cantaba. 𝔘na canción antigua sonaba en la plaza.';

  it('ASCII and Spanish text with accents', () => {
    same(Buffer.from('The children ran to the café.'), [{ start: 4, end: 12 }, { start: 24, end: 28 }, { start: 0, end: 29 }]);
    same(Buffer.from(T), [{ start: 0, end: 5 }, { start: 35, end: 54 }, { start: 17, end: 21 }]);
    expect(sliceUtf8CodePointRanges(Buffer.from(T), [{ start: 35, end: 54 }])).toEqual(['𝔘na canción antigua']);
  });

  it('astral characters, emoji with modifiers, and combining marks count by code point', () => {
    const s = 'a😀b👍🏽c𝔘d éf ñ';
    const n = cpLen(s);
    const ranges = [];
    for (let i = 0; i <= n; i++) for (let j = i; j <= n + 1; j++) ranges.push({ start: i, end: j });
    same(Buffer.from(s), ranges);
  });

  it('BOM: decodeUtf8 keeps a leading U+FEFF (ignoreBOM: true), so it is code point 0 and is kept in passages', () => {
    const b = Buffer.from('﻿Hola﻿mundo');
    expect(sliceUtf8CodePointRanges(b, [{ start: 0, end: 1 }, { start: 0, end: 5 }, { start: 1, end: 5 }, { start: 5, end: 6 }, { start: 6, end: 11 }]))
      .toEqual(['﻿', '﻿Hola', 'Hola', '﻿', 'mundo']);
    same(b, [{ start: 0, end: 1 }, { start: 0, end: 5 }, { start: 1, end: 5 }, { start: 5, end: 6 }, { start: 6, end: 11 }, { start: 0, end: 11 }]);
    same(Buffer.from('﻿﻿x'), [{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 1, end: 3 }]);
  });

  it('CRLF, CR, LF, U+2028/U+2029 are ordinary code points', () => {
    same(Buffer.from('uno\r\ndos\rtres\ncuatro cinco seis'), [{ start: 3, end: 5 }, { start: 3, end: 4 }, { start: 4, end: 8 }, { start: 8, end: 9 }, { start: 22, end: 23 }]);
  });

  it('empty, duplicate, overlapping and unordered ranges', () => {
    const b = Buffer.from(T);
    same(b, []);
    expect(sliceUtf8CodePointRanges(b, [])).toEqual([]);
    same(b, [{ start: 5, end: 9 }, { start: 5, end: 9 }, { start: 0, end: 7 }, { start: 3, end: 30 }, { start: 40, end: 50 }, { start: 1, end: 2 }]);
  });

  it('zero-length, negative, inverted, non-integer, NaN and out-of-range offsets → null, as before', () => {
    const b = Buffer.from(T);
    const n = cpLen(T);
    const ranges = [
      { start: 4, end: 4 }, { start: -1, end: 3 }, { start: 5, end: 2 }, { start: 1.5, end: 4 }, { start: 0, end: 2.5 },
      { start: Number.NaN, end: 3 }, { start: 0, end: n + 1 }, { start: n, end: n + 1 }, { start: n + 2, end: n + 9 }, { start: 0, end: n }, { start: n - 1, end: n },
      { start: -0, end: 2 }, { start: Number.POSITIVE_INFINITY, end: 3 },
    ];
    same(b, ranges);
    const out = sliceUtf8CodePointRanges(b, ranges);
    expect(out.slice(0, 9)).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(out[9]).toBe(T);
  });

  it('empty object', () => {
    same(new Uint8Array(0), [{ start: 0, end: 0 }, { start: 0, end: 1 }]);
  });

  it('randomized property: 2,000 deterministic texts × random ranges match the reference exactly', () => {
    const r = rng(0x5eed045);
    for (let t = 0; t < 2000; t++) {
      const s = randomText(r, Math.floor(r() * 80));
      const b = Buffer.from(s);
      const ranges = randomRanges(r, cpLen(s), 1 + Math.floor(r() * 12));
      const got = sliceUtf8CodePointRanges(b, ranges);
      const want = ref(b, ranges);
      if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`mismatch at case ${t}`); // fast path; details below
      expect(got).toEqual(want);
    }
  });

  it('multi-megabyte book (≈2.1 MB, mixed scripts): sampled passages identical, without decoding the whole object', () => {
    const r = rng(42);
    const parts: string[] = ['﻿'];
    let len = 1;
    while (len < 1_100_000) { const p = randomText(r, 64) + ' Érase una vez — canción 𝔘na 😀.\r\n'; parts.push(p); len += cpLen(p); }
    const s = parts.join('');
    const b = Buffer.from(s);
    expect(b.byteLength).toBeGreaterThan(2_000_000);
    const n = cpLen(s);
    const ranges: R[] = [{ start: 0, end: 1500 }, { start: n - 1500, end: n }, { start: n - 1, end: n + 1 }];
    for (let i = 0; i < 40; i++) { const a = Math.floor(r() * (n - 1600)); ranges.push({ start: a, end: a + 1 + Math.floor(r() * 1500) }); }
    same(b, ranges);
  });
});

describe('isStrictUtf8 accepts exactly what decodeUtf8 accepts (whole-object validation)', () => {
  it('valid text, BOM, astral, noncharacters', () => {
    for (const s of ['', 'abc', 'ñandú', '﻿x', '😀𝔘', '￾￿', '\u{10FFFF}']) {
      expect(isStrictUtf8(Buffer.from(s))).toBe(true);
      expect(decodes(Buffer.from(s))).toBe(true);
    }
  });

  it('invalid and truncated sequences are rejected by both', () => {
    const bad = [
      [0xff], [0x80], [0xc0, 0x80], [0xc1, 0xbf], [0xe0, 0x80, 0x80], [0xed, 0xa0, 0x80], [0xed, 0xbf, 0xbf], [0xf4, 0x90, 0x80, 0x80], [0xf5, 0x80, 0x80, 0x80],
      [0xc3], [0xe2, 0x82], [0xf0, 0x9f, 0x98], [0x61, 0xc3], [0x61, 0xf0, 0x9f, 0x98, 0x61], [0xfe, 0xff],
    ];
    for (const b of bad.map((x) => Uint8Array.from(x))) {
      expect({ b: [...b], strict: isStrictUtf8(b) }).toEqual({ b: [...b], strict: false });
      expect(decodes(b)).toBe(false);
    }
  });

  it('randomized property: random bytes and mutated valid text agree with decodeUtf8 (3,000 cases)', () => {
    const r = rng(7);
    for (let t = 0; t < 3000; t++) {
      let b: Uint8Array;
      if (t % 2 === 0) b = Uint8Array.from({ length: Math.floor(r() * 12) }, () => Math.floor(r() * 256));
      else {
        b = Uint8Array.from(Buffer.from(randomText(r, 1 + Math.floor(r() * 20))));
        const k = 1 + Math.floor(r() * 2);
        for (let i = 0; i < k && b.length; i++) b[Math.floor(r() * b.length)] = Math.floor(r() * 256);
        if (r() < 0.3) b = b.subarray(0, Math.floor(r() * b.length));
      }
      if (isStrictUtf8(b) !== decodes(b)) throw new Error(`disagreement at case ${t}: ${[...b].join(',')}`);
    }
  });
});
