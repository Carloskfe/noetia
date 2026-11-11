/**
 * NEM-024 PO-046 — storage-read decomposition micro-benchmark (test tooling only; never imported by src).
 *
 * Reads the disposable NEM-023 fixture books from the disposable MinIO and measures, per object and per variant:
 * wall time, process CPU (all threads), main-thread CPU and other-thread CPU (/proc/self/task), main-thread GC count
 * and pause time, chunk count, and the sync Buffer.concat time. Variants (ALL return the exact object bytes; verified
 * against the production read by SHA-256 before timing):
 *   prod        — StorageService.getBytes (production path: SDK GetObject → stream → Buffer.concat)
 *   noCrc       — same SDK path, client with responseChecksumValidation 'WHEN_REQUIRED' (SDK skips its CRC check)
 *   prealloc    — SDK stream copied into one buffer preallocated from ContentLength (no chunk array, no concat)
 *   sdkBytes    — SDK Body.transformToByteArray()
 *   rawHttp     — node:http GET of a presigned URL (no SDK in the data path) into a preallocated buffer
 *   cached      — copy of bytes already in memory (UPPER BOUND reference: no I/O at all)
 * Run inside the capped container: node out/tests/perf/s2-fetch-bench.js [rounds] [concurrency]
 * No book text, keys, credentials or hashes are printed — only numbers.
 */
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
import { readFileSync, readdirSync } from 'fs';
import { request } from 'http';
import { PerformanceObserver } from 'perf_hooks';

const { StorageService } = require('../../src/storage/storage.service');
const { computeTextHash } = require('../../src/knowledge/rights/text-hash');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Client } = require('pg');

const env = process.env;
if (env.NEM019_DISPOSABLE_DB !== '1' || !/_test$/.test(env.DB_NAME ?? '')) throw new Error('disposable DB only');
const ROUNDS = Number(process.argv[2] ?? 6);
const CONC = Number(process.argv[3] ?? 1);

function perThread(): Map<string, number> {
  const m = new Map<string, number>();
  for (const tid of readdirSync('/proc/self/task')) {
    try { const st = readFileSync(`/proc/self/task/${tid}/stat`, 'utf8'); const f = st.slice(st.lastIndexOf(')') + 2).split(' '); m.set(tid, (Number(f[11]) + Number(f[12])) * 10); } catch { /* exited */ }
  }
  return m;
}
function threadCpuMs(): { main: number; other: number } {
  let main = 0; let other = 0;
  for (const tid of readdirSync('/proc/self/task')) {
    try {
      const st = readFileSync(`/proc/self/task/${tid}/stat`, 'utf8');
      const f = st.slice(st.lastIndexOf(')') + 2).split(' ');
      const ms = (Number(f[11]) + Number(f[12])) * 10;
      if (Number(tid) === process.pid) main += ms; else other += ms;
    } catch { /* exited */ }
  }
  return { main, other };
}
const gc = { n: 0, ms: 0 };
new PerformanceObserver((l) => { for (const e of l.getEntries()) { gc.n++; gc.ms += e.duration; } }).observe({ entryTypes: ['gc'] });
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const r1 = (x: number) => Math.round(x * 100) / 100;

async function main() {
  const db = new Client({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASS });
  await db.connect();
  const keys: string[] = (await db.query(`SELECT DISTINCT b."textFileKey" k FROM books b JOIN ai_book_chunks c ON c."bookId" = b.id WHERE b."textFileKey" IS NOT NULL`)).rows.map((r: any) => r.k);
  await db.end();
  const storage = new StorageService();
  const endpoint = `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;
  const credentials = { accessKeyId: env.MINIO_ACCESS_KEY, secretAccessKey: env.MINIO_SECRET_KEY };
  const base = { endpoint, region: 'us-east-1', credentials, forcePathStyle: true };
  const noCrcClient = new S3Client({ ...base, responseChecksumValidation: 'WHEN_REQUIRED' });
  const plainClient = new S3Client(base);
  let concatMs = 0; let chunks = 0;

  const variants: Record<string, (k: string) => Promise<Uint8Array>> = {
    prod: (k) => storage.getBytes(k, 'books'),
    noCrc: async (k) => {
      const res = await noCrcClient.send(new GetObjectCommand({ Bucket: 'books', Key: k }));
      const cs: Buffer[] = [];
      for await (const c of res.Body) cs.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      chunks += cs.length;
      const t = process.hrtime.bigint(); const out = Buffer.concat(cs); concatMs += Number(process.hrtime.bigint() - t) / 1e6;
      return out;
    },
    prealloc: async (k) => {
      const res = await plainClient.send(new GetObjectCommand({ Bucket: 'books', Key: k }));
      const out = Buffer.allocUnsafeSlow(Number(res.ContentLength));
      let off = 0;
      for await (const c of res.Body) { out.set(c, off); off += c.length; chunks++; }
      if (off !== out.length) throw new Error('length mismatch');
      return out;
    },
    sdkBytes: async (k) => (await plainClient.send(new GetObjectCommand({ Bucket: 'books', Key: k }))).Body.transformToByteArray(),
    rawHttp: async (k) => {
      const url = await getSignedUrl(plainClient, new GetObjectCommand({ Bucket: 'books', Key: k }), { expiresIn: 300 });
      return new Promise((resolve, reject) => {
        request(url, (res) => {
          const len = Number(res.headers['content-length']);
          const out = Buffer.allocUnsafeSlow(len); let off = 0;
          res.on('data', (c: Buffer) => { c.copy(out, off); off += c.length; chunks++; });
          res.on('end', () => (off === len ? resolve(out) : reject(new Error('length mismatch'))));
          res.on('error', reject);
        }).on('error', reject).end();
      });
    },
  };
  // Reference bytes (one production read per key) — used to check every variant returns identical bytes, and for `cached`.
  const ref = new Map<string, Buffer>();
  for (const k of keys) ref.set(k, Buffer.from(await storage.getBytes(k, 'books')));
  variants.cached = async (k) => { const s = ref.get(k)!; const out = Buffer.allocUnsafeSlow(s.length); s.copy(out); return out; };
  for (const [name, fn] of Object.entries(variants)) {
    for (const k of keys) if (computeTextHash(await fn(k)) !== computeTextHash(ref.get(k)!)) throw new Error(`${name}: bytes differ`);
  }

  const results: any[] = [];
  for (const [name, fn] of Object.entries(variants)) {
    for (let w = 0; w < 2; w++) for (const k of keys) await fn(k); // warm-up
    (global as any).gc?.();
    const walls: number[] = [];
    const c0 = process.cpuUsage(); const t0 = threadCpuMs(); const pt0 = perThread(); const g0 = { ...gc }; concatMs = 0; chunks = 0;
    const tw = process.hrtime.bigint();
    let objects = 0;
    for (let r = 0; r < ROUNDS; r++) {
      for (let i = 0; i < keys.length; i += CONC) {
        await Promise.all(keys.slice(i, i + CONC).map(async (k) => { const t = process.hrtime.bigint(); await fn(k); walls.push(Number(process.hrtime.bigint() - t) / 1e6); objects++; }));
      }
    }
    const wallTotal = Number(process.hrtime.bigint() - tw) / 1e6;
    const c = process.cpuUsage(c0); const t1 = threadCpuMs(); const pt1 = perThread();
    const helpers = [...pt1].filter(([t]) => Number(t) !== process.pid).map(([t, v]) => v - (pt0.get(t) ?? 0)).filter((v) => v > 0).sort((a, b) => b - a);
    results.push({
      variant: name, objects, concurrency: CONC, mbPerObject: r1(ref.get(keys[0])!.length / 1048576),
      wallMs: { p50: r1(pct(walls, 50)), p95: r1(pct(walls, 95)) }, throughputObjPerS: r1(objects / (wallTotal / 1000)),
      cpuMsPerObject: { process: r1((c.user + c.system) / 1000 / objects), mainThread: r1((t1.main - t0.main) / objects), otherThreads: r1((t1.other - t0.other) / objects) },
      gcPerObject: { n: r1((gc.n - g0.n) / objects), ms: r1((gc.ms - g0.ms) / objects) },
      otherThreadsMsPerObjectTop: helpers.slice(0, 8).map((v) => r1(v / objects)), threadsTotal: pt1.size,
      chunksPerObject: name === 'prod' || name === 'sdkBytes' || name === 'cached' ? null : r1(chunks / objects),
      concatMsPerObject: name === 'noCrc' ? r1(concatMs / objects) : null,
    });
  }
  console.log(JSON.stringify({ rounds: ROUNDS, concurrency: CONC, books: keys.length, results }));
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
