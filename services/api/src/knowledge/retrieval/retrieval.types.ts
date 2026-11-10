/**
 * NEM-023 (E5 Stage 1) retrieval contracts. Product code depends only on these interfaces (ADR-004): the lexical
 * PostgreSQL implementation is one adapter behind `RetrievalPort`; Stage 2 (pgvector) adds another.
 *
 * Dark components: nothing here is bound in `KnowledgeModule`, and no turn path calls it. E6 wires turns.
 */

/** A book version the caller's eligibility step allowed. `textHash` is the CURRENT hash from `TextIdentityPort`. */
export interface AllowedBookVersion {
  bookId: string;
  textHash: string;
}

export interface RetrievalRequest {
  /** Non-empty, ≤ 10 distinct books. Becomes SQL predicates, never a post-filter. */
  allowed: readonly AllowedBookVersion[];
  /** NFC-normalized and trimmed by the implementation; 1–500 code points; always a bound parameter. */
  query: string;
  /** 1–20. */
  topK: number;
  /** 1–8,000 estimated tokens of passage text. */
  budgetTokens: number;
}

export type RetrievalLanguage = 'es' | 'en' | 'simple';

export interface Passage {
  /** Opaque chunk ref (`chunk:<uuid>`), cited by the Gateway. */
  ref: string;
  bookId: string;
  textHash: string;
  chunkIndex: number;
  /** Unicode code-point offsets into the UTF-8-decoded text of the object whose hash is `textHash`. */
  charStart: number;
  charEnd: number;
  /** Always null in Stage 1 (Amendment 1, B-2). */
  chapterLabel: string | null;
  /** Always null in Stage 1 (Amendment 1, B-2). */
  phraseRange: { start: number; end: number } | null;
  language: RetrievalLanguage;
  rank: number;
  /** Excerpt sliced from the MinIO object after its hash was verified. Never logged or persisted. */
  text: string;
  /** Conservative token estimate of `text` (see `estimateTokens`). */
  tokens: number;
}

export interface RetrievalExclusions {
  /** Allowed books with no chunk set at all. */
  unindexed: string[];
  /** Allowed books whose chunks exist only for another text version, or whose object no longer matches the hash. */
  stale: string[];
  /** Allowed books whose text object could not be read (fail closed). */
  unavailable: string[];
}

export interface RetrievalResult {
  passages: Passage[];
  excluded: RetrievalExclusions;
  /** True when at least one ranked passage was dropped to respect the token budget. */
  truncated: boolean;
}

export interface RetrievalPort {
  retrieve(req: RetrievalRequest): Promise<RetrievalResult>;
}

/**
 * S2 text reads (§9.5). Runtime adapter: `StorageBookText` over the existing `StorageService`; tests bind a local
 * fixture. Returns the exact object bytes (the hash is byte-exact).
 */
export interface BookTextPort {
  read(textFileKey: string): Promise<Uint8Array>;
}

/** Thrown for a structurally invalid request (never carries query text). */
export class RetrievalRequestInvalid extends Error {
  constructor(readonly field: 'allowed' | 'query' | 'topK' | 'budgetTokens') {
    super(`invalid retrieval request: ${field}`);
    this.name = 'RetrievalRequestInvalid';
  }
}

/** Engineering configuration (D-8; PA-reviewed defaults from spec §9.4). */
export interface RetrievalConfig {
  chunkTargetChars: number;
  chunkOverlapRatio: number;
  maxChunksPerBook: number;
  maxIndexBytes: number;
  indexStatementTimeoutMs: number;
  retrievalStatementTimeoutMs: number;
  maxQueryCodePoints: number;
  maxTopK: number;
  maxBudgetTokens: number;
  defaultTopK: number;
  defaultBudgetTokens: number;
  maxAllowedBooks: number;
  /** In-flight window before a superseded set is pruned. Clamped to the 30-day hard cap. */
  previousSetGraceHours: number;
  /**
   * Byte budget of the optional in-memory LRU of hash-verified texts (S2, §5.1). 0 (default) disables it: every
   * retrieval re-reads and re-verifies the object. Enabling it is a PA decision (see the completion report).
   */
  verifiedTextCacheBytes: number;
}

/** D-7 hard cap: a superseded set is never kept beyond 30 days (not configurable). */
export const PREVIOUS_SET_HARD_CAP_HOURS = 30 * 24;

export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = Object.freeze({
  chunkTargetChars: 1500,
  chunkOverlapRatio: 0.1,
  maxChunksPerBook: 2000,
  maxIndexBytes: 250 * 1024 * 1024,
  indexStatementTimeoutMs: 60_000,
  retrievalStatementTimeoutMs: 2_000,
  maxQueryCodePoints: 500,
  maxTopK: 20,
  maxBudgetTokens: 8_000,
  defaultTopK: 8,
  defaultBudgetTokens: 6_000,
  maxAllowedBooks: 10,
  previousSetGraceHours: 24,
  verifiedTextCacheBytes: 0,
});

/**
 * Conservative token estimate for budget enforcement before the Gateway's `prepare`: one token per 3 UTF-8 bytes,
 * rounded up. It over-counts relative to the simulator's 4 bytes per token, so a budgeted context never exceeds the
 * reservation it was sized for.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / 3);
}

export const CHUNK_REF_PREFIX = 'chunk:';
export const chunkRef = (id: string) => `${CHUNK_REF_PREFIX}${id}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s);
export function chunkIdFromRef(ref: string): string | null {
  if (typeof ref !== 'string' || !ref.startsWith(CHUNK_REF_PREFIX)) return null;
  const id = ref.slice(CHUNK_REF_PREFIX.length);
  return isUuid(id) ? id : null;
}

/** Citation anchor carried by Gateway citations: `textHash:charStart-charEnd`. */
export const citationAnchor = (p: { textHash: string; charStart: number; charEnd: number }) => `${p.textHash}:${p.charStart}-${p.charEnd}`;

/** `books.language` → search configuration language; unknown values map to `simple` (§9.3). */
export function retrievalLanguage(bookLanguage: string | null | undefined): RetrievalLanguage {
  const l = (bookLanguage ?? '').trim().toLowerCase();
  if (l === 'es' || l.startsWith('es-') || l.startsWith('es_')) return 'es';
  if (l === 'en' || l.startsWith('en-') || l.startsWith('en_')) return 'en';
  return 'simple';
}

/** Strict UTF-8 decode: invalid bytes throw instead of being replaced (offsets must be exact). */
export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}
