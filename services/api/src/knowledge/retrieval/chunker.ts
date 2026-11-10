/**
 * NEM-023 §5.2 — pure, deterministic chunker over Unicode code points.
 *
 * Input: the UTF-8-decoded book text only (Amendment 1, B-2: no sync phrases, no chapter labels).
 * Output: chunk boundaries as code-point offsets. The chunk text itself is never returned or stored; it is always
 * `codePointSlice(text, charStart, charEnd)`.
 *
 * Rules: target size and overlap are configurable; a boundary prefers a paragraph break, then a sentence end, then any
 * whitespace inside the back half of the window; a word is never split (a word longer than the window extends the
 * chunk to its end); chunk edges never include leading or trailing whitespace; every chunk is non-empty.
 */
export interface ChunkBoundary {
  chunkIndex: number;
  charStart: number;
  charEnd: number;
}

export interface ChunkOptions {
  targetChars: number;
  overlapRatio: number;
}

const isSpace = (c: string | undefined) => c !== undefined && /\s/u.test(c);
const SENTENCE_END = new Set(['.', '!', '?', '…', ';', ':', '»', '"', '”', ')']);

/** Split into code points (astral characters count as one). */
export function toCodePoints(text: string): string[] {
  return Array.from(text);
}

export function codePointSlice(text: string | readonly string[], start: number, end: number): string {
  const cps = typeof text === 'string' ? toCodePoints(text) : text;
  return cps.slice(start, end).join('');
}

function validate(o: ChunkOptions) {
  if (!Number.isInteger(o.targetChars) || o.targetChars < 50) throw new Error('chunk targetChars must be an integer ≥ 50');
  if (!(o.overlapRatio >= 0 && o.overlapRatio < 0.5)) throw new Error('chunk overlapRatio must be in [0, 0.5)');
}

/** Best cut in (lo, hi]: paragraph break > sentence end > whitespace. Returns the exclusive end, or -1. */
function bestCut(cps: readonly string[], lo: number, hi: number): number {
  let sentence = -1;
  let space = -1;
  for (let i = hi; i > lo; i--) {
    // A cut at i means cps[i-1] is the last character kept and cps[i] is whitespace (or the end).
    if (!isSpace(cps[i])) continue;
    if (cps[i] === '\n' && cps[i + 1] === '\n') return i; // paragraph
    if (cps[i] === '\n' && /\r/.test(cps[i + 1] ?? '') && cps[i + 2] === '\n') return i;
    if (sentence < 0 && SENTENCE_END.has(cps[i - 1])) sentence = i;
    if (space < 0) space = i;
  }
  return sentence >= 0 ? sentence : space;
}

export function chunkText(text: string, options: ChunkOptions): ChunkBoundary[] {
  validate(options);
  const cps = toCodePoints(text);
  const n = cps.length;
  const target = options.targetChars;
  const overlap = Math.floor(target * options.overlapRatio);
  const out: ChunkBoundary[] = [];

  let start = 0;
  while (start < n && isSpace(cps[start])) start++;
  while (start < n) {
    let end: number;
    if (start + target >= n) {
      end = n;
    } else {
      end = bestCut(cps, start + Math.floor(target / 2), start + target);
      if (end < 0) {
        // No whitespace in the back half of the window: never split a word; extend to the end of the current word.
        end = start + target;
        while (end < n && !isSpace(cps[end])) end++;
      }
    }
    let e = end;
    while (e > start && isSpace(cps[e - 1])) e--;
    if (e > start) out.push({ chunkIndex: out.length, charStart: start, charEnd: e });
    if (end >= n) break;

    // Next chunk starts `overlap` code points before the cut, moved forward to the start of a word, and always
    // strictly after the current start (progress guaranteed).
    let next = Math.max(end - overlap, start + 1);
    if (next < end && !isSpace(cps[next - 1])) while (next < end && !isSpace(cps[next])) next++;
    while (next < n && isSpace(cps[next])) next++;
    if (next <= start) next = end;
    start = next;
  }
  return out;
}

/**
 * Slice several code-point ranges out of `text` in one pass, without materializing the code-point array (retrieval
 * latency: book texts reach millions of characters). Returns `null` for a range past the end of the text.
 */
export function sliceCodePointRanges(text: string, ranges: readonly { start: number; end: number }[]): (string | null)[] {
  const wanted = [...new Set(ranges.flatMap((r) => [r.start, r.end]))].filter((x) => Number.isInteger(x) && x >= 0).sort((a, b) => a - b);
  const utf16 = new Map<number, number>();
  let cp = 0;
  let w = 0;
  let i = 0;
  while (w < wanted.length) {
    while (w < wanted.length && wanted[w] === cp) utf16.set(wanted[w++], i);
    if (i >= text.length) break;
    const code = text.charCodeAt(i);
    i += code >= 0xd800 && code <= 0xdbff && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00 ? 2 : 1;
    cp++;
  }
  return ranges.map((r) => {
    const s = utf16.get(r.start);
    const e = utf16.get(r.end);
    return s === undefined || e === undefined || r.start < 0 || r.start >= r.end ? null : text.slice(s, e);
  });
}
