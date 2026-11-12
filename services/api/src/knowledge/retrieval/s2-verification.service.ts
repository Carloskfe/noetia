import { Worker } from 'worker_threads';
import { S2_WORKER_FILE, S2_WORKER_ROLE, S2Job, S2Range } from './s2-worker';

/**
 * PO-045 (Option D) — one bounded S2 worker thread per API process.
 *
 * The main thread keeps the storage read; this pool moves SHA-256 verification, whole-object UTF-8 validation and
 * passage slicing to ONE reusable worker. Every call resolves (never rejects, never hangs) with exactly one outcome:
 *
 *   ok           — hash matched, object is valid UTF-8, passages sliced (null for malformed offsets, as before)
 *   stale        — hash mismatch
 *   unavailable  — invalid UTF-8, worker error, timeout, crash, queue saturation, cool-down, or shutdown
 *
 * Bounds (engineering defaults, `DEFAULT_S2_POOL_OPTIONS`):
 * - one job executes at a time; at most `queueCapacity` jobs wait; a submission beyond that fails at once (`saturated`);
 * - a queued job waits at most `queueWaitTimeoutMs` (this also bounds worker start-up as seen by the job);
 * - a running job gets `jobTimeoutMs`; on expiry the worker is terminated (synchronous work cannot be interrupted)
 *   and the job fails `timeout`;
 * - a worker that does not report ready within `startupTimeoutMs` is terminated;
 * - after a crash/timeout the next worker is started lazily, only when a job is waiting (no retry loop). After
 *   `maxConsecutiveFailures` failures without a success, the pool cools down for `cooldownMs`: everything queued
 *   and every new submission fails `unavailable` without spawning.
 * A job that was running when its worker died is failed, never re-run. Queued jobs, which never started, are kept for
 * the next worker, each still bounded by its own wait deadline.
 *
 * There is NO in-process fallback: the full-book work never runs on the event loop. Nothing is cached between jobs.
 * Counters only — no text, hash, key or identifier — are kept for diagnostics (`stats()`).
 */

export type S2FailReason = 'invalid_utf8' | 'worker_error' | 'bad_reply' | 'timeout' | 'crashed' | 'saturated' | 'queue_timeout' | 'cooling_down' | 'shutdown';

/** Why a worker was discarded. */
export type S2WorkerDownReason = 'crashed' | 'timeout' | 'startup_failed';

export type S2Outcome = { kind: 'ok'; passages: (string | null)[] } | { kind: 'stale' } | { kind: 'unavailable'; reason: S2FailReason };

export interface S2Verifier {
  verify(bytes: Uint8Array, expectedHash: string, ranges: readonly S2Range[]): Promise<S2Outcome>;
  shutdown(): Promise<void>;
}

/** The subset of `worker_threads.Worker` the pool uses (tests inject scripted workers). */
export interface S2WorkerLike {
  on(event: 'message', fn: (m: unknown) => void): unknown;
  on(event: 'error', fn: (e: unknown) => void): unknown;
  on(event: 'exit', fn: (code: number) => void): unknown;
  postMessage(value: unknown, transferList?: readonly ArrayBuffer[]): void;
  terminate(): Promise<number>;
  ref(): void;
  unref(): void;
}

export interface S2PoolOptions {
  queueCapacity: number;
  jobTimeoutMs: number;
  queueWaitTimeoutMs: number;
  startupTimeoutMs: number;
  maxConsecutiveFailures: number;
  cooldownMs: number;
  spawn: () => S2WorkerLike;
  now: () => number;
}

/** Old-generation heap cap for the worker isolate (book bytes are external ArrayBuffer memory, not heap). */
export const S2_WORKER_MAX_OLD_GENERATION_MB = 128;

/**
 * Starts the real worker. From compiled JavaScript (production build, perf harness) the emitted `s2-worker.js` runs
 * directly. From TypeScript sources (jest, ts-node scripts) it is loaded through ts-node's transpile-only register,
 * which is a development dependency and is never reached from `dist/`.
 */
export function spawnS2Worker(): S2WorkerLike {
  const opts = { workerData: { role: S2_WORKER_ROLE }, resourceLimits: { maxOldGenerationSizeMb: S2_WORKER_MAX_OLD_GENERATION_MB } };
  if (S2_WORKER_FILE.endsWith('.ts')) {
    return new Worker(`require('ts-node').register({ transpileOnly: true }); require(${JSON.stringify(S2_WORKER_FILE)});`, { ...opts, eval: true });
  }
  return new Worker(S2_WORKER_FILE, opts);
}

export const DEFAULT_S2_POOL_OPTIONS: Readonly<S2PoolOptions> = Object.freeze({
  queueCapacity: 32, // ≥ 3 × the 10 books one W=10 admission can put in flight
  jobTimeoutMs: 2_000, // one 2 MB book takes ~5–10 ms unloaded; generous for CFS throttling on 1 vCPU
  queueWaitTimeoutMs: 5_000,
  startupTimeoutMs: 5_000,
  maxConsecutiveFailures: 3,
  cooldownMs: 5_000,
  spawn: spawnS2Worker,
  now: () => Date.now(),
});

/**
 * Bytes known to be exclusively owned by the caller (a fresh, unpooled buffer created for this read) may be TRANSFERRED
 * to the worker without a copy. Only the runtime S2 adapter marks its buffers; anything else — pooled `Buffer` slices,
 * caller-retained or reused buffers — is copied first, so no shared buffer is ever detached.
 */
const owned = new WeakSet<ArrayBuffer>();
export function markOwnedBytes(bytes: Uint8Array): void {
  const buf = bytes.buffer;
  if (buf instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === buf.byteLength && buf.byteLength > 0) owned.add(buf);
}

interface Pending {
  id: number;
  bytes: Uint8Array;
  expectedHash: string;
  ranges: S2Range[];
  enqueuedAt: number;
  resolve: (o: S2Outcome) => void;
  timer?: ReturnType<typeof setTimeout>;
}

interface Current {
  gen: number;
  worker: S2WorkerLike;
  ready: boolean;
  running: Pending | null;
  timer?: ReturnType<typeof setTimeout>;
}

export interface S2PoolStats {
  submitted: number;
  ok: number;
  stale: number;
  unavailable: Record<S2FailReason, number>;
  spawns: number;
  workerDown: Record<S2WorkerDownReason, number>;
  transferred: number;
  copied: number;
  copiedBytes: number;
  queueDepth: number;
  maxQueueDepth: number;
  waitMsTotal: number;
  waitMsMax: number;
  execMsTotal: number;
  execMsMax: number;
}

const zeroReasons = (): Record<S2FailReason, number> => ({
  invalid_utf8: 0, worker_error: 0, bad_reply: 0, timeout: 0, crashed: 0, saturated: 0, queue_timeout: 0, cooling_down: 0, shutdown: 0,
});

export class S2VerificationPool implements S2Verifier {
  private readonly o: S2PoolOptions;
  private readonly queue: Pending[] = [];
  private cur: Current | null = null;
  private gen = 0;
  private nextId = 1;
  private failures = 0;
  private coolUntil = 0;
  private readonly s: S2PoolStats = {
    submitted: 0, ok: 0, stale: 0, unavailable: zeroReasons(), spawns: 0, workerDown: { crashed: 0, timeout: 0, startup_failed: 0 }, transferred: 0, copied: 0, copiedBytes: 0,
    queueDepth: 0, maxQueueDepth: 0, waitMsTotal: 0, waitMsMax: 0, execMsTotal: 0, execMsMax: 0,
  };

  constructor(options: Partial<S2PoolOptions> = {}) {
    this.o = { ...DEFAULT_S2_POOL_OPTIONS, ...options };
  }

  verify(bytes: Uint8Array, expectedHash: string, ranges: readonly S2Range[]): Promise<S2Outcome> {
    this.s.submitted++;
    if (this.o.now() < this.coolUntil) return Promise.resolve(this.fail('cooling_down'));
    if (this.queue.length >= this.o.queueCapacity) return Promise.resolve(this.fail('saturated'));
    return new Promise<S2Outcome>((resolve) => {
      const job: Pending = {
        id: this.nextId++, bytes, expectedHash, ranges: ranges.map((r) => ({ start: r.start, end: r.end })), enqueuedAt: this.o.now(), resolve,
      };
      job.timer = setTimeout(() => this.expireQueued(job), this.o.queueWaitTimeoutMs);
      job.timer.unref?.();
      this.queue.push(job);
      this.s.maxQueueDepth = Math.max(this.s.maxQueueDepth, this.queue.length);
      this.pump();
    });
  }

  /** Terminates the worker and fails every running or queued job (`shutdown`). A later `verify` starts a new worker. */
  async shutdown(): Promise<void> {
    const cur = this.cur;
    this.cur = null;
    this.gen++;
    if (cur) {
      if (cur.timer) clearTimeout(cur.timer);
      if (cur.running) this.settle(cur.running, this.fail('shutdown'));
    }
    for (const j of this.queue.splice(0)) this.settle(j, this.fail('shutdown'));
    this.failures = 0;
    this.coolUntil = 0;
    if (cur) await cur.worker.terminate().catch(() => undefined);
  }

  stats(): S2PoolStats {
    return { ...this.s, unavailable: { ...this.s.unavailable }, workerDown: { ...this.s.workerDown }, queueDepth: this.queue.length };
  }

  private fail(reason: S2FailReason): S2Outcome {
    this.s.unavailable[reason]++;
    return { kind: 'unavailable', reason };
  }

  private settle(job: Pending, outcome: S2Outcome): void {
    if (job.timer) clearTimeout(job.timer);
    job.timer = undefined;
    job.bytes = new Uint8Array(0); // drop the reference to the book bytes as soon as the job is done
    job.resolve(outcome);
  }

  private expireQueued(job: Pending): void {
    const i = this.queue.indexOf(job);
    if (i < 0) return; // already dispatched; the execution timer governs it now
    this.queue.splice(i, 1);
    this.settle(job, this.fail('queue_timeout'));
    this.pump();
  }

  private pump(): void {
    if (this.o.now() < this.coolUntil) {
      for (const j of this.queue.splice(0)) this.settle(j, this.fail('cooling_down'));
    }
    if (this.queue.length > 0 && !this.cur) this.start();
    const cur = this.cur;
    if (cur && cur.ready && !cur.running && this.queue.length > 0) this.dispatch(cur, this.queue.shift()!);
    if (this.cur) (this.cur.running || this.queue.length > 0 ? this.cur.worker.ref() : this.cur.worker.unref());
  }

  private start(): void {
    const gen = ++this.gen;
    let worker: S2WorkerLike;
    try {
      worker = this.o.spawn();
    } catch {
      this.down(gen, 'startup_failed', null);
      return;
    }
    this.s.spawns++;
    const cur: Current = { gen, worker, ready: false, running: null };
    this.cur = cur;
    worker.on('message', (m) => this.onMessage(gen, m));
    worker.on('error', () => this.down(gen, cur.ready ? 'crashed' : 'startup_failed', worker));
    worker.on('exit', () => this.down(gen, cur.ready ? 'crashed' : 'startup_failed', null));
    cur.timer = setTimeout(() => this.down(gen, 'startup_failed', worker), this.o.startupTimeoutMs);
    cur.timer.unref?.();
  }

  private dispatch(cur: Current, job: Pending): void {
    if (job.timer) clearTimeout(job.timer);
    const wait = this.o.now() - job.enqueuedAt;
    this.s.waitMsTotal += wait;
    this.s.waitMsMax = Math.max(this.s.waitMsMax, wait);
    let bytes = job.bytes;
    const buf = bytes.buffer;
    if (buf instanceof ArrayBuffer && owned.has(buf) && bytes.byteOffset === 0 && bytes.byteLength === buf.byteLength) {
      owned.delete(buf);
      this.s.transferred++;
    } else {
      bytes = new Uint8Array(bytes); // private copy: the caller's buffer is never detached or shared with the worker
      this.s.copied++;
      this.s.copiedBytes += bytes.byteLength;
    }
    job.bytes = new Uint8Array(0);
    cur.running = job;
    job.timer = setTimeout(() => this.down(cur.gen, 'timeout', cur.worker), this.o.jobTimeoutMs);
    job.timer.unref?.();
    const msg: S2Job = { id: job.id, bytes, expectedHash: job.expectedHash, ranges: job.ranges };
    try {
      cur.worker.postMessage(msg, [bytes.buffer as ArrayBuffer]);
    } catch {
      this.down(cur.gen, 'crashed', cur.worker);
    }
  }

  private onMessage(gen: number, m: unknown): void {
    const cur = this.cur;
    if (!cur || cur.gen !== gen) return;
    const r = m as { id?: unknown; kind?: string; execMs?: unknown; passages?: unknown } | null;
    if (r && r.kind === 'ready' && !cur.ready) {
      cur.ready = true;
      if (cur.timer) clearTimeout(cur.timer);
      cur.timer = undefined;
      this.pump();
      return;
    }
    const job = cur.running;
    if (!job || !r || r.id !== job.id) return; // unsolicited or late message: ignored
    cur.running = null;
    if (typeof r.execMs === 'number' && Number.isFinite(r.execMs)) {
      this.s.execMsTotal += r.execMs;
      this.s.execMsMax = Math.max(this.s.execMsMax, r.execMs);
    }
    this.failures = 0;
    this.settle(job, this.toOutcome(r, job.ranges.length));
    this.pump();
  }

  private toOutcome(r: { kind?: string; passages?: unknown }, n: number): S2Outcome {
    if (r.kind === 'stale') {
      this.s.stale++;
      return { kind: 'stale' };
    }
    if (r.kind === 'invalid_utf8') return this.fail('invalid_utf8');
    if (r.kind === 'error') return this.fail('worker_error');
    const p = r.passages;
    if (r.kind === 'ok' && Array.isArray(p) && p.length === n && p.every((x) => x === null || typeof x === 'string')) {
      this.s.ok++;
      return { kind: 'ok', passages: p as (string | null)[] };
    }
    return this.fail('bad_reply');
  }

  /** The worker of generation `gen` is gone or must go. Idempotent per generation; stale events are ignored. */
  private down(gen: number, reason: S2WorkerDownReason, terminate: S2WorkerLike | null): void {
    if (terminate) terminate.terminate().catch(() => undefined);
    if (gen !== this.gen) return;
    const cur = this.cur;
    if (cur && cur.gen !== gen) return;
    this.cur = null;
    this.gen++; // late events from the old worker no longer match
    if (cur?.timer) clearTimeout(cur.timer);
    this.s.workerDown[reason]++;
    // A job runs only on a ready worker, so a running job here was lost to a crash or its own timeout.
    if (cur?.running) this.settle(cur.running, this.fail(reason === 'timeout' ? 'timeout' : 'crashed'));
    if (++this.failures >= this.o.maxConsecutiveFailures) {
      this.failures = 0;
      this.coolUntil = this.o.now() + this.o.cooldownMs;
    }
    this.pump();
  }
}

let processPool: S2VerificationPool | null = null;

/** The single S2 worker pool of this process (created on first use; the worker itself starts on the first job). */
export function processS2Verifier(): S2VerificationPool {
  if (!processPool) processPool = new S2VerificationPool();
  return processPool;
}
