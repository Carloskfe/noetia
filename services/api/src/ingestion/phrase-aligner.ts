/**
 * Aligns a book's SyncPhrase list against a flat list of Whisper TimedWords.
 *
 * Strategy: greedy forward scan with a configurable lookahead window.
 * For each text phrase we search ahead up to MAX_DRIFT words for the best
 * scoring window, then advance the cursor past the match.
 *
 * Skip-and-continue exception logic:
 *   If the best match score for a phrase is below SKIP_THRESHOLD (meaning the
 *   phrase content is not present in the audio — e.g. a scholarly glossary,
 *   appendix footnotes, or translator's notes not read aloud), the phrase is
 *   marked exception=true and its timestamps are left at 0. Crucially, the
 *   word cursor is NOT advanced for skipped phrases, so the next phrase
 *   searches from the same estimated audio position and can still find a match.
 *
 * Headings and paragraph-breaks are passed through unchanged (readers rarely
 * recite chapter titles verbatim).
 */

import { SyncPhrase } from '../books/sync-map.entity';
import { TimedWord } from './whisper-parser';

export interface AlignmentResult {
  phraseIndex: number;
  startTime: number;
  endTime: number;
  confidence: number;  // 0–1
}

export interface AlignmentStats {
  total: number;
  aligned: number;
  exceptions: number;
  lowConfidence: number;
  avgConfidence: number;
  lowConfidencePhrases: Array<{ index: number; text: string; confidence: number }>;
  exceptionPhrases:     Array<{ index: number; text: string }>;
}

const MAX_DRIFT      = 150;   // words to search around the estimate (covers LibriVox headers + local drift)
const SKIP_THRESHOLD = 0.20;  // below this → phrase not in audio → exception=true, cursor not advanced
const LOW_THRESHOLD  = 0.50;  // flag phrases below this confidence for spot-check (but still aligned)
const DRIFT_ALPHA    = 0.30;  // EMA weight for the running text↔audio drift correction (see below)

// ── Text normalisation ─────────────────────────────────────────────────────────

export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip accent marks
    .replace(/[^a-z0-9]/g, '');       // remove punctuation
}

// Pure-digit tokens are dropped from the alignment side only: verse numbers and
// marginal cross-reference numbers in the Wikisource KJV edition (e.g. "2 4 Abraham
// begat... and 5 Isaac begat...", or large refs like "23 704 Then...") are never
// read aloud, so they can only ever miss — inflating the `matches / n` denominator
// and sinking otherwise-aligned verses below SKIP_THRESHOLD. In Matthew they are
// ~20% of all tokens. This affects scoring only; the displayed phrase.text is
// untouched. Mixed alphanumerics ("2nd", "v1") and Roman numerals are kept.
function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeWord)
    .filter((t) => t && !/^\d+$/.test(t));
}

// ── Window scoring ─────────────────────────────────────────────────────────────
//
// Uses sequential subsequence matching: for each phrase token, look for it in
// the window starting after the previous match. This tolerates single omitted
// or inserted words without collapsing the rest of the matches.
// The window is 1.5× the phrase length to absorb audio insertions.

function scoreWindow(
  phraseTokens: string[],
  words: TimedWord[],
  offset: number,
): number {
  const n = phraseTokens.length;
  if (n === 0) return 0;
  const available = words.length - offset;
  if (available <= 0) return 0;

  // Extra room for words the reader adds that aren't in the text
  const windowSize = Math.min(Math.ceil(n * 1.5) + 5, available);
  const windowWords: string[] = [];
  for (let i = 0; i < windowSize; i++) {
    windowWords.push(normalizeWord(words[offset + i].word));
  }

  let matches = 0;
  let searchFrom = 0;
  for (const token of phraseTokens) {
    if (!token) continue;
    const found = windowWords.indexOf(token, searchFrom);
    if (found !== -1) {
      matches++;
      searchFrom = found + 1;
    }
  }

  return matches / n;
}

// ── Main alignment ─────────────────────────────────────────────────────────────
//
// Proportion-based positioning with EMA drift correction: each phrase estimates
// its target word index from cumulative word count relative to the total. The bare
// proportion assumes a uniform text↔audio word-density ratio, but that ratio drifts
// nonlinearly across a long book — Genesis (4h, 38k words) accumulates up to ~1162
// words of drift between the linear estimate and the true match position, far beyond
// MAX_DRIFT, which sank every verse outside the book's mid-section to ~20% confidence
// (avg 67%). The drift is smooth, so we track it with an exponential moving average:
// each confident match (≥ LOW_THRESHOLD) nudges `driftCorrection` toward its observed
// offset from the linear estimate, and the next phrase searches around estimate +
// correction. This keeps the global anchoring (a single bad phrase can't derail the
// rest — the EMA barely moves and low matches don't update it) while following the
// slow drift, lifting Genesis to ~95% confidence. Books that already align well have
// ~0 observed drift, so the correction stays ~0 and behaviour is unchanged.
//
// Skip-and-continue: if a phrase scores below SKIP_THRESHOLD it is marked as
// an exception. wordsSoFar is NOT incremented for exceptions so that subsequent
// phrases search from the same expected position and can still find their match.

export function alignPhrases(
  phrases: SyncPhrase[],
  timedWords: TimedWord[],
): { phrases: SyncPhrase[]; stats: AlignmentStats } {
  const result = phrases.map((p) => ({ ...p }));
  const lowConfidencePhrases: AlignmentStats['lowConfidencePhrases'] = [];
  const exceptionPhrases:     AlignmentStats['exceptionPhrases']     = [];

  // Pre-tokenise all text phrases and sum total words for proportion calc.
  // Only words that are actually expected to appear in the audio are counted —
  // this keeps the proportion accurate even if later phrases are exceptions.
  const textPhrasesWithTokens = phrases
    .map((p, i) => ({ i, phrase: p, tokens: p.type === 'text' ? tokenize(p.text) : [] }))
    .filter((x) => x.tokens.length > 0);

  const totalPhraseWords = textPhrasesWithTokens.reduce((s, x) => s + x.tokens.length, 0);
  const totalWordSlots   = timedWords.length;

  let wordsSoFar      = 0;   // only advances for phrases that were successfully aligned
  let driftCorrection = 0;   // EMA of (matched position − linear estimate); see header
  let aligned    = 0;
  let exceptions = 0;
  let totalConf  = 0;

  for (const { i, phrase, tokens } of textPhrasesWithTokens) {
    // Expected word index based on words aligned so far (not total words processed),
    // shifted by the running drift correction.
    const fraction    = totalPhraseWords > 0 ? wordsSoFar / totalPhraseWords : 0;
    const baseIdx     = Math.round(fraction * totalWordSlots);
    const expectedIdx = baseIdx + Math.round(driftCorrection);

    const searchStart = Math.max(0, expectedIdx - MAX_DRIFT);
    const searchEnd   = Math.min(totalWordSlots - tokens.length, expectedIdx + MAX_DRIFT);

    let best = { pos: searchStart, score: 0 };
    for (let w = searchStart; w <= searchEnd; w++) {
      const score = scoreWindow(tokens, timedWords, w);
      if (score > best.score) {
        best = { pos: w, score };
        if (score === 1) break;
      }
    }

    // ── Exception: phrase not found in audio ──────────────────────────────────
    if (best.score < SKIP_THRESHOLD) {
      result[i] = {
        ...phrase,
        startTime: 0,
        endTime:   0,
        exception: true,
      };
      exceptions++;
      exceptionPhrases.push({
        index: phrase.index,
        text:  phrase.text.slice(0, 80),
      });
      // wordsSoFar is NOT advanced — next phrase re-uses the same expected position
      continue;
    }

    // ── Aligned ───────────────────────────────────────────────────────────────
    const endPos = Math.min(best.pos + tokens.length - 1, totalWordSlots - 1);
    result[i] = {
      ...phrase,
      startTime: timedWords[best.pos]?.start ?? 0,
      endTime:   timedWords[endPos]?.end     ?? 0,
      exception: false,
    };

    wordsSoFar += tokens.length;
    aligned++;
    totalConf += best.score;

    // Only confident matches steer the drift EMA — low/spurious matches must not
    // pull the estimate toward a wrong position.
    if (best.score >= LOW_THRESHOLD) {
      driftCorrection =
        DRIFT_ALPHA * (best.pos - baseIdx) + (1 - DRIFT_ALPHA) * driftCorrection;
    }

    if (best.score < LOW_THRESHOLD) {
      lowConfidencePhrases.push({
        index:      phrase.index,
        text:       phrase.text.slice(0, 80),
        confidence: Math.round(best.score * 100) / 100,
      });
    }
  }

  const textPhraseCount = phrases.filter((p) => p.type === 'text').length;

  return {
    phrases: result,
    stats: {
      total:               textPhraseCount,
      aligned,
      exceptions,
      lowConfidence:       lowConfidencePhrases.length,
      avgConfidence:       aligned > 0 ? Math.round((totalConf / aligned) * 100) / 100 : 0,
      lowConfidencePhrases,
      exceptionPhrases,
    },
  };
}
