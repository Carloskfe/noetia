/**
 * Pure SA-001 C1 quotation-integrity rules (no Nest / TypeORM imports), so the
 * read-only legacy audit can run them anywhere. The Nest service wrapper is in
 * quote-integrity.service.ts.
 */
/**
 * SA-001 C1 quotation-integrity policy — Stage 0 guardrail (NEM-016).
 *
 * - The author's wording is preserved: words, their order, punctuation and
 *   capitalization must match the book. Only typographic equivalents are
 *   folded (quote/dash styles, "..." vs "…", spacing, soft hyphens).
 * - Continuous excerpts and shortening are allowed. At each passage edge the
 *   reader may drop or add wrapping quotation marks / truncation "…", add a
 *   closing ".", and change the case of the first letter.
 * - Internal omissions must be marked with the approved marker `[…]` (typed
 *   "[...]" is accepted and rendered as `[…]`). A bare "…" is NOT an omission
 *   marker — it is only valid where the author wrote it.
 * - Every retained passage must be traceable: verbatim, in source order, non
 *   overlapping, at least MIN_WORDS_PER_OMISSION_SEGMENT words when omissions
 *   are used, and the positions found are returned as provenance.
 * - Meaning safeguards that can be checked mechanically: an omission may not
 *   span more than MAX_OMISSION_GAP_CHARS of source text, and the omitted text
 *   may not contain a negation or exception word (OMISSION_BLOCKED_WORDS).
 *   Whether an omission distorts meaning in general cannot be decided here —
 *   see the source-range editor design (NEM-016 report §5.10).
 */
export const OMISSION_MARKER = '[…]';
export const MIN_WORDS_PER_OMISSION_SEGMENT = 3;
export const MAX_OMISSION_SEGMENTS = 6;
export const MAX_OMISSION_GAP_CHARS = 1500;
const MAX_CANDIDATES_PER_SEGMENT = 50;

/** Negations and exceptions (ES/EN) that an omission must not remove. */
export const OMISSION_BLOCKED_WORDS: ReadonlySet<string> = new Set([
  // English
  'not', 'no', 'never', 'nor', 'neither', 'without', 'except', 'unless', 'cannot',
  // Spanish
  'nunca', 'jamás', 'jamas', 'ni', 'tampoco', 'sin', 'excepto', 'salvo',
  'nadie', 'nada', 'ninguno', 'ninguna', 'ningún', 'ningun',
]);

const IS_WORD_CHAR = /[\p{L}\p{N}]/u;
const EDGE_STRIP_START = /^[\s"'…]+/u;
const EDGE_STRIP_END = /[\s"'…]+$|(?<=[\p{L}\p{N}])\.$/u;

/**
 * Folds only typographic variants; keeps words, punctuation and case.
 * Spaces next to punctuation are dropped so "end.Start" (a selection that lost a
 * space) and "end. Start" compare equal.
 */
export function normalizeTypography(s: string): string {
  return s
    .normalize('NFC')
    .replace(/­/g, '')
    .replace(/[“”„‟«»"]/g, '"')
    .replace(/[‘’‚‛`´']/g, "'")
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\.{3,}/g, '…')
    .replace(/\s+/g, ' ')
    .replace(/\s*([^\p{L}\p{N}\s])\s*/gu, '$1')
    .trim();
}

/**
 * Input vs display: readers may TYPE the ASCII form "[...]" (or "[ … ]",
 * "[....]"), but the approved public form is `[…]`. Every marker the validator
 * treats as an omission is rewritten here, and the sharing service applies this
 * before verification, de-duplication, rendering and storage — so a card, a
 * share snapshot and a share page only ever show `[…]`. The reader's stored
 * fragment is never rewritten.
 */
export function canonicalizeOmissionMarkers(quote: string): string {
  return quote.replace(/\[\s*(?:…|\.{3,})\s*\]/g, OMISSION_MARKER);
}

export interface QuoteSpan {
  start: number;
  end: number;
}

export type QuoteFailure =
  | 'empty'
  | 'not_in_source'
  | 'omission_marker_required'
  | 'segment_too_short'
  | 'too_many_segments'
  | 'omission_too_long'
  | 'omission_may_distort';

export type QuoteCheck = { ok: true; spans: QuoteSpan[] } | { ok: false; reason: QuoteFailure };

function stripEdges(seg: string): string {
  let prev: string;
  do {
    prev = seg;
    seg = seg.replace(EDGE_STRIP_START, '').replace(EDGE_STRIP_END, '');
  } while (seg !== prev);
  return seg;
}

function toggleFirst(seg: string): string {
  const c = seg.charAt(0);
  const t = c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase();
  return t + seg.slice(1);
}

/** Word-boundary-aligned occurrences of `seg` (or its first-letter-case variant) at or after `from`. */
function occurrences(source: string, seg: string, from: number): number[] {
  const out = new Set<number>();
  for (const variant of new Set([seg, toggleFirst(seg)])) {
    let at = source.indexOf(variant, from);
    while (at >= 0 && out.size < MAX_CANDIDATES_PER_SEGMENT) {
      const before = at > 0 ? source.charAt(at - 1) : '';
      const after = source.charAt(at + variant.length);
      const startsWord = IS_WORD_CHAR.test(variant.charAt(0));
      const endsWord = IS_WORD_CHAR.test(variant.charAt(variant.length - 1));
      if ((!startsWord || !IS_WORD_CHAR.test(before)) && (!endsWord || !IS_WORD_CHAR.test(after))) out.add(at);
      at = source.indexOf(variant, at + 1);
    }
  }
  return [...out].sort((a, b) => a - b);
}

function gapProblem(gap: string): QuoteFailure | null {
  if (gap.length > MAX_OMISSION_GAP_CHARS) return 'omission_too_long';
  const words = gap.toLocaleLowerCase().split(/[^\p{L}\p{N}']+/u);
  if (words.some((w) => OMISSION_BLOCKED_WORDS.has(w) || /n't$/.test(w))) return 'omission_may_distort';
  return null;
}

function matchSegments(source: string, segments: string[]): QuoteCheck {
  let worst: QuoteFailure = 'not_in_source';
  const spans: QuoteSpan[] = [];
  const search = (i: number, from: number): boolean => {
    if (i === segments.length) return true;
    for (const at of occurrences(source, segments[i], from)) {
      const span = { start: at, end: at + segments[i].length };
      if (i > 0) {
        const problem = gapProblem(source.slice(spans[i - 1].end, span.start));
        if (problem) {
          worst = problem;
          continue;
        }
      }
      spans[i] = span;
      if (search(i + 1, span.end)) return true;
    }
    return false;
  };
  return search(0, 0) ? { ok: true, spans: spans.slice() } : { ok: false, reason: worst };
}

/**
 * Pure check of `quote` against the typography-normalized book source.
 * Returns the matched source spans (provenance) or the reason it fails.
 */
export function checkQuoteAgainstSource(quote: string, normalizedSource: string): QuoteCheck {
  const result = checkMarkedQuote(quote, normalizedSource);
  if (result.ok) return result;
  const bare = /(?<!\[\s*)(?:…|\.{3})(?!\s*\])/;
  if (!bare.test(quote)) return result;
  // A bare "…" used as an omission (e.g. fragments combined before NEM-016):
  // tell the reader to use the approved [ … ] marker rather than "not in source".
  const asMarked = quote.replace(/\s*(?<!\[\s*)(?:…|\.{3})(?!\s*\])\s*/g, ` ${OMISSION_MARKER} `);
  return checkMarkedQuote(asMarked, normalizedSource).ok ? { ok: false, reason: 'omission_marker_required' } : result;
}

function checkMarkedQuote(quote: string, normalizedSource: string): QuoteCheck {
  const normalized = normalizeTypography(canonicalizeOmissionMarkers(quote));
  const segments = normalized.split(OMISSION_MARKER).map(stripEdges).filter((s) => /[\p{L}\p{N}]/u.test(s));
  if (segments.length === 0) return { ok: false, reason: 'empty' };
  if (segments.length > MAX_OMISSION_SEGMENTS) return { ok: false, reason: 'too_many_segments' };
  if (
    segments.length > 1 &&
    segments.some((s) => s.split(/[^\p{L}\p{N}']+/u).filter(Boolean).length < MIN_WORDS_PER_OMISSION_SEGMENT)
  ) {
    return { ok: false, reason: 'segment_too_short' };
  }
  return matchSegments(normalizedSource, segments);
}

/** Stored with each new share so the quote stays traceable to its source. */
export interface QuoteProvenance {
  v: 1;
  source: 'sync_map' | 'text_file';
  /** sha256 of the normalized source the spans index into. */
  sourceSha256: string;
  spans: QuoteSpan[];
  checkedAt: string;
}

