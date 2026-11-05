import { qualityGateSql } from '../books/book-eligibility';
import { cardKeyFromUrl } from './card-key';

/**
 * NEM-016 R3 — card images left behind before the F2 correction. READ ONLY.
 *
 * Compares the objects in the public `images` bucket with `shares` and the
 * deletion outbox, and sorts them by how sure we can be. It deletes nothing, and
 * this module has no code path that could. `proposedActions` is a dry-run plan
 * for a person to review. Output holds keys, share ids and counts only.
 */
export interface AuditDb {
  query(sql: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
}

export interface StorageObject {
  key: string;
  lastModified: Date;
}

export interface ShareRef {
  id: string;
  imageUrl: string | null;
  revoked: boolean;
  bookExists: boolean;
  bookEligible: boolean;
  createdAt: Date;
}

export type CardClass =
  /** A live share of an eligible book uses it. Never touch. */
  | 'in_use'
  /** SAFE: a live share still points at it, but the book row is gone (the F2 defect). */
  | 'book_deleted'
  /** SAFE: every share using it is revoked and nothing is queued (should already be gone). */
  | 'revoked_not_deleted'
  /** Handled: an outbox row exists, so the sweep will delete it. */
  | 'queued'
  /** AMBIGUOUS: the share is live and the book exists but fails the gate today; it may come back. */
  | 'live_book_ineligible'
  /** AMBIGUOUS: too new to judge; may belong to a request still in flight. */
  | 'recent'
  /** AMBIGUOUS: no share row, and older than every share, so it predates share records. */
  | 'unreferenced_before_shares'
  /** AMBIGUOUS: no share row, from after shares existed. Cause can't be determined. */
  | 'unreferenced';

export const SAFE_CLASSES: readonly CardClass[] = ['book_deleted', 'revoked_not_deleted'];
export const DEFAULT_MIN_AGE_HOURS = 24;

export interface ClassifyOptions {
  now: Date;
  minAgeHours: number;
}

export interface OrphanImageReport {
  generatedAt: string;
  readOnly: true;
  minAgeHours: number;
  objectsListed: number;
  /** Objects that aren't root-level <uuid>.png: covers, presets, user backgrounds. Never considered. */
  ignoredNonCards: number;
  counts: Record<CardClass, number>;
  keys: Record<Exclude<CardClass, 'in_use'>, string[]>;
  /** Live shares whose image is missing. Report only: a broken card, not an orphan. */
  liveSharesMissingImage: string[];
  /** Shares whose imageUrl isn't one of our card URLs. Report only. */
  sharesWithForeignImage: string[];
  /** Dry run: what a reviewed, approved clean-up would do. Nothing here has been done. */
  proposedActions: { revokeShares: string[]; deleteObjects: string[] };
}

const EMPTY = (): Record<CardClass, number> => ({
  in_use: 0, book_deleted: 0, revoked_not_deleted: 0, queued: 0, live_book_ineligible: 0,
  recent: 0, unreferenced_before_shares: 0, unreferenced: 0,
});

const ROOT_CARD_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i;

/** Pure classification, so every rule can be tested without a database or storage. */
export function classifyCardImages(
  objects: StorageObject[],
  shares: ShareRef[],
  outboxKeys: string[],
  { now, minAgeHours }: ClassifyOptions,
): OrphanImageReport {
  const byKey = new Map<string, ShareRef[]>();
  const foreign: string[] = [];
  for (const s of shares) {
    const key = cardKeyFromUrl(s.imageUrl);
    if (!key) { foreign.push(s.id); continue; }
    byKey.set(key, [...(byKey.get(key) ?? []), s]);
  }
  const queued = new Set(outboxKeys);
  const firstShareAt = shares.reduce<number | null>((min, s) => {
    const t = s.createdAt.getTime();
    return min === null || t < min ? t : min;
  }, null);
  const minAgeMs = minAgeHours * 3_600_000;

  const cards = objects.filter((o) => ROOT_CARD_KEY.test(o.key));
  const present = new Set(cards.map((o) => o.key));
  const counts = EMPTY();
  const keys = { book_deleted: [], revoked_not_deleted: [], queued: [], live_book_ineligible: [], recent: [], unreferenced_before_shares: [], unreferenced: [] } as OrphanImageReport['keys'];
  const revokeShares: string[] = [];
  const deleteObjects: string[] = [];

  for (const object of cards) {
    const refs = byKey.get(object.key) ?? [];
    const live = refs.filter((s) => !s.revoked);
    const isRecent = now.getTime() - object.lastModified.getTime() < minAgeMs;
    let cls: CardClass;
    if (live.some((s) => s.bookExists && s.bookEligible)) cls = 'in_use';
    else if (live.some((s) => s.bookExists)) cls = 'live_book_ineligible';
    else if (queued.has(object.key)) cls = 'queued';
    else if (isRecent) cls = 'recent';
    else if (live.length > 0) cls = 'book_deleted';
    else if (refs.length > 0) cls = 'revoked_not_deleted';
    else if (firstShareAt === null || object.lastModified.getTime() < firstShareAt) cls = 'unreferenced_before_shares';
    else cls = 'unreferenced';

    counts[cls]++;
    if (cls !== 'in_use') keys[cls].push(object.key);
    if (cls === 'book_deleted') revokeShares.push(...live.map((s) => s.id));
    if (SAFE_CLASSES.includes(cls)) deleteObjects.push(object.key);
  }

  const liveSharesMissingImage = [...byKey.entries()]
    .filter(([key]) => !present.has(key))
    .flatMap(([, refs]) => refs.filter((s) => !s.revoked).map((s) => s.id));

  return {
    generatedAt: now.toISOString(),
    readOnly: true,
    minAgeHours,
    objectsListed: objects.length,
    ignoredNonCards: objects.length - cards.length,
    counts,
    keys,
    liveSharesMissingImage,
    sharesWithForeignImage: foreign,
    proposedActions: { revokeShares, deleteObjects },
  };
}

/** Runs the read-only queries. The caller holds the READ ONLY transaction. */
export async function runOrphanImageAudit(
  db: AuditDb,
  listObjects: () => Promise<StorageObject[]>,
  options: ClassifyOptions,
): Promise<OrphanImageReport> {
  // Works before migration 068 too: without the column nothing can be revoked.
  const cols = await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'shares' AND column_name = 'revokedAt'`);
  const revokedSql = cols.length > 0 ? `s."revokedAt" IS NOT NULL` : 'false';
  const rows = await db.query(
    `SELECT s.id, s."imageUrl", s."createdAt", ${revokedSql} AS revoked,
            b.id IS NOT NULL AS "bookExists",
            COALESCE(b."isPublished" AND ${qualityGateSql('b')}, false) AS "bookEligible"
       FROM shares s LEFT JOIN books b ON b.id = s."bookId"`,
  );
  const outbox = await db.query(`SELECT to_regclass('card_image_deletions') IS NOT NULL AS present`);
  const outboxRows = outbox[0]?.present ? await db.query(`SELECT "key" FROM card_image_deletions`) : [];

  // Listed after the database snapshot, so a card created in between looks
  // unreferenced; the minimum age keeps it out of every safe class.
  const objects = await listObjects();
  const shares: ShareRef[] = rows.map((r) => ({
    id: String(r.id),
    imageUrl: (r.imageUrl as string | null) ?? null,
    revoked: r.revoked === true,
    bookExists: r.bookExists === true,
    bookEligible: r.bookEligible === true,
    createdAt: new Date(r.createdAt as string),
  }));
  return classifyCardImages(objects, shares, outboxRows.map((r) => String(r.key)), options);
}
