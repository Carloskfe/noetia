import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sliceCodePointRanges } from '../../../../src/knowledge/retrieval/chunker';
import { LexicalRetrievalService } from '../../../../src/knowledge/retrieval/lexical-retrieval.service';
import { DEFAULT_RETRIEVAL_CONFIG, decodeUtf8 } from '../../../../src/knowledge/retrieval/retrieval.types';
import { S2VerificationPool } from '../../../../src/knowledge/retrieval/s2-verification.service';
import { StorageBookText } from '../../../../src/knowledge/retrieval/storage-book-text';
import { computeTextHash } from '../../../../src/knowledge/rights/text-hash';
import { StorageService } from '../../../../src/storage/storage.service';
import { bookId, FakeDb } from '../support/fixtures';

/**
 * PO-047 — the S2 adapter uses the bounded exact-byte read, hands the owned buffer to the S2 worker zero-copy, and a
 * failed read never reaches the worker (no text released). Uses an in-process loopback server and the real worker.
 */
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));
jest.setTimeout(60_000);
const ENV = { ...process.env };
let server: Server | null = null;
const pools: S2VerificationPool[] = [];
afterEach(async () => {
  process.env = { ...ENV };
  if (server) await new Promise((r) => server!.close(r));
  server = null;
  await Promise.all(pools.splice(0).map((p) => p.shutdown()));
});
async function serve(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  server = createServer(handler);
  const port = await new Promise<number>((r) => server!.listen(0, '127.0.0.1', () => r((server!.address() as AddressInfo).port)));
  process.env.MINIO_ENDPOINT = '127.0.0.1';
  process.env.MINIO_PORT = String(port);
  (getSignedUrl as jest.Mock).mockImplementation(async (_c: unknown, cmd: { input: { Bucket: string; Key: string } }) => `http://127.0.0.1:${port}/${cmd.input.Bucket}/${cmd.input.Key}?X-Amz-Signature=x`);
}
const T = Buffer.from('﻿Érase una vez un niño que cantaba. 𝔘na canción antigua 😀 sonaba en la plaza.');

describe('StorageBookText — PO-047 exact read path', () => {
  it('prefers getBytesExact over getBytes and marks the buffer owned (transferred zero-copy to the worker)', async () => {
    const storage = { getBytesExact: jest.fn(async () => Buffer.from(Buffer.alloc(10_000, 98))), getBytes: jest.fn() };
    const bytes = await new StorageBookText(storage as any).read('texts/x.txt');
    expect(storage.getBytesExact).toHaveBeenCalledWith('texts/x.txt', 'books');
    expect(storage.getBytes).not.toHaveBeenCalled();
    const pool = new S2VerificationPool({ startupTimeoutMs: 30_000, queueWaitTimeoutMs: 30_000 });
    pools.push(pool);
    await pool.verify(bytes, computeTextHash(Buffer.alloc(10_000, 98)), [{ start: 0, end: 1 }]);
    expect(pool.stats()).toMatchObject({ transferred: 1, copied: 0 });
  });

  it('end to end over a socket: real read → real worker → passages identical to the in-loop reference', async () => {
    await serve((_req, res) => { res.writeHead(200, { 'content-length': T.length }); res.end(T); });
    const pool = new S2VerificationPool({ startupTimeoutMs: 30_000, queueWaitTimeoutMs: 30_000 });
    pools.push(pool);
    const adapter = new StorageBookText(new StorageService());
    const ranges = [{ start: 0, end: 6 }, { start: 36, end: 55 }];
    const out = await pool.verify(await adapter.read('texts/t.txt'), computeTextHash(T), ranges);
    expect(out).toEqual({ kind: 'ok', passages: sliceCodePointRanges(decodeUtf8(T), ranges) });
    expect(pool.stats().transferred).toBe(1);
  });

  it('retrieval: a failed read (truncated transfer) excludes the book as unavailable and never calls the worker', async () => {
    await serve((_req, res) => { res.writeHead(200, { 'content-length': T.length + 50 }); res.write(T); setTimeout(() => res.socket?.destroy(), 10); });
    const B = bookId(1);
    const H = computeTextHash(T);
    const db = new FakeDb();
    db.on(/EXISTS \(SELECT 1 FROM ai_book_chunks/, (p) => p[0].map((b: string) => ({ bookId: b, current: true, indexed: true })));
    db.on(/ts_rank_cd/, () => [{ id: '30000000-0000-4000-8000-000000000001', bookId: B, textHash: H, chunkIndex: 0, charStart: 0, charEnd: 6, language: 'es', rank: 1 }]);
    db.on(/SELECT id, "textFileKey" FROM books/, () => [{ id: B, textFileKey: 'texts/t.txt' }]);
    const s2 = { verify: jest.fn(), shutdown: jest.fn() };
    const metrics = { retrievalInc: jest.fn(), passagesObserve: jest.fn(), excludedInc: jest.fn() };
    const svc = new LexicalRetrievalService(db as any, new StorageBookText(new StorageService()), metrics as any, DEFAULT_RETRIEVAL_CONFIG, s2 as any);
    const r = await svc.retrieve({ allowed: [{ bookId: B, textHash: H }], query: 'q', topK: 8, budgetTokens: 6000 });
    expect(r).toEqual({ passages: [], excluded: { unindexed: [], stale: [], unavailable: [B] }, truncated: false });
    expect(s2.verify).not.toHaveBeenCalled();
  });

  it('a complete read of a replaced object (different bytes) is stale, not unavailable', async () => {
    const replaced = Buffer.from(`${T.toString()} (replaced)`);
    await serve((_req, res) => { res.writeHead(200, { 'content-length': replaced.length }); res.end(replaced); });
    const pool = new S2VerificationPool({ startupTimeoutMs: 30_000, queueWaitTimeoutMs: 30_000 });
    pools.push(pool);
    const bytes = await new StorageBookText(new StorageService()).read('texts/t.txt');
    expect(await pool.verify(bytes, computeTextHash(T), [{ start: 0, end: 5 }])).toEqual({ kind: 'stale' });
  });
});
