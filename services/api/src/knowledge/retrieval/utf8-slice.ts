import { isUtf8 } from 'buffer';

/**
 * PO-045 (Option A) — byte-level code-point slicing for S2.
 *
 * Equivalent to `sliceCodePointRanges(decodeUtf8(bytes), ranges)` for every input that `decodeUtf8` accepts, without
 * materializing the whole book as a JavaScript string: only the requested passages are decoded.
 *
 * Equivalence notes (pinned by property tests against the string implementation):
 * - `decodeUtf8` uses `ignoreBOM: true`, so a leading U+FEFF is KEPT and counts as code point 0. Here every code point,
 *   including a BOM, is counted from its lead byte, and passages are decoded with the same `ignoreBOM: true` decoder.
 * - Valid UTF-8 has no lone surrogates, so one 4-byte sequence = one code point = one UTF-16 surrogate pair.
 * - Malformed offsets keep the existing rules: non-integer or negative offsets, `start >= end`, or offsets past the
 *   end of the text yield `null`; an offset equal to the text's code-point length is its end.
 *
 * PRECONDITION: `bytes` passed `isStrictUtf8`. The caller validates the WHOLE object first; an invalid object never
 * reaches this function, so no passage of it is ever trusted.
 */
export function sliceUtf8CodePointRanges(bytes: Uint8Array, ranges: readonly { start: number; end: number }[]): (string | null)[] {
  const wanted = [...new Set(ranges.flatMap((r) => [r.start, r.end]))].filter((x) => Number.isInteger(x) && x >= 0).sort((a, b) => a - b);
  const offset = new Map<number, number>();
  const n = bytes.length;
  const W = wanted.length;
  let cp = 0;
  let w = 0;
  for (let i = 0; i < n && w < W; i++) {
    if ((bytes[i] & 0xc0) !== 0x80) {
      // `i` is the lead byte of code point number `cp`.
      while (w < W && wanted[w] === cp) offset.set(wanted[w++], i);
      cp++;
    }
  }
  if (w < W) {
    // Only reached after a full scan: `cp` is now the total code-point count, i.e. the end of the text.
    while (w < W && wanted[w] === cp) offset.set(wanted[w++], n);
  }
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  return ranges.map((r) => {
    const s = offset.get(r.start);
    const e = offset.get(r.end);
    return s === undefined || e === undefined || r.start < 0 || r.start >= r.end ? null : decoder.decode(bytes.subarray(s, e));
  });
}

/** Whole-object strict UTF-8 validation with the same acceptance as `decodeUtf8` (fatal `TextDecoder`), without decoding. */
export function isStrictUtf8(bytes: Uint8Array): boolean {
  return isUtf8(bytes);
}
