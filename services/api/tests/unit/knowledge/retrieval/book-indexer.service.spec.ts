import { computeTextHash } from '../../../../src/knowledge/rights/text-hash';
import { BookIndexer, SEARCH_CONFIG } from '../../../../src/knowledge/retrieval/book-indexer.service';
import { IndexingDecision } from '../../../../src/knowledge/retrieval/indexing-permission';
import { DEFAULT_RETRIEVAL_CONFIG, RetrievalConfig } from '../../../../src/knowledge/retrieval/retrieval.types';
import { bookId, FakeDb } from '../support/fixtures';

const B = bookId(7);
const TEXT = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(' ');
const BYTES = Buffer.from(TEXT, 'utf8');
const HASH = computeTextHash(BYTES);

interface S {
  book?: { language: string | null; textFileKey: string | null; isPublished: boolean } | null;
  decision?: IndexingDecision;
  sets?: string[];
  size?: number;
  sizeAfter?: number;
  bytes?: Uint8Array | 'throw';
  config?: Partial<RetrievalConfig>;
  existsInTx?: number;
  setsInTx?: number;
  insertFails?: boolean;
}

function setup(s: S = {}) {
  const db = new FakeDb();
  const book = s.book === undefined ? { language: 'es', textFileKey: 'texts/b7.txt', isPublished: true } : s.book;
  db.on(/FROM books WHERE id = \$1/, () => (book ? [book] : []));
  db.on(/SELECT DISTINCT "textHash" FROM ai_book_chunks/, () => (s.sets ?? []).map((h) => ({ textHash: h })));
  let sizeCalls = 0;
  db.on(/pg_total_relation_size/, () => [{ size: String(sizeCalls++ === 0 ? s.size ?? 0 : s.sizeAfter ?? 0) }]);
  db.on(/pg_advisory_xact_lock/, () => []);
  db.on(/SELECT count\(\*\)::int AS n FROM ai_book_chunks/, () => [{ n: s.existsInTx ?? 0 }]);
  db.on(/count\(DISTINCT "textHash"\)::int AS s/, () => [{ s: s.setsInTx ?? (s.sets ?? []).length }]);
  db.on(/INSERT INTO ai_book_chunks/, () => { if (s.insertFails) throw new Error('crash mid-insert'); return []; });
  const permission = { check: jest.fn(async () => s.decision ?? ({ permitted: true, textHash: HASH } as IndexingDecision)) };
  const text = { read: jest.fn(async () => { if (s.bytes === 'throw') throw new Error('minio down'); return s.bytes ?? BYTES; }) };
  const metrics = { indexBooksInc: jest.fn() };
  const config = { ...DEFAULT_RETRIEVAL_CONFIG, chunkTargetChars: 200, ...s.config };
  return { ix: new BookIndexer(db as any, permission as any, text, metrics as any, config), db, permission, text, metrics };
}

describe('BookIndexer (§5.3)', () => {
  it('indexes one complete set in one transaction: hash-checked, per-language config, no verbatim text column', async () => {
    const { ix, db, metrics, text } = setup();
    const r = await ix.indexBook(B);
    expect(r).toMatchObject({ outcome: 'indexed', textHash: HASH });
    expect(r.chunks).toBeGreaterThan(5);
    expect(text.read).toHaveBeenCalledWith('texts/b7.txt');
    const [ins] = db.ran(/INSERT INTO ai_book_chunks/);
    expect(ins.sql).toContain(`to_tsvector('noetia_es'::regconfig`);
    expect(ins.sql).not.toMatch(/"text"\s*[,)]/); // the column list has no text column
    expect(ins.params.slice(0, 3)).toEqual([B, HASH, 'es']);
    expect(ins.params[3]).toHaveLength(r.chunks!);
    expect(ins.params[6].every((t: string, i: number) => t === [...TEXT].slice(ins.params[4][i], ins.params[5][i]).join(''))).toBe(true);
    expect(db.ran(/SET LOCAL statement_timeout = 60000/)).toHaveLength(1);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(metrics.indexBooksInc).toHaveBeenCalledWith('indexed');
  });

  it.each([['en', 'noetia_en'], ['fr', 'noetia_simple'], [null, 'noetia_simple']])('language %s → %s', async (lang, cfg) => {
    const { ix, db } = setup({ book: { language: lang, textFileKey: 'k', isPublished: true } });
    await ix.indexBook(B);
    expect(db.ran(/INSERT INTO ai_book_chunks/)[0].sql).toContain(`'${cfg}'::regconfig`);
    expect(Object.values(SEARCH_CONFIG)).toContain(cfg);
  });

  it.each<[string, S, string, string]>([
    ['book not found', { book: null }, 'skipped_scope', 'book_not_found'],
    ['unpublished', { book: { language: 'es', textFileKey: 'k', isPublished: false } }, 'skipped_scope', 'not_published'],
    ['no stored text', { book: { language: 'es', textFileKey: null, isPublished: true } }, 'skipped_scope', 'no_stored_text'],
    ['permission denied (default deny)', { decision: { permitted: false, reason: 'text_identity_unknown' } }, 'skipped_scope', 'text_identity_unknown'],
    ['object hash ≠ permitted hash', { bytes: Buffer.from('other text') }, 'skipped_scope', 'hash_mismatch'],
    ['retention: two sets already', { sets: ['sha256:a', 'sha256:b'] }, 'skipped_limit', 'retention_previous_set_pending'],
    ['index at size budget', { size: DEFAULT_RETRIEVAL_CONFIG.maxIndexBytes }, 'skipped_limit', 'index_size_budget'],
    ['too many chunks', { config: { maxChunksPerBook: 3 } }, 'skipped_limit', 'too_many_chunks'],
    ['minio read fails', { bytes: 'throw' }, 'failed', 'text_unreadable'],
  ])('%s → %s (no write)', async (_l, s, outcome, reason) => {
    const { ix, db, metrics } = setup(s);
    expect(await ix.indexBook(B)).toMatchObject({ outcome, reason });
    expect(db.ran(/INSERT INTO ai_book_chunks/)).toEqual([]);
    expect(metrics.indexBooksInc).toHaveBeenCalledWith(outcome);
  });

  it('permission is checked before any object read', async () => {
    const { ix, text } = setup({ decision: { permitted: false, reason: 'not_attested' } });
    await ix.indexBook(B);
    expect(text.read).not.toHaveBeenCalled();
  });

  it('invalid UTF-8 and empty text are refused', async () => {
    const bad = new Uint8Array([0x61, 0xc3]);
    const a = setup({ bytes: bad, decision: { permitted: true, textHash: computeTextHash(bad) } });
    expect(await a.ix.indexBook(B)).toMatchObject({ outcome: 'failed', reason: 'text_not_utf8' });
    const blank = Buffer.from('   \n ');
    const b = setup({ bytes: blank, decision: { permitted: true, textHash: computeTextHash(blank) } });
    expect(await b.ix.indexBook(B)).toMatchObject({ outcome: 'skipped_scope', reason: 'empty_text' });
  });

  it('idempotent: an existing set for the hash is skipped without reading the object', async () => {
    const { ix, text } = setup({ sets: [HASH] });
    expect(await ix.indexBook(B)).toMatchObject({ outcome: 'exists' });
    expect(text.read).not.toHaveBeenCalled();
  });

  it('race: a set completed concurrently (seen under the advisory lock) is reported as exists', async () => {
    const { ix, db } = setup({ existsInTx: 5 });
    expect(await ix.indexBook(B)).toMatchObject({ outcome: 'exists' });
    expect(db.ran(/INSERT INTO ai_book_chunks/)).toEqual([]);
  });

  it('race: a second set created concurrently trips the retention limit inside the transaction', async () => {
    const { ix } = setup({ sets: ['sha256:old'], setsInTx: 2 });
    expect(await ix.indexBook(B)).toMatchObject({ outcome: 'skipped_limit', reason: 'retention_previous_set_pending' });
  });

  it('size budget exceeded after the insert rolls the transaction back', async () => {
    const { ix } = setup({ size: 0, sizeAfter: DEFAULT_RETRIEVAL_CONFIG.maxIndexBytes + 1 });
    expect(await ix.indexBook(B)).toMatchObject({ outcome: 'skipped_limit', reason: 'index_size_budget' });
  });

  it('a crash inside the transaction propagates (the transaction rolls back; no partial set)', async () => {
    const { ix } = setup({ insertFails: true });
    await expect(ix.indexBook(B)).rejects.toThrow('crash mid-insert');
  });

  it('indexAll walks published books with text in id order, one at a time, and tallies outcomes', async () => {
    const s = setup();
    s.db.on(/WHERE "isPublished" = true AND "textFileKey" IS NOT NULL ORDER BY id/, () => [{ id: bookId(1) }, { id: bookId(2) }, { id: bookId(3) }]);
    const spy = jest.spyOn(s.ix, 'indexBook')
      .mockResolvedValueOnce({ outcome: 'indexed' })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ outcome: 'skipped_scope' });
    expect(await s.ix.indexAll()).toEqual({ indexed: 1, skipped_scope: 1, skipped_limit: 0, exists: 0, failed: 1 });
    expect(spy.mock.calls.map((c) => c[0])).toEqual([bookId(1), bookId(2), bookId(3)]);
  });

  it('prune deletes superseded sets past the grace window, clamped to the 30-day hard cap', async () => {
    const now = new Date('2026-11-10T00:00:00Z');
    for (const [grace, expected] of [[24, 24], [10_000, 720], [-5, 0]] as const) {
      const s = setup({ config: { previousSetGraceHours: grace } });
      s.db.on(/WITH sets AS/, () => [{ sets: 1, rows: 9 }]);
      expect(await s.ix.prune(now)).toEqual({ sets: 1, rows: 9 });
      const [call] = s.db.ran(/WITH sets AS/);
      expect(call.params).toEqual([now.toISOString(), expected]);
      expect(call.sql).toMatch(/r\.created < r\.newest/); // never the newest (current) set
    }
  });

  it('purge removes every set for the book', async () => {
    const s = setup();
    s.db.on(/DELETE FROM ai_book_chunks WHERE "bookId" = \$1/, () => [{ sets: 2, rows: 30 }]);
    expect(await s.ix.purge(B)).toEqual({ sets: 2, rows: 30 });
    expect(s.db.ran(/DELETE FROM ai_book_chunks/)[0].params).toEqual([B]);
  });
});
