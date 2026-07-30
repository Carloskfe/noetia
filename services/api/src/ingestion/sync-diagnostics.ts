/**
 * Sync diagnostics — measures WHY a book's Escucha Activa highlight drifts from
 * the audio, independently of the aligner that produced the sync map.
 *
 * The reported symptom (2026-07-30, Carlos): in some books the audio is a
 * constant ~5 phrases behind the highlighted phrase, in others ~8; the gap does
 * NOT grow over the book. A constant, non-growing gap means the stored phrase
 * `startTime`s are systematically too EARLY by a fixed amount — not a drift bug.
 * The two classic sources of a fixed early shift are:
 *
 *   1. Leading audio content the text does not contain (LibriVox announcement,
 *      a spoken "Capítulo 1" heading) — extra words at the head of the whisper
 *      stream that the proportion estimate never fully backs out.
 *   2. An edition/translation mismatch between the stored text and the recording,
 *      which lowers per-phrase match confidence and lets the search latch onto
 *      an earlier partial match.
 *
 * This module does NOT trust the aligner's output. For a sample of anchor
 * phrases spread across the book it re-locates each phrase's TRUE spoken onset
 * by a global best-subsequence scan of the whisper words, then compares that
 * against the `startTime` the sync map actually stored. The result quantifies:
 *
 *   - editionCoverage   — how much of the text is even present in the audio
 *   - leadingExtraWords — announcement/front-matter words before phrase 0's onset
 *   - medianDeltaSeconds / medianDeltaPhrases — the size of the constant shift
 *   - driftSlope        — seconds of shift gained per phrase (≈0 ⇒ constant bug)
 *
 * A positive delta means the stored start is earlier than the true onset, i.e.
 * the highlight runs AHEAD of the audio — exactly the reported symptom.
 */

import { SyncPhrase } from '../books/sync-map.entity';
import { TimedWord } from './whisper-parser';
import { normalizeWord } from './phrase-aligner';

// Kept in step with phrase-aligner.tokenize: pure-digit tokens (verse numbers,
// marginal cross-references) are never read aloud, so they only ever miss.
function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeWord)
    .filter((t) => t && !/^\d+$/.test(t));
}

// ANCHORED subsequence score: the phrase's first token is required to sit at
// `offset` (the caller only calls this at real first-token occurrences), then
// the remaining tokens are matched in order within a forward window. Anchoring
// on the first word is what pins the TRUE onset — an unanchored subsequence scan
// would reproduce the aligner's own earliest-window bias (any offset a few words
// early still contains the whole phrase as a subsequence) and could not serve as
// independent ground truth.
function anchoredScore(phraseTokens: string[], words: string[], offset: number): number {
  const n = phraseTokens.length;
  if (n === 0 || words[offset] !== phraseTokens[0]) return 0;

  const windowSize = Math.min(Math.ceil(n * 1.5) + 5, words.length - offset);
  const searchLimit = offset + windowSize;
  let matches = 1;          // first token matched by construction
  let searchFrom = offset + 1;
  for (let t = 1; t < n; t++) {
    const token = phraseTokens[t];
    for (let i = searchFrom; i < searchLimit; i++) {
      if (words[i] === token) {
        matches++;
        searchFrom = i + 1;
        break;
      }
    }
  }
  return matches / n;
}

// Locate a phrase's true onset within a positional band around `center`.
//
// A whole-book scan is not distinctive enough on real text — a 4-word phrase's
// first token ("y", "de") recurs thousands of times, so a spurious full match
// wins. We instead search only a band around the phrase's position-independent
// proportional estimate, and accept the result only if the best anchored match
// is clearly better than the runner-up in that band (distinctiveness guard).
// This keeps the reference independent of the STORED times — it never looks at
// startTime — while being robust enough to trust on a 50k-word book.
function locateOnsetInBand(
  phraseTokens: string[],
  words: string[],
  center: number,
  band: number,
  minConfidence: number,
): { pos: number; score: number } | null {
  const first = phraseTokens[0];
  const lo = Math.max(0, center - band);
  const hi = Math.min(words.length - 1, center + band);
  let best = { pos: -1, score: 0 };
  let second = 0;
  for (let i = lo; i <= hi; i++) {
    if (words[i] !== first) continue;
    const score = anchoredScore(phraseTokens, words, i);
    if (score > best.score) {
      second = best.score;
      best = { pos: i, score };
    } else if (score > second) {
      second = score;
    }
  }
  if (best.pos < 0 || best.score < minConfidence) return null;
  if (best.score - second < 0.15) return null; // ambiguous within the band
  return best;
}

export interface PhraseOffset {
  index: number;
  storedStart: number;       // startTime the sync map assigned this phrase
  trueStart: number | null;  // independently located onset (null if not found)
  trueWordIndex: number | null;
  deltaSeconds: number | null; // trueStart − storedStart (+ ⇒ highlight ahead)
  confidence: number;          // best global match score for the true onset
}

export interface SyncDiagnostics {
  book?: string;
  textPhrases: number;
  timedWords: number;
  /** Fraction of unique text tokens that appear anywhere in the whisper stream.
   *  Low (< ~0.6) ⇒ different edition/translation — fix the text before syncing. */
  editionCoverage: number;
  /** Whisper words before the first text phrase's true onset (announcement /
   *  spoken heading / front matter). The prime suspect for a constant offset. */
  leadingExtraWords: number;
  leadingExtraSeconds: number;
  measured: number;            // anchors we could confidently locate
  medianDeltaSeconds: number;  // + ⇒ stored start too early ⇒ highlight ahead of audio
  medianDeltaPhrases: number;  // the "N phrases behind" figure the reader perceives
  /** Seconds of delta gained per phrase across the book. ≈0 ⇒ constant offset
   *  (leading-shift / edition), non-trivial ⇒ genuine accumulating drift. */
  driftSlope: number;
  constantOffset: boolean;
  samples: PhraseOffset[];     // per-anchor detail, ascending by phrase index
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Least-squares slope of y over x (delta seconds vs phrase index).
function slope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export interface DiagnoseOptions {
  /** Number of anchor phrases to independently locate (spread across the book). */
  anchors?: number;
  /** Minimum global match score for an anchor's true onset to count. */
  minConfidence?: number;
  /** |driftSlope| below this (s/phrase) is treated as a constant offset. */
  constantSlopeThreshold?: number;
  book?: string;
}

/**
 * @param alignedPhrases the phrases AS STORED in the sync map (with startTime)
 * @param timedWords     the whisper words the audio was aligned against
 */
export function diagnoseSync(
  alignedPhrases: SyncPhrase[],
  timedWords: TimedWord[],
  opts: DiagnoseOptions = {},
): SyncDiagnostics {
  const anchors = opts.anchors ?? 200;
  const minConfidence = opts.minConfidence ?? 0.5;
  const constantSlopeThreshold = opts.constantSlopeThreshold ?? 0.02;

  const words = timedWords.map((w) => normalizeWord(w.word));
  const textPhrases = alignedPhrases.filter((p) => (p.type ?? 'text') === 'text');

  // ── Edition coverage: unique text tokens present anywhere in the audio ──────
  const audioVocab = new Set(words.filter(Boolean));
  const textVocab = new Set<string>();
  for (const p of textPhrases) for (const t of tokenize(p.text)) textVocab.add(t);
  let present = 0;
  for (const t of textVocab) if (audioVocab.has(t)) present++;
  const editionCoverage = textVocab.size ? present / textVocab.size : 0;

  // Tokenise every text phrase so we can track the cumulative word position that
  // gives each phrase a position-INDEPENDENT proportional estimate of where its
  // onset should fall in the audio (never uses startTime).
  const tokenized = textPhrases.map((p) => ({ p, tokens: tokenize(p.text) }));
  const totalTextTokens = tokenized.reduce((s, x) => s + x.tokens.length, 0) || 1;

  // Distinctive anchors only (≥ 8 tokens) so the band search is unambiguous.
  const cumulative: number[] = [];
  let run = 0;
  for (const x of tokenized) {
    cumulative.push(run);
    run += x.tokens.length;
  }
  const anchorIdx = tokenized
    .map((x, i) => ({ ...x, cumWords: cumulative[i] }))
    .filter((x) => x.tokens.length >= 8);
  const step = Math.max(1, Math.floor(anchorIdx.length / anchors));

  // Band must exceed the aligner's own worst proportional error (~1200 words on
  // a 38k-word book) so a correctly-aligned onset is always inside it.
  const band = Math.max(1500, Math.round(words.length * 0.04));

  const samples: PhraseOffset[] = [];
  for (let k = 0; k < anchorIdx.length; k += step) {
    const { p, tokens, cumWords } = anchorIdx[k];
    const center = Math.round((cumWords / totalTextTokens) * words.length);
    const best = locateOnsetInBand(tokens, words, center, band, minConfidence);
    const trueStart = best ? timedWords[best.pos].start : null;
    samples.push({
      index: p.index,
      storedStart: p.startTime,
      trueStart,
      trueWordIndex: best ? best.pos : null,
      deltaSeconds: trueStart !== null ? trueStart - p.startTime : null,
      confidence: best ? Math.round(best.score * 100) / 100 : 0,
    });
  }

  const located = samples.filter((s) => s.deltaSeconds !== null);
  const deltas = located.map((s) => s.deltaSeconds as number);
  const medianDeltaSeconds = median(deltas);

  // Convert the median time shift into "phrases behind" using this book's own
  // median phrase duration — that is the unit the reader actually perceives.
  const durations = textPhrases
    .map((p) => p.endTime - p.startTime)
    .filter((d) => d > 0);
  const medPhraseDur = median(durations) || 1;
  const medianDeltaPhrases = Math.round(medianDeltaSeconds / medPhraseDur);

  const driftSlope = slope(
    located.map((s) => s.index),
    deltas,
  );

  // Leading extra words: how far into the audio phrase 0's true onset sits.
  const firstLocated = located[0];
  const leadingExtraWords = firstLocated?.trueWordIndex ?? 0;
  const leadingExtraSeconds = firstLocated?.trueStart ?? 0;

  return {
    book: opts.book,
    textPhrases: textPhrases.length,
    timedWords: timedWords.length,
    editionCoverage: Math.round(editionCoverage * 1000) / 1000,
    leadingExtraWords,
    leadingExtraSeconds: Math.round(leadingExtraSeconds * 10) / 10,
    measured: located.length,
    medianDeltaSeconds: Math.round(medianDeltaSeconds * 10) / 10,
    medianDeltaPhrases,
    driftSlope: Math.round(driftSlope * 10000) / 10000,
    constantOffset: Math.abs(driftSlope) < constantSlopeThreshold,
    samples,
  };
}
