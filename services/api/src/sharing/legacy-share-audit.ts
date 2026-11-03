import { qualityGateSql } from '../books/book-eligibility';
import { checkQuoteAgainstSource, normalizeTypography, QuoteFailure } from './quote-integrity';

/**
 * NEM-016 legacy-share audit — READ ONLY.
 *
 * Identifies public shares that pre-date the Stage 0 corrections and would not
 * be allowed today. It never writes: callers run it inside a READ ONLY
 * transaction (see audit-legacy-shares.ts). Output contains share ids and
 * counts only — never quote text, names or e-mail addresses.
 */
export interface AuditDb {
  query(sql: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
}

/** Returns the book's source text (sync-map phrases or text file), or null. */
export type SourceLoader = (bookId: string, textFileKey: string | null) => Promise<string | null>;

export interface IdList {
  count: number;
  shareIds: string[];
}

export interface LegacyShareAuditReport {
  generatedAt: string;
  /** False before migration 068: every share counts as live (no revocation existed). */
  migration068Applied: boolean;
  liveShares: number;
  /** A: created by someone other than the fragment's owner (S1). */
  createdByNonOwner: IdList;
  /** A (info): the source fragment no longer exists, so ownership can't be checked. */
  sourceFragmentMissing: IdList;
  /** C: creator account deleted (or never recorded). */
  orphanCreator: IdList;
  /** D: book unpublished, missing, or below the quality gate (S14). */
  ineligibleBook: IdList;
  /** B: author-attributed quote fails the C1 integrity check. */
  quoteIntegrity: {
    checked: number;
    failing: IdList & { byReason: Partial<Record<QuoteFailure, number>> };
    /** Book source text unavailable — could not be verified either way. */
    unverifiable: IdList;
  };
}

const ids = (rows: Array<Record<string, unknown>>): IdList => ({
  count: rows.length,
  shareIds: rows.map((r) => String(r.id)),
});

export function auditQueries(migration068Applied: boolean) {
  const live = migration068Applied ? 's."revokedAt" IS NULL' : 'TRUE';
  return {
    liveShares: `SELECT COUNT(*)::int AS count FROM shares s WHERE ${live}`,
    createdByNonOwner: `
      SELECT s.id FROM shares s JOIN fragments f ON f.id = s."fragmentId"
       WHERE ${live} AND s."createdById" IS DISTINCT FROM f."userId"
       ORDER BY s."createdAt"`,
    sourceFragmentMissing: `
      SELECT s.id FROM shares s
       WHERE ${live}
         AND (s."fragmentId" IS NULL OR NOT EXISTS (SELECT 1 FROM fragments f WHERE f.id = s."fragmentId"))
       ORDER BY s."createdAt"`,
    orphanCreator: `
      SELECT s.id FROM shares s
       WHERE ${live}
         AND (s."createdById" IS NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s."createdById"))
       ORDER BY s."createdAt"`,
    ineligibleBook: `
      SELECT s.id FROM shares s
       WHERE ${live}
         AND NOT EXISTS (
           SELECT 1 FROM books book
            WHERE book.id = s."bookId" AND book."isPublished" = true AND ${qualityGateSql('book')}
         )
       ORDER BY s."createdAt"`,
    quotes: `
      SELECT s.id, s."bookId", s.quote, b."textFileKey"
        FROM shares s LEFT JOIN books b ON b.id = s."bookId"
       WHERE ${live}
       ORDER BY s."bookId", s."createdAt"`,
  };
}

export const MIGRATION_068_CHECK = `
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'shares' AND column_name = 'revokedAt'
  ) AS applied`;

export async function runLegacyShareAudit(db: AuditDb, loadSource: SourceLoader): Promise<LegacyShareAuditReport> {
  const [{ applied }] = await db.query(MIGRATION_068_CHECK);
  const q = auditQueries(!!applied);
  const [{ count }] = await db.query(q.liveShares);
  const liveShares = Number(count);

  const quotes = (await db.query(q.quotes)) as unknown as Array<{
    id: string;
    bookId: string;
    quote: string;
    textFileKey: string | null;
  }>;
  const failing: Array<{ id: string }> = [];
  const unverifiable: Array<{ id: string }> = [];
  const byReason: Partial<Record<QuoteFailure, number>> = {};
  const sources = new Map<string, string | null>();
  for (const row of quotes) {
    if (!sources.has(row.bookId)) {
      const raw = await loadSource(row.bookId, row.textFileKey).catch(() => null);
      sources.set(row.bookId, raw && raw.trim() ? normalizeTypography(raw) : null);
    }
    const source = sources.get(row.bookId);
    if (!source) {
      unverifiable.push(row);
      continue;
    }
    const result = checkQuoteAgainstSource(row.quote, source);
    if (!result.ok) {
      failing.push(row);
      byReason[result.reason] = (byReason[result.reason] ?? 0) + 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    migration068Applied: !!applied,
    liveShares,
    createdByNonOwner: ids(await db.query(q.createdByNonOwner)),
    sourceFragmentMissing: ids(await db.query(q.sourceFragmentMissing)),
    orphanCreator: ids(await db.query(q.orphanCreator)),
    ineligibleBook: ids(await db.query(q.ineligibleBook)),
    quoteIntegrity: {
      checked: quotes.length - unverifiable.length,
      failing: { ...ids(failing), byReason },
      unverifiable: ids(unverifiable),
    },
  };
}
