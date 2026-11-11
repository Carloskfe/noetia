/**
 * NEM-024 PO-044 — Q-11 root-cause DIAGNOSTICS (test tooling only; never imported by src). Enabled in the harness with
 * Q11_DIAG=1. Everything here is runtime instrumentation of the harness process, reversible by restarting it:
 *
 *  - component timers: monkey-patched wrappers around module exports / prototypes (computeTextHash, decodeUtf8,
 *    sliceCodePointRanges, StorageService.getBytes, LexicalRetrievalService.retrieve, AiGatewayService.prepare/invoke,
 *    TurnService.run) and the `pg` client query (round trip as seen by Node, by SQL category — never parameters);
 *  - event loop: monitorEventLoopDelay + eventLoopUtilization per 1 s window + a 10 ms drift detector recording every
 *    stall ≥ 30 ms with its wall-clock timestamp (for correlation with client-side outliers);
 *  - CPU: process.cpuUsage and cgroup v2 cpu.stat (usage, nr_throttled, throttled_usec) per 1 s window, and every
 *    100 ms window in which throttling occurred;
 *  - GC: PerformanceObserver('gc') entries with timestamps;
 *  - CPU profile: the built-in inspector Profiler (start/stop over the control API), summarized by self time,
 *    category, and inclusive time of key frames;
 *  - ABLATIONS (diagnostic only, NOT remedies; they deliberately bypass the accepted per-request re-read/re-verify
 *    contract, NEM-023 AC-11/P-2, to measure how much of the interference each component causes):
 *      none      — production behaviour;
 *      nohash    — SHA-256 verification memoized per object content fingerprint (≈ "verify once per version");
 *      s2free    — S2 bytes cached by key + hash/decode/slice memoized (≈ zero S2 CPU on the main thread);
 *      bytescan  — CONTRACT-COMPATIBLE candidate: per-request read + SHA-256 unchanged; whole-object fatal UTF-8
 *                  validation (buffer.isUtf8) instead of a full decode; passages decoded from byte offsets found by
 *                  counting code points in the bytes (output verified identical to sliceCodePointRanges by /diag/bench);
 *      s2worker  — s2free on the main thread PLUS the same S2 CPU work (SHA-256 + decode + slice of each result book)
 *                  executed in a worker thread that the turn awaits — a synthetic proxy for worker-thread isolation in
 *                  the same 1-vCPU cgroup (excludes the fetch's own CPU and result transfer);
 *  - /diag/bench: an isolated, unloaded micro-benchmark of each S2 step on the 10 fixture books.
 *  - PO-045: S2 worker pool counters (`processS2Verifier().stats()` deltas since the last reset), queue depth sampled
 *    every 10 ms, and per-thread CPU from /proc/self/task (the S2 worker thread is a separate task).
 *    After PO-045 the production retrieval path no longer calls computeTextHash/decodeUtf8/sliceCodePointRanges on the
 *    main thread, so the s2:* timers and the ablation modes no longer affect it; they are HISTORICAL (PO-044) only.
 *    Do not use `s2free`/`s2worker` with the PO-045 code: their getBytes cache would hand the same (owned) buffer to the
 *    worker twice. Use mode `none` (= production behaviour) for PO-045 measurements.
 * No question text, passage text, SQL parameters, tokens, or PII are recorded.
 */
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { Session } from 'inspector';
import { monitorEventLoopDelay, performance, PerformanceObserver } from 'perf_hooks';
import { Worker } from 'worker_threads';

const textHashMod = require('../../src/knowledge/rights/text-hash');
const typesMod = require('../../src/knowledge/retrieval/retrieval.types');
const chunkerMod = require('../../src/knowledge/retrieval/chunker');
const { StorageService } = require('../../src/storage/storage.service');
const { LexicalRetrievalService } = require('../../src/knowledge/retrieval/lexical-retrieval.service');
const { AiGatewayService } = require('../../src/knowledge/ai/gateway/ai-gateway.service');
const { TurnService } = require('../../src/knowledge/sessions/turn.service');
const { processS2Verifier } = require('../../src/knowledge/retrieval/s2-verification.service');
const pg = require('pg');

type Mode = 'none' | 'nohash' | 's2free' | 's2worker' | 'bytescan';
const { isUtf8 } = require('buffer');
const hr = () => process.hrtime.bigint();
const msSince = (t0: bigint) => Number(hr() - t0) / 1e6;
const pct = (xs: number[], p: number) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const stat = (xs: number[]) => ({ n: xs.length, sum: round(xs.reduce((a, b) => a + b, 0)), p50: round(pct(xs, 50)), p95: round(pct(xs, 95)), p99: round(pct(xs, 99)), max: round(xs.length ? Math.max(...xs) : null) });
const round = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 1000);

/** Per-thread CPU (clock ticks → ms) from /proc/self/task; `comm` names only, no content. */
function threadCpu(): Map<string, { comm: string; ms: number }> {
  const out = new Map<string, { comm: string; ms: number }>();
  try {
    for (const tid of require('fs').readdirSync('/proc/self/task')) {
      try {
        const st = readFileSync(`/proc/self/task/${tid}/stat`, 'utf8');
        const comm = st.slice(st.indexOf('(') + 1, st.lastIndexOf(')'));
        const f = st.slice(st.lastIndexOf(')') + 2).split(' ');
        out.set(tid, { comm, ms: (Number(f[11]) + Number(f[12])) * 10 });
      } catch { /* thread exited */ }
    }
  } catch { /* not Linux */ }
  return out;
}

function cgroupCpu(): { usage: number; nrPeriods: number; nrThrottled: number; throttledUsec: number } | null {
  try {
    const kv = Object.fromEntries(readFileSync('/sys/fs/cgroup/cpu.stat', 'utf8').trim().split('\n').map((l) => l.split(' ')).map(([k, v]) => [k, Number(v)]));
    return { usage: kv.usage_usec, nrPeriods: kv.nr_periods, nrThrottled: kv.nr_throttled, throttledUsec: kv.throttled_usec };
  } catch { return null; }
}

/** SQL → coarse category (statement keyword + first table); never parameters, never literals. */
function sqlCategory(text: unknown): string {
  if (typeof text !== 'string') return 'other';
  const t = text.replace(/\s+/g, ' ').trim();
  const kw = (/^(WITH|SELECT|INSERT|UPDATE|DELETE|SET|BEGIN|COMMIT|ROLLBACK|START|SAVEPOINT|RELEASE)/i.exec(t)?.[1] ?? 'other').toUpperCase();
  if (/ai_book_chunks/.test(t) && /ts_rank_cd/.test(t)) return 'retrieval:rank';
  if (/ai_book_chunks/.test(t) && /EXISTS/.test(t)) return 'retrieval:status';
  const tbl = /(?:FROM|INTO|UPDATE)\s+"?([a-z_]+)"?/i.exec(t)?.[1] ?? '';
  return `${kw}${tbl ? ` ${tbl}` : ''}`;
}

const WORKER_SRC = `
const { parentPort } = require('worker_threads');
const { createHash } = require('crypto');
try { require('os').setPriority(Number(process.env.Q11_WORKER_NICE || 0)); } catch (e) {}
const books = new Map();
parentPort.on('message', (m) => {
  if (m.type === 'load') { books.set(m.key, Buffer.from(m.bytes)); return; }
  if (m.type === 'job') {
    for (const j of m.books) {
      const bytes = books.get(j.key); if (!bytes) continue;
      createHash('sha256').update(bytes).digest('hex');
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      // same single-pass code-point scan as sliceCodePointRanges, to the furthest wanted offset
      let max = 0; for (const r of j.ranges) if (r.end > max) max = r.end;
      let i = 0, cp = 0; const out = [];
      while (cp < max && i < text.length) { const c = text.charCodeAt(i); i += (c >= 0xd800 && c <= 0xdbff) ? 2 : 1; cp++; }
      for (const r of j.ranges) out.push(text.slice(r.start, r.end));
    }
    parentPort.postMessage({ type: 'done', id: m.id });
  }
});`;

/** Code-point ranges → strings directly from validated UTF-8 bytes (diagnostic candidate; not used by src). */
export function byteScanSlices(b: Buffer, ranges: readonly { start: number; end: number }[]): (string | null)[] {
  const wanted = [...new Set(ranges.flatMap((r) => [r.start, r.end]))].sort((x, y) => x - y);
  const at = new Map<number, number>();
  let cp = 0; let w = 0;
  for (let i = 0; i <= b.length && w < wanted.length; i++) {
    if (i === b.length || (b[i] & 0xc0) !== 0x80) { while (w < wanted.length && wanted[w] === cp) at.set(wanted[w++], i); cp++; }
  }
  return ranges.map((r) => { const s = at.get(r.start); const e = at.get(r.end); return s === undefined || e === undefined || r.start >= r.end ? null : b.toString('utf8', s, e); });
}

export function installDiagnostics(ref: { get: (t: any, o?: any) => any }) {
  let mode: Mode = 'none';
  const timers = new Map<string, number[]>();
  const rec = (name: string, ms: number) => { let a = timers.get(name); if (!a) timers.set(name, (a = [])); if (a.length < 200_000) a.push(ms); };

  // ── sync wrappers (module exports are looked up at call time in the compiled CommonJS) ──────────────────────────
  const origHash = textHashMod.computeTextHash;
  const origDecode = typesMod.decodeUtf8;
  const origSlice = chunkerMod.sliceCodePointRanges;
  const hashMemo = new Map<string, string>();
  const hashWeak = new WeakMap<object, string>();
  const decodeWeak = new WeakMap<object, string>();
  const sliceMemo = new Map<string, (string | null)[]>();
  const fingerprint = (b: Uint8Array) => { const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength); return `${b.byteLength}:${buf.subarray(0, 64).toString('hex')}:${buf.subarray(-64).toString('hex')}`; };
  textHashMod.computeTextHash = (bytes: Uint8Array) => {
    const t0 = hr();
    let out: string;
    if (mode === 'nohash') {
      const fp = fingerprint(bytes);
      out = hashMemo.get(fp) ?? origHash(bytes);
      hashMemo.set(fp, out);
    } else if (mode === 's2free' || mode === 's2worker') {
      out = hashWeak.get(bytes) ?? origHash(bytes);
      hashWeak.set(bytes, out);
    } else out = origHash(bytes);
    rec('s2:sha256', msSince(t0));
    return out;
  };
  typesMod.decodeUtf8 = (bytes: Uint8Array) => {
    const t0 = hr();
    let out: string;
    if (mode === 's2free' || mode === 's2worker') { out = decodeWeak.get(bytes) ?? origDecode(bytes); decodeWeak.set(bytes, out); }
    else if (mode === 'bytescan') {
      // Contract-compatible candidate: whole-object fatal UTF-8 validation, no full-string materialization. The
      // returned holder is consumed only by the patched sliceCodePointRanges below (retrieve() does nothing else with it).
      if (!isUtf8(bytes)) throw new TypeError('The encoded data was not valid for encoding utf-8');
      out = { __bytes: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength) } as unknown as string;
    } else out = origDecode(bytes);
    rec('s2:decode', msSince(t0));
    return out;
  };
  chunkerMod.sliceCodePointRanges = (text: string, ranges: readonly { start: number; end: number }[]) => {
    const t0 = hr();
    let out: (string | null)[];
    if (typeof text === 'object' && (text as any)?.__bytes) out = byteScanSlices((text as any).__bytes, ranges);
    else if (mode === 's2free' || mode === 's2worker') {
      const k = `${text.length}:${text.slice(0, 48)}:${JSON.stringify(ranges)}`;
      out = sliceMemo.get(k) ?? origSlice(text, ranges);
      sliceMemo.set(k, out);
    } else out = origSlice(text, ranges);
    rec('s2:slice', msSince(t0));
    return out;
  };

  // ── async wrappers ────────────────────────────────────────────────────────────────────────────────────────────
  const bytesCache = new Map<string, Buffer>();
  const origGetBytes = StorageService.prototype.getBytes;
  StorageService.prototype.getBytes = async function (this: unknown, key: string, bucket = 'books') {
    const t0 = hr();
    try {
      if ((mode === 's2free' || mode === 's2worker') && bytesCache.has(key)) return bytesCache.get(key)!;
      const b: Buffer = await origGetBytes.call(this, key, bucket);
      if (mode === 's2free' || mode === 's2worker') bytesCache.set(key, b);
      return b;
    } finally { rec('s2:getBytes(wall)', msSince(t0)); }
  };
  let worker: Worker | null = null;
  let jobSeq = 0;
  const pending = new Map<number, () => void>();
  const keyOf = new Map<string, string>(); // bookId → textFileKey (filled from the fixture by the harness)
  const origRetrieve = LexicalRetrievalService.prototype.retrieve;
  LexicalRetrievalService.prototype.retrieve = async function (this: unknown, req: unknown) {
    const t0 = hr();
    try {
      const r = await origRetrieve.call(this, req);
      if (mode === 's2worker' && worker) {
        const byBook = new Map<string, { start: number; end: number }[]>();
        for (const p of r.passages as { bookId: string; charStart: number; charEnd: number }[]) {
          const a = byBook.get(p.bookId) ?? []; a.push({ start: p.charStart, end: p.charEnd }); byBook.set(p.bookId, a);
        }
        const id = ++jobSeq;
        const tw = hr();
        await new Promise<void>((resolve) => { pending.set(id, resolve); worker!.postMessage({ type: 'job', id, books: [...byBook].map(([b, ranges]) => ({ key: keyOf.get(b), ranges })) }); });
        rec('s2worker:job(wall)', msSince(tw));
      }
      return r;
    } finally { rec('retrieval:retrieve(wall)', msSince(t0)); }
  };
  for (const [cls, names] of [[AiGatewayService, ['prepare', 'invoke']], [TurnService, ['run']]] as const) {
    for (const name of names) {
      const orig = cls.prototype[name];
      cls.prototype[name] = async function (this: unknown, ...args: unknown[]) {
        const t0 = hr();
        try { return await orig.apply(this, args); } finally { rec(`${cls.name}.${name}(wall)`, msSince(t0)); }
      };
    }
  }
  const origQuery = pg.Client.prototype.query;
  pg.Client.prototype.query = function (this: unknown, config: any, values?: any, cb?: any) {
    const t0 = hr();
    const cat = `db:${sqlCategory(typeof config === 'string' ? config : config?.text)}`;
    const done = () => rec(cat, msSince(t0));
    if (typeof values === 'function') return origQuery.call(this, config, (e: unknown, r: unknown) => { done(); values(e, r); });
    if (typeof cb === 'function') return origQuery.call(this, config, values, (e: unknown, r: unknown) => { done(); cb(e, r); });
    const out = origQuery.call(this, config, values);
    if (out && typeof out.then === 'function') out.then(done, done);
    return out;
  };

  // ── event loop, CPU, GC timelines ─────────────────────────────────────────────────────────────────────────────
  const eld = monitorEventLoopDelay({ resolution: 10 });
  eld.enable();
  const stalls: { t: number; ms: number }[] = [];
  const throttles: { t: number; usec: number; periods: number }[] = [];
  const gcs: { t: number; ms: number; kind: number }[] = [];
  const timeline: Record<string, number | null>[] = [];
  const s2q = { n: 0, sum: 0, max: 0 };
  let s2base = processS2Verifier().stats();
  let threadBase = threadCpu();
  let expected = Date.now() + 10;
  const drift = setInterval(() => {
    const now = Date.now();
    const late = now - expected;
    if (late >= 30 && stalls.length < 50_000) stalls.push({ t: expected, ms: late });
    const q = processS2Verifier().stats().queueDepth;
    s2q.n++; s2q.sum += q; if (q > s2q.max) s2q.max = q;
    expected = now + 10;
  }, 10);
  drift.unref();
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (gcs.length < 100_000) gcs.push({ t: Math.round(performance.timeOrigin + e.startTime), ms: e.duration, kind: (e as any).detail?.kind ?? (e as any).kind ?? 0 });
  });
  obs.observe({ entryTypes: ['gc'] });
  let lastCg = cgroupCpu();
  let lastFine = cgroupCpu();
  let lastElu = performance.eventLoopUtilization();
  let lastCpu = process.cpuUsage();
  const fine = setInterval(() => {
    const c = cgroupCpu();
    if (c && lastFine && c.nrThrottled > lastFine.nrThrottled && throttles.length < 100_000) throttles.push({ t: Date.now(), usec: c.throttledUsec - lastFine.throttledUsec, periods: c.nrThrottled - lastFine.nrThrottled });
    lastFine = c;
  }, 100);
  fine.unref();
  const coarse = setInterval(() => {
    const c = cgroupCpu();
    const elu = performance.eventLoopUtilization(lastElu);
    lastElu = performance.eventLoopUtilization();
    const cpu = process.cpuUsage(lastCpu);
    lastCpu = process.cpuUsage();
    const m = process.memoryUsage();
    timeline.push({
      t: Date.now(), elu: round(elu.utilization), procCpuPct: round((cpu.user + cpu.system) / 1e4),
      cgCpuPct: c && lastCg ? round((c.usage - lastCg.usage) / 1e4) : null,
      throttledPeriods: c && lastCg ? c.nrThrottled - lastCg.nrThrottled : null, throttledMs: c && lastCg ? round((c.throttledUsec - lastCg.throttledUsec) / 1000) : null,
      rssMb: round(m.rss / 1048576), heapMb: round(m.heapUsed / 1048576), extMb: round((m.external + m.arrayBuffers) / 1048576),
    });
    lastCg = c;
  }, 1000);
  coarse.unref();

  // ── CPU profiler ──────────────────────────────────────────────────────────────────────────────────────────────
  const session = new Session();
  session.connect();
  const post = (method: string, params?: object) => new Promise<any>((res, rej) => session.post(method, params ?? {}, (e, r) => (e ? rej(e) : res(r))));
  function summarizeProfile(p: any) {
    const nodes = new Map<number, any>();
    const parent = new Map<number, number>();
    for (const n of p.nodes) { nodes.set(n.id, n); for (const c of n.children ?? []) parent.set(c, n.id); }
    const fname = (n: any) => { const cf = n.callFrame; const file = (cf.url || '').replace(/^.*\/(node_modules\/(?:@[^/]+\/)?[^/]+|out\/[^?]+)$/, '$1').replace(/^file:\/\//, ''); return `${cf.functionName || '(anonymous)'} ${file ? `${file.split('/').slice(-2).join('/')}:${cf.lineNumber + 1}` : ''}`.trim(); };
    const category = (n: any) => {
      const u: string = n.callFrame.url || '';
      const f: string = n.callFrame.functionName || '';
      if (f === '(idle)') return 'idle';
      if (f === '(garbage collector)') return 'gc';
      if (f === '(program)') return 'program (native/unattributed)';
      if (/src\/knowledge\/retrieval|rights\/text-hash/.test(u)) return 'app: retrieval (E5)';
      if (/src\/knowledge\/ai/.test(u)) return 'app: gateway + simulator';
      if (/src\/knowledge/.test(u)) return 'app: knowledge (sessions, metering, rights)';
      if (/src\//.test(u)) return 'app: other (books, auth, …)';
      if (/tests\/perf/.test(u)) return 'harness';
      if (/node_modules\/(@aws-sdk|@smithy)/.test(u)) return 'lib: aws-sdk (MinIO)';
      if (/node_modules\/(pg|pg-[a-z-]+|postgres-[a-z-]+)\//.test(u)) return 'lib: pg driver';
      if (/node_modules\/typeorm/.test(u)) return 'lib: typeorm';
      if (/node_modules\/(@nestjs|express|body-parser|router|passport|jsonwebtoken|jws|class-validator|class-transformer|rxjs|reflect-metadata)/.test(u)) return 'lib: nest/express/auth';
      if (/node_modules\/(ioredis|redis)/.test(u)) return 'lib: redis';
      if (/node_modules/.test(u)) return 'lib: other';
      if (/^node:internal\/crypto/.test(u)) return 'node: crypto';
      if (/^node:internal\/encoding|^node:internal\/util\/types/.test(u)) return 'node: TextDecoder';
      if (/^node:/.test(u)) return 'node: other internals';
      if (f === 'stringify' || f === 'parse') return `native: JSON.${f}`;
      return f ? `native: ${f}` : 'native: other';
    };
    const self = new Map<number, number>();
    const total = p.timeDeltas.reduce((a: number, b: number) => a + b, 0) / 1000;
    p.samples.forEach((id: number, i: number) => self.set(id, (self.get(id) ?? 0) + (p.timeDeltas[i] ?? 0) / 1000));
    const byFn = new Map<string, number>();
    const byCat = new Map<string, number>();
    for (const [id, ms] of self) { const n = nodes.get(id); byFn.set(fname(n), (byFn.get(fname(n)) ?? 0) + ms); byCat.set(category(n), (byCat.get(category(n)) ?? 0) + ms); }
    // inclusive time of key frames (synchronous occupancy only — exactly what blocks the event loop)
    const KEYS: [string, RegExp][] = [
      ['retrieve (E5 retrieval, sync part)', /^retrieve .*lexical-retrieval/],
      ['computeTextHash (SHA-256)', /^computeTextHash|^(digest|update) .*crypto\/hash/],
      ['decodeUtf8 (TextDecoder)', /^decodeUtf8|^decode .*encoding/],
      ['sliceCodePointRanges', /^sliceCodePointRanges/],
      ['getBytes / aws-sdk stream', /^getBytes .*storage\.service|node_modules\/@(aws-sdk|smithy)/],
      ['Buffer.concat', /^concat .*buffer/],
      ['JSON.stringify', /^stringify/],
      ['JSON.parse', /^parse $/],
      ['pg driver (incl. row parsing)', /node_modules\/(pg|pg-protocol|pg-types|postgres-[a-z-]+)\//],
      ['typeorm', /node_modules\/typeorm/],
      ['getSyncMap (reader)', /^getSyncMap /],
      ['gateway (AiGatewayService + simulator)', /ai-gateway\.service|simulator-v2|structured-output|citation-policy|attempt-normalizer/],
      ['turn.service', /turn\.service/],
      ['garbage collector', /^\(garbage collector\)/],
    ];
    const incl = new Map<string, number>(KEYS.map(([k]) => [k, 0]));
    p.samples.forEach((leaf: number, i: number) => {
      const ms = (p.timeDeltas[i] ?? 0) / 1000;
      const hit = new Set<string>();
      for (let id: number | undefined = leaf; id !== undefined; id = parent.get(id)) {
        const s = fname(nodes.get(id));
        for (const [k, re] of KEYS) if (!hit.has(k) && re.test(s)) hit.add(k);
      }
      for (const k of hit) incl.set(k, incl.get(k)! + ms);
    });
    const top = [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([fn, ms]) => ({ fn, ms: round(ms), pct: round((100 * ms) / total) }));
    return {
      wallMs: round(total), samples: p.samples.length,
      byCategory: [...byCat].sort((a, b) => b[1] - a[1]).map(([c, ms]) => ({ category: c, ms: round(ms), pct: round((100 * ms) / total) })),
      inclusive: [...incl].map(([k, ms]) => ({ frame: k, ms: round(ms), pct: round((100 * ms) / total) })),
      topSelf: top,
    };
  }

  const snapshot = () => ({
    mode,
    timers: Object.fromEntries([...timers].sort().map(([k, v]) => [k, stat(v)])),
    eventLoop: { delayMs: { p50: round(eld.percentile(50) / 1e6), p95: round(eld.percentile(95) / 1e6), p99: round(eld.percentile(99) / 1e6), max: round(eld.max / 1e6) }, stallsGe30ms: stalls.length, stallsGe100ms: stalls.filter((s) => s.ms >= 100).length, stallMs: stat(stalls.map((s) => s.ms)) },
    gc: { n: gcs.length, ms: stat(gcs.map((g) => g.ms)), byKind: Object.fromEntries([...new Set(gcs.map((g) => g.kind))].map((k) => [k, stat(gcs.filter((g) => g.kind === k).map((g) => g.ms))])) },
    throttling: { windows100ms: throttles.length, periods: throttles.reduce((a, t) => a + t.periods, 0), throttledMs: round(throttles.reduce((a, t) => a + t.usec, 0) / 1000) },
    timeline: summarizeTimeline(),
    s2pool: s2Delta(),
    threads: threadDelta(),
  });
  const s2Delta = () => {
    const now = processS2Verifier().stats();
    const d = (k: string) => (now as any)[k] - (s2base as any)[k];
    const unavailable = Object.fromEntries(Object.keys(now.unavailable).map((k) => [k, (now.unavailable as any)[k] - (s2base.unavailable as any)[k]]));
    const workerDown = Object.fromEntries(Object.keys(now.workerDown).map((k) => [k, (now.workerDown as any)[k] - (s2base.workerDown as any)[k]]));
    const done = d('ok') + d('stale') + Object.values(unavailable).reduce((a: number, b: any) => a + b, 0);
    const dispatched = d('transferred') + d('copied');
    return {
      submitted: d('submitted'), ok: d('ok'), stale: d('stale'), unavailable, workerDown, spawns: d('spawns'), settled: done,
      transferred: d('transferred'), copied: d('copied'), copiedMb: round(d('copiedBytes') / 1048576),
      queueDepth: { max: s2q.max, meanSampled: round(s2q.n ? s2q.sum / s2q.n : 0) },
      waitMs: { total: round(d('waitMsTotal')), mean: round(dispatched ? d('waitMsTotal') / dispatched : 0), maxEver: round(now.waitMsMax) },
      workerBusyMs: { total: round(d('execMsTotal')), mean: round(d('ok') + d('stale') ? d('execMsTotal') / (d('ok') + d('stale') + unavailable.invalid_utf8 + unavailable.worker_error) : 0), maxEver: round(now.execMsMax) },
    };
  };
  const threadDelta = () => {
    const now = threadCpu();
    return [...now].map(([tid, v]) => ({ tid: Number(tid), comm: v.comm, cpuMs: v.ms - (threadBase.get(tid)?.ms ?? 0) }))
      .filter((t) => t.cpuMs > 0).sort((a, b) => b.cpuMs - a.cpuMs).slice(0, 8);
  };
  const summarizeTimeline = () => {
    const col = (k: string) => timeline.map((r) => r[k]).filter((x): x is number => typeof x === 'number');
    return { seconds: timeline.length, elu: stat(col('elu')), cgCpuPct: stat(col('cgCpuPct')), throttledMsPerS: stat(col('throttledMs')), rssMb: stat(col('rssMb')), heapMb: stat(col('heapMb')), extMb: stat(col('extMb')) };
  };
  const reset = () => { timers.clear(); stalls.length = 0; throttles.length = 0; gcs.length = 0; timeline.length = 0; eld.reset(); s2base = processS2Verifier().stats(); threadBase = threadCpu(); s2q.n = 0; s2q.sum = 0; s2q.max = 0; };

  async function setMode(m: Mode) {
    mode = m;
    hashMemo.clear(); sliceMemo.clear(); bytesCache.clear();
    if (m === 's2worker' && !worker) {
      worker = new Worker(WORKER_SRC, { eval: true });
      worker.on('message', (msg: { type: string; id: number }) => { if (msg.type === 'done') { pending.get(msg.id)?.(); pending.delete(msg.id); } });
      const storage = ref.get(StorageService, { strict: false });
      for (const key of new Set(keyOf.values())) { const b: Buffer = await origGetBytes.call(storage, key, 'books'); worker.postMessage({ type: 'load', key, bytes: b }); }
    }
    if (m !== 's2worker' && worker) { await worker.terminate(); worker = null; }
  }

  async function bench(n: number) {
    const storage = ref.get(StorageService, { strict: false });
    const out: Record<string, number[]> = { getBytesMs: [], sha256Ms: [], decodeMs: [], altIsUtf8PlusToStringMs: [], altToStringOnlyMs: [], altByteScanSlice8Ms: [], slice8Ms: [], sliceEndMs: [], stringifyTurnMs: [], bytes: [] };
    let altIdentical = true;
    for (let i = 0; i < n; i++) {
      for (const key of new Set(keyOf.values())) {
        let t0 = hr(); const b: Buffer = await origGetBytes.call(storage, key, 'books'); out.getBytesMs.push(msSince(t0)); out.bytes.push(b.byteLength);
        t0 = hr(); origHash(b); out.sha256Ms.push(msSince(t0));
        t0 = hr(); const text: string = origDecode(b); out.decodeMs.push(msSince(t0));
        // Candidate equivalent (validate-then-decode): fatal semantics via buffer.isUtf8, BOM kept like ignoreBOM:true.
        t0 = hr(); const ok = isUtf8(b); const alt = ok ? b.toString('utf8') : null; out.altIsUtf8PlusToStringMs.push(msSince(t0));
        t0 = hr(); b.toString('utf8'); out.altToStringOnlyMs.push(msSince(t0));
        if (alt !== text) altIdentical = false;
        const len = 2_000_000; // NEM-023 fixture: every book is exactly 2,000,000 code points
        const ranges = Array.from({ length: 8 }, (_, k) => { const s = Math.floor(((k + 0.5) / 8) * (len - 2000)); return { start: s, end: s + 1500 }; });
        t0 = hr(); const sl = origSlice(text, ranges); out.slice8Ms.push(msSince(t0));
        // Candidate "no full decode": validate the whole object (fatal semantics), map code-point offsets to byte offsets
        // by counting non-continuation bytes, decode only the passages. Must equal the production slices exactly.
        t0 = hr(); const alt8 = isUtf8(b) ? byteScanSlices(b, ranges) : null; out.altByteScanSlice8Ms.push(msSince(t0));
        if (JSON.stringify(alt8) !== JSON.stringify(sl)) altIdentical = false;
        t0 = hr(); origSlice(text, [{ start: len - 1600, end: len - 100 }]); out.sliceEndMs.push(msSince(t0));
        t0 = hr(); JSON.stringify({ segments: sl.map((s: string | null, k: number) => ({ text: s, citations: [{ ref: `c${k}`, anchor: `sha256:${'0'.repeat(64)}:${k}-${k + 1500}` }] })) }); out.stringifyTurnMs.push(msSince(t0));
      }
    }
    const crossCheck = createHash('sha256').update('x').digest('hex').length === 64;
    return { n, books: keyOf.size, crossCheck, altIdentical, ...Object.fromEntries(Object.entries(out).map(([k, v]) => [k, stat(v)])) };
  }

  return {
    keyOf,
    async handle(path: string, q: URLSearchParams): Promise<unknown | undefined> {
      if (path === '/diag/reset') { reset(); return { ok: true }; }
      if (path === '/diag/snapshot') return snapshot();
      if (path === '/diag/events') return { stalls, throttles, gcs, timeline };
      if (path === '/diag/mode') { await setMode((q.get('m') ?? 'none') as Mode); return { mode }; }
      if (path === '/diag/bench') return bench(Number(q.get('n') ?? 5));
      if (path === '/diag/prof/start') { await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: Number(q.get('us') ?? 1000) }); await post('Profiler.start'); return { profiling: true }; }
      if (path === '/diag/prof/stop') {
        const { profile } = await post('Profiler.stop');
        const file = q.get('file');
        if (file && /^[a-zA-Z0-9_.-]+$/.test(file)) writeFileSync(`/prof/${file}`, JSON.stringify(profile));
        return summarizeProfile(profile);
      }
      return undefined;
    },
  };
}
