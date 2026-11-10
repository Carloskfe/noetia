import { computeTextHash } from '../../../../src/knowledge/rights/text-hash';
import { LexicalRetrievalService, normalizeQuery } from '../../../../src/knowledge/retrieval/lexical-retrieval.service';
import { DEFAULT_RETRIEVAL_CONFIG, estimateTokens, RetrievalRequest } from '../../../../src/knowledge/retrieval/retrieval.types';
import { bookId, FakeDb } from '../support/fixtures';

const B1 = bookId(1);
const B2 = bookId(2);
const T1 = 'Érase una vez un niño que cantaba. 𝔘na canción antigua sonaba en la plaza.';
const T2 = 'The children were running quickly to the café by the river.';
const H1 = computeTextHash(Buffer.from(T1));
const H2 = computeTextHash(Buffer.from(T2));
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function setup(o: { rows?: any[]; status?: any[]; objects?: Record<string, Uint8Array | 'throw'>; keys?: Record<string, string | null>; rankFails?: boolean } = {}) {
  const db = new FakeDb();
  db.on(/EXISTS \(SELECT 1 FROM ai_book_chunks/, (p) => o.status ?? p[0].map((b: string) => ({ bookId: b, current: true, indexed: true })));
  db.on(/ts_rank_cd/, () => { if (o.rankFails) throw new Error('statement timeout'); return o.rows ?? []; });
  db.on(/SELECT id, "textFileKey" FROM books/, (p) => p[0].map((b: string) => ({ id: b, textFileKey: o.keys && b in o.keys ? o.keys[b] : `texts/${b}.txt` })));
  const objects: Record<string, Uint8Array | 'throw'> = { [`texts/${B1}.txt`]: Buffer.from(T1), [`texts/${B2}.txt`]: Buffer.from(T2), ...o.objects };
  const text = { read: jest.fn(async (k: string) => { const v = objects[k]; if (!v || v === 'throw') throw new Error('minio'); return v; }) };
  const metrics = { retrievalInc: jest.fn(), passagesObserve: jest.fn(), excludedInc: jest.fn() };
  return { svc: new LexicalRetrievalService(db as any, text, metrics as any, DEFAULT_RETRIEVAL_CONFIG), db, text, metrics, objects };
}
const req = (over: Partial<RetrievalRequest> = {}): RetrievalRequest => ({ allowed: [{ bookId: B1, textHash: H1 }, { bookId: B2, textHash: H2 }], query: 'canción', topK: 8, budgetTokens: 6000, ...over });
const row = (n: number, bookId: string, textHash: string, charStart: number, charEnd: number, rank: number, language = 'es') =>
  ({ id: id(n), bookId, textHash, chunkIndex: n, charStart, charEnd, language, rank });

describe('LexicalRetrievalService (§5.5, §9.2, §9.3)', () => {
  it('ranks in SQL with the allowed pairs and the query as bound parameters; slices verified MinIO text by code points', async () => {
    const { svc, db, text, metrics } = setup({ rows: [row(1, B1, H1, 35, 54, 0.5), row(2, B2, H2, 4, 12, 0.2, 'en')] });
    const r = await svc.retrieve(req({ query: '  canción  ' }));
    expect(r.passages.map((p) => p.text)).toEqual(['𝔘na canción antigua', 'children']);
    expect(r.passages[0]).toMatchObject({ ref: `chunk:${id(1)}`, bookId: B1, textHash: H1, charStart: 35, charEnd: 54, chapterLabel: null, phraseRange: null, language: 'es', rank: 0.5 });
    expect(r.passages[0].tokens).toBe(estimateTokens('𝔘na canción antigua'));
    const [rank] = db.ran(/ts_rank_cd/);
    expect(rank.params).toEqual([[B1, B2], [H1, H2], 'canción', 8]); // NFC + trim; never interpolated
    expect(rank.sql).not.toContain('canción');
    expect(db.ran(/SET LOCAL statement_timeout = 2000/)).toHaveLength(1);
    expect(text.read).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ excluded: { unindexed: [], stale: [], unavailable: [] }, truncated: false });
    expect(metrics.retrievalInc).toHaveBeenCalledWith('ok');
    expect(metrics.passagesObserve).toHaveBeenCalledWith(2);
  });

  it('one MinIO read per distinct result book', async () => {
    const { svc, text } = setup({ rows: [row(1, B1, H1, 0, 5, 0.9), row(2, B1, H1, 6, 9, 0.8), row(3, B1, H1, 10, 13, 0.7)] });
    const r = await svc.retrieve(req());
    expect(r.passages.map((p) => p.text)).toEqual(['Érase', 'una', 'vez']);
    expect(text.read).toHaveBeenCalledTimes(1);
  });

  it('S2: every retrieval re-reads and re-verifies the object (no text cache), so a replaced object fails closed at once', async () => {
    const s = setup({ rows: [row(1, B1, H1, 0, 5, 0.9)] });
    expect((await s.svc.retrieve(req())).passages.map((p) => p.text)).toEqual(['Érase']);
    s.objects[`texts/${B1}.txt`] = Buffer.from(`${T1} (replaced)`);
    const r = await s.svc.retrieve(req()); // same caller-supplied (now stale) hash
    expect(r.passages).toEqual([]);
    expect(r.excluded.stale).toEqual([B1]);
    expect(s.text.read).toHaveBeenCalledTimes(2);
  });

  it('reports unindexed and stale books from SQL status', async () => {
    const { svc } = setup({ status: [{ bookId: B1, current: false, indexed: false }, { bookId: B2, current: false, indexed: true }] });
    const r = await svc.retrieve(req());
    expect(r.excluded).toEqual({ unindexed: [B1], stale: [B2], unavailable: [] });
    expect(r.passages).toEqual([]);
  });

  it('S2 fail closed: object hash mismatch → stale; read failure or missing key → unavailable', async () => {
    const rows = [row(1, B1, H1, 0, 5, 0.9), row(2, B2, H2, 4, 12, 0.5, 'en')];
    const a = setup({ rows, objects: { [`texts/${B1}.txt`]: Buffer.from(`${T1} (edited)`) } });
    const ra = await a.svc.retrieve(req());
    expect(ra.passages.map((p) => p.bookId)).toEqual([B2]);
    expect(ra.excluded.stale).toEqual([B1]);
    const b = setup({ rows, objects: { [`texts/${B2}.txt`]: 'throw' } });
    expect((await b.svc.retrieve(req())).excluded.unavailable).toEqual([B2]);
    const c = setup({ rows, keys: { [B1]: null } });
    expect((await c.svc.retrieve(req())).excluded.unavailable).toEqual([B1]);
    const bad = new Uint8Array([0xc3]);
    const d = setup({ rows: [row(1, B1, computeTextHash(bad), 0, 1, 1)], objects: { [`texts/${B1}.txt`]: bad } });
    expect((await d.svc.retrieve(req({ allowed: [{ bookId: B1, textHash: computeTextHash(bad) }] }))).excluded.unavailable).toEqual([B1]);
  });

  it('offsets outside the verified text are never served', async () => {
    const { svc } = setup({ rows: [row(1, B1, H1, 70, 9999, 0.9)] });
    expect((await svc.retrieve(req())).passages).toEqual([]);
  });

  it('budget: passages are kept in rank order while they fit; the rest are dropped and truncated is set', async () => {
    const rows = [row(1, B1, H1, 0, 34, 0.9), row(2, B1, H1, 0, 5, 0.8), row(3, B1, H1, 6, 9, 0.7)];
    const { svc } = setup({ rows });
    const r = await svc.retrieve(req({ budgetTokens: 3 }));
    expect(r.passages.map((p) => p.text)).toEqual(['Érase', 'una']);
    expect(r.passages.reduce((n, p) => n + p.tokens, 0)).toBeLessThanOrEqual(3);
    expect(r.truncated).toBe(true);
  });

  it('a query that is empty after normalization returns nothing without touching the database', async () => {
    const { svc, db, metrics } = setup();
    expect(await svc.retrieve(req({ query: '  \n ' }))).toEqual({ passages: [], excluded: { unindexed: [], stale: [], unavailable: [] }, truncated: false });
    expect(db.query).not.toHaveBeenCalled();
    expect(metrics.retrievalInc).toHaveBeenCalledWith('empty');
  });

  it.each<[string, any, string]>([
    ['empty allowed', { allowed: [] }, 'allowed'],
    ['allowed not an array', { allowed: null }, 'allowed'],
    ['non-uuid book', { allowed: [{ bookId: 'x', textHash: H1 }] }, 'allowed'],
    ['malformed hash', { allowed: [{ bookId: B1, textHash: 'sha256:short' }] }, 'allowed'],
    ['two versions of one book', { allowed: [{ bookId: B1, textHash: H1 }, { bookId: B1, textHash: H2 }] }, 'allowed'],
    ['more than 10 books', { allowed: Array.from({ length: 11 }, (_, i) => ({ bookId: bookId(100 + i), textHash: H1 })) }, 'allowed'],
    ['query not a string', { query: 5 }, 'query'],
    ['query over 500 code points', { query: '𝔘'.repeat(501) }, 'query'],
    ['topK 0', { topK: 0 }, 'topK'],
    ['topK 21', { topK: 21 }, 'topK'],
    ['topK fractional', { topK: 2.5 }, 'topK'],
    ['budget 0', { budgetTokens: 0 }, 'budgetTokens'],
    ['budget 8001', { budgetTokens: 8001 }, 'budgetTokens'],
  ])('rejects %s', async (_l, over, field) => {
    const { svc, db, metrics } = setup();
    await expect(svc.retrieve(req(over))).rejects.toMatchObject({ field });
    expect(db.query).not.toHaveBeenCalled();
    expect(metrics.retrievalInc).toHaveBeenCalledWith('invalid');
  });

  it('accepts exactly 500 code points, duplicates of the same pair, and SQL-meta characters as plain parameters', async () => {
    const { svc, db } = setup();
    await svc.retrieve(req({ query: '𝔘'.repeat(500) }));
    await svc.retrieve(req({ allowed: [{ bookId: B1, textHash: H1 }, { bookId: B1, textHash: H1 }], query: `'; DROP TABLE books; -- "x" OR 1=1` }));
    const calls = db.ran(/ts_rank_cd/);
    expect(calls[1].params[0]).toEqual([B1]);
    expect(calls[1].params[2]).toBe(`'; DROP TABLE books; -- "x" OR 1=1`);
  });

  it('a database failure (e.g. statement timeout) counts as error and propagates without query text', async () => {
    const { svc, metrics } = setup({ rankFails: true });
    await expect(svc.retrieve(req())).rejects.toThrow('statement timeout');
    expect(metrics.retrievalInc).toHaveBeenCalledWith('error');
  });

  it('normalizeQuery: NFC + trim; non-strings → empty', () => {
    expect(normalizeQuery(' canción ')).toBe('canción');
    expect(normalizeQuery(undefined)).toBe('');
  });
});
