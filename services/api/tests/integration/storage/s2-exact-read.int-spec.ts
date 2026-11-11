import { randomBytes } from 'crypto';
import { computeTextHash } from '../../../src/knowledge/rights/text-hash';
import { S2ReadError, StorageService } from '../../../src/storage/storage.service';

/**
 * PO-047 — S2 exact-byte read against a DISPOSABLE local MinIO with real SigV4 presigning.
 * Opt-in like the NEM-023 performance suite: runs only when NEM023_MINIO_ENDPOINT/PORT/ACCESS_KEY/SECRET_KEY point at
 * a local disposable MinIO (refuses any non-local endpoint). Proves byte-exact equivalence with the SDK read
 * (`getBytes`), including Spanish, combining marks, emoji, BOM, invalid UTF-8, empty and multi-megabyte objects.
 */
const RUN = !!process.env.NEM023_MINIO_ENDPOINT;
(RUN ? describe : describe.skip)('PO-047 S2 exact read vs SDK read (disposable MinIO)', () => {
  const ENV = { ...process.env };
  let storage: StorageService;
  const objects: Record<string, Buffer> = {
    'po047/spanish.txt': Buffer.from('Érase una vez un niño; ¿cantaba? ¡Sí! Ñandú, pingüino, acción.\n'),
    'po047/combining.txt': Buffer.from('é ñ ä — ộ\r\n'),
    'po047/emoji.txt': Buffer.from('😀👍🏽 𝔘na 👨‍👩‍👧 \u{10FFFF}'),
    'po047/bom.txt': Buffer.from('﻿Hola﻿mundo'),
    'po047/invalid-utf8.bin': Buffer.concat([Buffer.from('ok '), Buffer.from([0xc3, 0x28, 0xff]), Buffer.from(' fin')]),
    'po047/empty.txt': Buffer.alloc(0),
    'po047/big.txt': Buffer.concat([Buffer.from('Érase 😀 canción \r\n'.repeat(150_000)), randomBytes(1024).map((b) => 0x20 + (b % 90))]),
  };

  beforeAll(async () => {
    if (!['127.0.0.1', 'localhost'].includes(process.env.NEM023_MINIO_ENDPOINT!)) throw new Error('local disposable MinIO only');
    process.env.MINIO_ENDPOINT = process.env.NEM023_MINIO_ENDPOINT;
    process.env.MINIO_PORT = process.env.NEM023_MINIO_PORT ?? '9000';
    process.env.MINIO_ACCESS_KEY = process.env.NEM023_MINIO_ACCESS_KEY;
    process.env.MINIO_SECRET_KEY = process.env.NEM023_MINIO_SECRET_KEY;
    process.env.MINIO_USE_SSL = 'false';
    process.env.MINIO_PUBLIC_URL = 'https://public.invalid'; // must never be used for S2 reads
    storage = new StorageService();
    const { S3Client, CreateBucketCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`, region: 'us-east-1', forcePathStyle: true,
      credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY!, secretAccessKey: process.env.MINIO_SECRET_KEY! } });
    await s3.send(new CreateBucketCommand({ Bucket: 'books' })).catch(() => undefined);
    for (const [k, v] of Object.entries(objects)) await storage.upload('books', k, v, 'application/octet-stream');
  });
  afterAll(() => { process.env = ENV; });

  it.each(Object.keys(objects))('%s: getBytesExact === getBytes === uploaded bytes (SHA-256 identical)', async (key) => {
    const exact = await storage.getBytesExact(key, 'books');
    const sdk = await storage.getBytes(key, 'books');
    expect(exact.equals(objects[key])).toBe(true);
    expect(exact.equals(sdk)).toBe(true);
    expect(computeTextHash(exact)).toBe(computeTextHash(sdk));
    if (exact.length) expect(exact.byteLength).toBe(exact.buffer.byteLength);
  });

  it('presigns against the PRIVATE endpoint even when a public presign URL is configured', async () => {
    expect((await storage.getBytesExact('po047/spanish.txt', 'books')).length).toBeGreaterThan(0);
  });

  it('missing object → S2ReadError(status); wrong credentials → S2ReadError(status)', async () => {
    await expect(storage.getBytesExact('po047/does-not-exist.txt', 'books')).rejects.toMatchObject({ reason: 'status' });
    process.env.MINIO_SECRET_KEY = 'wrong-secret-for-test';
    const bad = new StorageService();
    process.env.MINIO_SECRET_KEY = process.env.NEM023_MINIO_SECRET_KEY;
    const e = await bad.getBytesExact('po047/spanish.txt', 'books').catch((x) => x);
    expect(e).toBeInstanceOf(S2ReadError);
    expect(e.reason).toBe('status');
  });

  it('50 concurrent reads of the large object are all exact', async () => {
    const want = computeTextHash(objects['po047/big.txt']);
    const got = await Promise.all(Array.from({ length: 50 }, () => storage.getBytesExact('po047/big.txt', 'books')));
    expect(got.every((b) => computeTextHash(b) === want)).toBe(true);
  });
});
