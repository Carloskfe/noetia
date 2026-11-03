import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { StorageService } from '../storage/storage.service';

/**
 * Omission markers a reader may use between retained passages: "[…]", "[...]",
 * "(…)", "(...)", "…" and "..." (the fragment combine feature joins with " … ").
 */
const OMISSION_RE = /\[\s*(?:…|\.{3})\s*\]|\(\s*(?:…|\.{3})\s*\)|…|\.{3,}/g;

/** With internal omissions, every retained passage must be at least this long. */
export const MIN_WORDS_PER_OMISSION_SEGMENT = 3;
export const MAX_OMISSION_SEGMENTS = 6;

const CACHE_MAX_BOOKS = 8;
const CACHE_TTL_MS = 10 * 60_000;

/**
 * Wording-level normalization: Unicode NFC, case-folded, soft hyphens removed,
 * and every run of non-letter/non-digit characters collapsed to one space.
 * Words and their order must match the source; punctuation, quote style,
 * spacing and capitalization may differ.
 */
export function normalizeWording(s: string): string {
  return s
    .normalize('NFC')
    .replace(/­/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export type QuoteCheck =
  | { ok: true; segments: number }
  | { ok: false; reason: 'empty' | 'not_in_source' | 'segment_too_short' | 'too_many_segments' };

/**
 * Pure check: is `quote` a faithful excerpt of `normalizedSource`?
 *
 * - One passage: must appear verbatim (at the wording level) in the source.
 * - Several passages separated by omission markers: each must appear verbatim,
 *   in source order, without overlapping, and be at least
 *   MIN_WORDS_PER_OMISSION_SEGMENT words long (so single words can't be stitched
 *   together from across the book).
 *
 * This verifies wording and order only. It cannot judge whether an omission
 * changes the meaning — see the NEM-016 ellipsis design.
 */
export function checkQuoteAgainstSource(quote: string, normalizedSource: string): QuoteCheck {
  const segments = quote
    .split(OMISSION_RE)
    .map(normalizeWording)
    .filter((s) => s.length > 0);
  if (segments.length === 0) return { ok: false, reason: 'empty' };
  if (segments.length > MAX_OMISSION_SEGMENTS) return { ok: false, reason: 'too_many_segments' };
  if (
    segments.length > 1 &&
    segments.some((s) => s.split(' ').length < MIN_WORDS_PER_OMISSION_SEGMENT)
  ) {
    return { ok: false, reason: 'segment_too_short' };
  }

  // Pad with spaces so matches fall on word boundaries.
  const haystack = ` ${normalizedSource} `;
  let from = 0;
  for (const seg of segments) {
    const at = haystack.indexOf(` ${seg} `, from);
    if (at < 0) return { ok: false, reason: 'not_in_source' };
    // Next passage must start after this one ends (shared boundary space allowed).
    from = at + seg.length + 1;
  }
  return { ok: true, segments: segments.length };
}

/**
 * Stage 0 quotation-integrity guardrail (SA-001 D05 / C1, NEM-016 S2).
 *
 * Text rendered as a book quotation must be the author's own wording. It is
 * checked against the book's source text: the sync-map phrases when present
 * (what the reader displays), otherwise the stored text file.
 */
@Injectable()
export class QuoteIntegrityService {
  private readonly cache = new Map<string, { text: string; at: number }>();

  constructor(
    @InjectRepository(SyncMap) private readonly syncMapRepo: Repository<SyncMap>,
    private readonly storage: StorageService,
  ) {}

  /** Throws 422 `quote_not_in_source` (with a reason) when the quote isn't faithful. */
  async assertFaithfulExcerpt(book: Book, quote: string): Promise<void> {
    const source = await this.loadSource(book);
    const result = checkQuoteAgainstSource(quote, source);
    if (!result.ok) {
      throw new UnprocessableEntityException({ error: 'quote_not_in_source', reason: result.reason });
    }
  }

  private async loadSource(book: Book): Promise<string> {
    const hit = this.cache.get(book.id);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.text;

    let raw = '';
    const syncMap = await this.syncMapRepo.findOneBy({ bookId: book.id });
    if (syncMap?.phrases?.length) {
      raw = syncMap.phrases.map((p) => p.text ?? '').join(' ');
    } else if (book.textFileKey) {
      try {
        raw = await this.storage.getText(book.textFileKey);
      } catch {
        throw new ServiceUnavailableException({ error: 'quote_source_unavailable' });
      }
    }
    if (!raw.trim()) {
      // No source to verify against: refuse rather than attribute unverified text.
      throw new UnprocessableEntityException({ error: 'quote_not_in_source', reason: 'no_source' });
    }

    const text = normalizeWording(raw);
    if (this.cache.size >= CACHE_MAX_BOOKS) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(book.id, { text, at: Date.now() });
    return text;
  }
}
