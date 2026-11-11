import { LexicalRetrievalService } from '../../../../src/knowledge/retrieval/lexical-retrieval.service';
import { DEFAULT_RETRIEVAL_CONFIG, RetrievalRequest } from '../../../../src/knowledge/retrieval/retrieval.types';
import { S2Outcome, S2Verifier } from '../../../../src/knowledge/retrieval/s2-verification.service';
import { computeTextHash } from '../../../../src/knowledge/rights/text-hash';
import { bookId, FakeDb } from '../support/fixtures';

/**
 * PO-045 — LexicalRetrievalService ↔ S2 worker integration: every worker failure keeps the existing exclusion
 * semantics and return shape (hash mismatch → stale; everything else → unavailable), and no text is ever served from
 * a book that did not verify. The read stays on the main path; the worker receives the exact bytes, hash and offsets.
 */
const B1 = bookId(1);
const B2 = bookId(2);
const T1 = 'Érase una vez un niño que cantaba.';
const T2 = 'The children were running quickly.';
const H1 = computeTextHash(Buffer.from(T1));
const H2 = computeTextHash(Buffer.from(T2));
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number, b: string, h: string, s: number, e: number, rank: number) => ({ id: id(n), bookId: b, textHash: h, chunkIndex: n, charStart: s, charEnd: e, language: 'es', rank });
const req = (): RetrievalRequest => ({ allowed: [{ bookId: B1, textHash: H1 }, { bookId: B2, textHash: H2 }], query: 'q', topK: 8, budgetTokens: 6000 });

function setup(outcome: (bookHash: string) => S2Outcome) {
  const db = new FakeDb();
  db.on(/EXISTS \(SELECT 1 FROM ai_book_chunks/, (p) => p[0].map((b: string) => ({ bookId: b, current: true, indexed: true })));
  db.on(/ts_rank_cd/, () => [row(1, B1, H1, 0, 5, 0.9), row(2, B2, H2, 4, 12, 0.5), row(3, B1, H1, 6, 9, 0.4)]);
  db.on(/SELECT id, "textFileKey" FROM books/, (p) => p[0].map((b: string) => ({ id: b, textFileKey: `texts/${b}.txt` })));
  const objects: Record<string, Buffer> = { [`texts/${B1}.txt`]: Buffer.from(T1), [`texts/${B2}.txt`]: Buffer.from(T2) };
  const text = { read: jest.fn(async (k: string) => objects[k]) };
  const metrics = { retrievalInc: jest.fn(), passagesObserve: jest.fn(), excludedInc: jest.fn() };
  const s2: S2Verifier & { verify: jest.Mock; shutdown: jest.Mock } = {
    verify: jest.fn(async (_b: Uint8Array, h: string) => outcome(h)),
    shutdown: jest.fn(async () => undefined),
  };
  return { svc: new LexicalRetrievalService(db as any, text, metrics as any, DEFAULT_RETRIEVAL_CONFIG, s2), s2, text, metrics };
}

describe('LexicalRetrievalService with the S2 worker (PO-045)', () => {
  it('hands each distinct result book to the worker once, with its exact bytes, current hash, and offsets in rank order', async () => {
    const { svc, s2 } = setup((h) => ({ kind: 'ok', passages: h === H1 ? ['Érase', 'una'] : ['children'] }));
    const r = await svc.retrieve(req());
    expect(r.passages.map((p) => p.text)).toEqual(['Érase', 'children', 'una']);
    expect(s2.verify).toHaveBeenCalledTimes(2);
    const call1 = s2.verify.mock.calls.find((c) => c[1] === H1)!;
    expect(Buffer.from(call1[0]).toString()).toBe(T1);
    expect(call1[2]).toEqual([{ start: 0, end: 5 }, { start: 6, end: 9 }]);
    expect(r.excluded).toEqual({ unindexed: [], stale: [], unavailable: [] });
  });

  it.each(['timeout', 'crashed', 'saturated', 'queue_timeout', 'cooling_down', 'shutdown', 'worker_error', 'bad_reply', 'invalid_utf8'] as const)(
    'worker outcome unavailable/%s → the book is excluded as unavailable and none of its text is served',
    async (reason) => {
      const { svc, metrics } = setup((h) => (h === H1 ? { kind: 'unavailable', reason } : { kind: 'ok', passages: ['children'] }));
      const r = await svc.retrieve(req());
      expect(r.passages.map((p) => p.bookId)).toEqual([B2]);
      expect(r.excluded).toEqual({ unindexed: [], stale: [], unavailable: [B1] });
      expect(JSON.stringify(r)).not.toContain('Érase');
      expect(metrics.excludedInc).toHaveBeenCalledWith('unavailable', 1);
    },
  );

  it('worker outcome stale (hash mismatch) → stale, distinct from unavailable', async () => {
    const { svc } = setup((h) => (h === H2 ? { kind: 'stale' } : { kind: 'ok', passages: ['Érase', null] }));
    const r = await svc.retrieve(req());
    expect(r.passages.map((p) => p.text)).toEqual(['Érase']); // null slice (bad offsets) is skipped, as before
    expect(r.excluded).toEqual({ unindexed: [], stale: [B2], unavailable: [] });
  });

  it('every book failing → empty result with the existing shape and metrics', async () => {
    const { svc, metrics } = setup(() => ({ kind: 'unavailable', reason: 'timeout' }));
    const r = await svc.retrieve(req());
    expect(r).toEqual({ passages: [], excluded: { unindexed: [], stale: [], unavailable: [B1, B2] }, truncated: false });
    expect(metrics.retrievalInc).toHaveBeenCalledWith('empty');
  });

  it('a storage read failure never reaches the worker (unavailable, as before)', async () => {
    const { svc, s2, text } = setup(() => ({ kind: 'ok', passages: ['x'] }));
    text.read.mockImplementation(async () => { throw new Error('minio'); });
    const r = await svc.retrieve(req());
    expect(s2.verify).not.toHaveBeenCalled();
    expect(r.excluded.unavailable).toEqual([B1, B2]);
  });

  it('Nest shutdown hook stops the worker', async () => {
    const { svc, s2 } = setup(() => ({ kind: 'stale' }));
    await svc.onModuleDestroy();
    expect(s2.shutdown).toHaveBeenCalledTimes(1);
  });
});
