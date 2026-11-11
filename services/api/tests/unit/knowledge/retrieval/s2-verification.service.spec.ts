import { Worker } from 'worker_threads';
import { sliceCodePointRanges } from '../../../../src/knowledge/retrieval/chunker';
import { decodeUtf8 } from '../../../../src/knowledge/retrieval/retrieval.types';
import {
  DEFAULT_S2_POOL_OPTIONS,
  markOwnedBytes,
  processS2Verifier,
  S2Outcome,
  S2PoolOptions,
  S2VerificationPool,
  S2WorkerLike,
  spawnS2Worker,
} from '../../../../src/knowledge/retrieval/s2-verification.service';
import { StorageBookText } from '../../../../src/knowledge/retrieval/storage-book-text';
import { computeTextHash } from '../../../../src/knowledge/rights/text-hash';

/**
 * PO-045 §3.3 / §6.1 — one bounded S2 worker: initialization, completion, shutdown, bounded queue, timeout, crash,
 * respawn, cool-down, no unresolved promise, no unverified text, no reuse of detached or shared buffers.
 *
 * Lifecycle tests use REAL worker threads running a small scripted worker (eval) whose behaviour is chosen per job
 * through `expectedHash` (`ok`, `stale`, `crash`, `throw`, `hang`, `slow:<ms>`, `bad`, `late`) and per worker through
 * `workerData.mode` (`noready`, `boom`). The production entry point is covered by the "real worker" tests.
 */
const SCRIPT = `
const { parentPort, workerData } = require('worker_threads');
if (workerData.mode === 'boom') throw new Error('boom');
parentPort.on('message', (j) => {
  const [cmd, arg] = String(j.expectedHash).split(':');
  if (cmd === 'crash') process.exit(3);
  if (cmd === 'throw') throw new Error('x');
  if (cmd === 'hang') { for (;;) {} }
  if (cmd === 'slow') { const t = Date.now() + Number(arg); while (Date.now() < t) {} }
  if (cmd === 'bad') return parentPort.postMessage({ id: j.id, kind: 'ok', passages: [1] });
  if (cmd === 'late') parentPort.postMessage({ id: j.id + 1000, kind: 'stale', execMs: 1 });
  if (cmd === 'stale') return parentPort.postMessage({ id: j.id, kind: 'stale', execMs: 1 });
  if (cmd === 'invalid') return parentPort.postMessage({ id: j.id, kind: 'invalid_utf8', execMs: 1 });
  if (cmd === 'error') return parentPort.postMessage({ id: j.id, kind: 'error', execMs: 1 });
  parentPort.postMessage({ id: j.id, kind: 'ok', passages: j.ranges.map(() => 'len' + j.bytes.byteLength), execMs: 2 });
});
if (workerData.mode !== 'noready') parentPort.postMessage({ kind: 'ready' });
`;
const scripted = (mode = '') => () => new Worker(SCRIPT, { eval: true, workerData: { mode } }) as unknown as S2WorkerLike;
const pools: S2VerificationPool[] = [];
const pool = (o: Partial<S2PoolOptions> = {}) => {
  const p = new S2VerificationPool({ spawn: scripted(), jobTimeoutMs: 1_000, queueWaitTimeoutMs: 4_000, startupTimeoutMs: 4_000, ...o });
  pools.push(p);
  return p;
};
// Bounds in the hang/respawn tests tolerate the development VM's multi-second host stalls (report §11); normal runs take ~1 s.
jest.setTimeout(150_000);
afterEach(async () => { await Promise.all(pools.splice(0).map((p) => p.shutdown())); });
const fresh = (n = 8) => new Uint8Array(new ArrayBuffer(n));
const R = [{ start: 0, end: 1 }];
const unavailable = (reason: string): S2Outcome => ({ kind: 'unavailable', reason } as S2Outcome);
/** Waits on observable pool state instead of wall-clock sleeps (robust on a loaded host). */
async function until(cond: () => boolean, ms = 10_000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('condition not reached');
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('S2VerificationPool — lifecycle (PO-045 §3.3)', () => {
  it('starts ONE worker lazily on the first job, reuses it, and completes jobs in order', async () => {
    const spawn = jest.fn(scripted());
    const p = pool({ spawn });
    expect(spawn).not.toHaveBeenCalled();
    const out = await Promise.all([1, 2, 3, 4, 5].map((i) => p.verify(fresh(i), 'ok', [{ start: 0, end: 1 }, { start: 1, end: 2 }])));
    expect(out).toEqual([1, 2, 3, 4, 5].map((i) => ({ kind: 'ok', passages: [`len${i}`, `len${i}`] })));
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(await p.verify(fresh(), 'stale', R)).toEqual({ kind: 'stale' });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(p.stats()).toMatchObject({ submitted: 6, ok: 5, stale: 1, spawns: 1, queueDepth: 0, execMsTotal: 11 });
    expect(p.stats().maxQueueDepth).toBeGreaterThanOrEqual(1);
  });

  it('maps worker outcomes: invalid_utf8 / error / malformed reply → unavailable (never text)', async () => {
    const p = pool();
    expect(await p.verify(fresh(), 'invalid', R)).toEqual(unavailable('invalid_utf8'));
    expect(await p.verify(fresh(), 'error', R)).toEqual(unavailable('worker_error'));
    expect(await p.verify(fresh(), 'bad', R)).toEqual(unavailable('bad_reply'));
    expect(await p.verify(fresh(), 'ok', R)).toEqual({ kind: 'ok', passages: ['len8'] });
  });

  it('ignores unsolicited or late replies (wrong id) and still resolves the job with its own reply', async () => {
    const p = pool();
    expect(await p.verify(fresh(), 'late', R)).toEqual({ kind: 'ok', passages: ['len8'] });
  });

  it('bounded queue: a submission beyond capacity fails at once as unavailable (saturated); accepted jobs complete', async () => {
    const p = pool({ queueCapacity: 2 });
    const first = p.verify(fresh(), 'slow:150', R); // dispatched once the worker is ready; until then it is queued
    const second = p.verify(fresh(), 'ok', R);
    const third = await p.verify(fresh(), 'ok', R); // queue holds 2 → rejected without waiting
    expect(third).toEqual(unavailable('saturated'));
    expect(await first).toEqual({ kind: 'ok', passages: ['len8'] });
    expect(await second).toEqual({ kind: 'ok', passages: ['len8'] });
    expect(p.stats().unavailable.saturated).toBe(1);
  });

  it('queue wait is bounded: a job that cannot be dispatched in time fails as unavailable (queue_timeout)', async () => {
    const p = pool({ queueWaitTimeoutMs: 100, jobTimeoutMs: 3_000 });
    expect((await p.verify(fresh(), 'ok', R)).kind).toBe('ok'); // worker ready
    const busy = p.verify(fresh(), 'hang', R);
    await until(() => p.stats().queueDepth === 0); // the hung job is executing
    const waiting = p.verify(fresh(), 'ok', R);
    expect(await waiting).toEqual(unavailable('queue_timeout'));
    expect(await busy).toEqual(unavailable('timeout'));
    expect(p.stats().unavailable.queue_timeout).toBe(1);
  });

  it('timeout: a hung job fails as unavailable (timeout), the worker is replaced, and queued jobs run on the new worker', async () => {
    const spawn = jest.fn(scripted());
    const p = pool({ spawn, jobTimeoutMs: 1_000, queueWaitTimeoutMs: 120_000, startupTimeoutMs: 120_000 });
    const hung = p.verify(fresh(), 'hang', R);
    const queued = p.verify(fresh(4), 'ok', R);
    expect(await hung).toEqual(unavailable('timeout'));
    expect(await queued).toEqual({ kind: 'ok', passages: ['len4'] }); // never started on the dead worker → not a retry
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(p.stats().workerDown.timeout).toBe(1);
  });

  it('crash: the running job fails (crashed) and is NOT re-run; the next job gets a respawned worker', async () => {
    const spawn = jest.fn(scripted());
    const p = pool({ spawn });
    const crashed = p.verify(fresh(), 'crash', R);
    const queued = p.verify(fresh(3), 'ok', R);
    expect(await crashed).toEqual(unavailable('crashed'));
    expect(await queued).toEqual({ kind: 'ok', passages: ['len3'] });
    expect(await p.verify(fresh(), 'throw', R)).toEqual(unavailable('crashed')); // uncaught exception in the worker
    expect(await p.verify(fresh(2), 'ok', R)).toEqual({ kind: 'ok', passages: ['len2'] });
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(p.stats().workerDown.crashed).toBe(2);
  });

  it('startup failure is bounded: after maxConsecutiveFailures the pool cools down and fails fast, then recovers', async () => {
    let now = 1_000;
    let mode = 'boom';
    const spawn = jest.fn(() => scripted(mode)());
    const p = pool({ spawn, now: () => now, maxConsecutiveFailures: 3, cooldownMs: 10_000 });
    expect(await p.verify(fresh(), 'ok', R)).toEqual(unavailable('cooling_down')); // 3 failed starts, then cool-down
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(p.stats().workerDown.startup_failed).toBe(3);
    expect(await p.verify(fresh(), 'ok', R)).toEqual(unavailable('cooling_down')); // fast: no spawn during cool-down
    expect(spawn).toHaveBeenCalledTimes(3);
    mode = '';
    now += 10_001;
    expect(await p.verify(fresh(), 'ok', R)).toEqual({ kind: 'ok', passages: ['len8'] });
    expect(spawn).toHaveBeenCalledTimes(4);
  });

  it('a worker that never reports ready is terminated after startupTimeoutMs (bounded)', async () => {
    const p = pool({ spawn: scripted('noready'), startupTimeoutMs: 100, maxConsecutiveFailures: 1, cooldownMs: 60_000 });
    expect(await p.verify(fresh(), 'ok', R)).toEqual(unavailable('cooling_down'));
    expect(p.stats().workerDown.startup_failed).toBe(1);
  });

  it('a throwing spawn function is a bounded startup failure, not a loop', async () => {
    const spawn = jest.fn(() => { throw new Error('no threads'); });
    const p = pool({ spawn, maxConsecutiveFailures: 2 });
    expect(await p.verify(fresh(), 'ok', R)).toEqual(unavailable('cooling_down'));
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('shutdown fails the running and every queued job (no unresolved promise); the pool can start again afterwards', async () => {
    const p = pool({ jobTimeoutMs: 120_000 });
    const running = p.verify(fresh(), 'hang', R);
    const queued = [p.verify(fresh(), 'ok', R), p.verify(fresh(), 'ok', R)];
    await until(() => p.stats().queueDepth === 2); // the first job is executing, two are waiting
    await p.shutdown();
    expect(await running).toEqual(unavailable('shutdown'));
    expect(await Promise.all(queued)).toEqual([unavailable('shutdown'), unavailable('shutdown')]);
    expect(await p.verify(fresh(), 'ok', R)).toEqual({ kind: 'ok', passages: ['len8'] });
    await p.shutdown();
    await p.shutdown(); // idempotent
  });

  it('no request is left unresolved across a mixed failure storm', async () => {
    const p = pool({ jobTimeoutMs: 200, queueCapacity: 6, maxConsecutiveFailures: 100 });
    const cmds = ['ok', 'crash', 'hang', 'ok', 'throw', 'ok', 'stale', 'ok', 'bad', 'ok'];
    const settled = await Promise.all(cmds.map((c) => p.verify(fresh(), c, R)));
    expect(settled).toHaveLength(cmds.length);
    for (const o of settled) expect(['ok', 'stale', 'unavailable']).toContain(o.kind);
    expect(settled.filter((o) => o.kind === 'ok').every((o) => o.kind === 'ok' && o.passages[0] === 'len8')).toBe(true);
    expect(p.stats().queueDepth).toBe(0);
  });
});

describe('S2VerificationPool — byte buffers (PO-045 §3.2, §6.1)', () => {
  it('a caller buffer that is not marked owned is COPIED: never detached, still readable, reusable across calls', async () => {
    const p = pool();
    const shared = new Uint8Array(new ArrayBuffer(16)).fill(97);
    expect(await p.verify(shared, 'ok', R)).toEqual({ kind: 'ok', passages: ['len16'] });
    expect(shared.byteLength).toBe(16);
    expect(shared[0]).toBe(97);
    expect(await p.verify(shared, 'ok', R)).toEqual({ kind: 'ok', passages: ['len16'] });
    expect(p.stats()).toMatchObject({ copied: 2, copiedBytes: 32, transferred: 0 });
  });

  it('pooled small Buffers are never marked owned, so the shared Buffer pool is never detached', async () => {
    const p = pool();
    const small = Buffer.from('hola'); // a slice of Node's shared allocation pool
    markOwnedBytes(small);
    const neighbour = Buffer.from('vecino');
    expect(await p.verify(small, 'ok', R)).toEqual({ kind: 'ok', passages: ['len4'] });
    expect(small.toString()).toBe('hola');
    expect(neighbour.toString()).toBe('vecino');
    expect(p.stats().transferred).toBe(0);
  });

  it('a marked, exclusively owned buffer is TRANSFERRED zero-copy (detached on the caller side) exactly once', async () => {
    const p = pool();
    const own = fresh(64);
    markOwnedBytes(own);
    expect(await p.verify(own, 'ok', R)).toEqual({ kind: 'ok', passages: ['len64'] });
    expect(own.byteLength).toBe(0); // detached: the main thread no longer holds the book bytes
    expect(p.stats()).toMatchObject({ transferred: 1, copied: 0 });
    const view = new Uint8Array(new ArrayBuffer(32), 8, 8); // partial view of a larger buffer: not markable
    markOwnedBytes(view);
    expect(await p.verify(view, 'ok', R)).toEqual({ kind: 'ok', passages: ['len8'] });
    expect(view.byteLength).toBe(8);
    markOwnedBytes(new Uint8Array(0)); // empty: ignored
  });

  it('StorageBookText marks its fresh, unpooled read buffers as owned (and only those)', async () => {
    const big = Buffer.concat([Buffer.alloc(10_000, 98)]);
    const storage = { getBytes: jest.fn(async () => big) };
    const p = pool();
    const bytes = await new StorageBookText(storage as any).read('k');
    expect(storage.getBytes).toHaveBeenCalledWith('k', 'books');
    expect(await p.verify(bytes, 'ok', R)).toEqual({ kind: 'ok', passages: ['len10000'] });
    expect(p.stats().transferred).toBe(1);
    const small = Buffer.concat([Buffer.from('abc')]);
    const p2 = pool();
    await p2.verify(await new StorageBookText({ getBytes: async () => small } as any).read('s'), 'ok', R);
    expect(p2.stats()).toMatchObject({ transferred: 0, copied: 1 });
    expect(small.toString()).toBe('abc');
  });
});

describe('S2VerificationPool — real worker entry point (production code path)', () => {
  const T = 'Érase una vez un niño que cantaba. 𝔘na canción antigua sonaba en la plaza.';
  it('verifies, validates and slices in the worker, identical to the in-loop result; stale and invalid fail closed', async () => {
    const p = pool({ spawn: spawnS2Worker, startupTimeoutMs: 20_000, queueWaitTimeoutMs: 20_000, jobTimeoutMs: 5_000 });
    const b = Buffer.from(T);
    const ranges = [{ start: 35, end: 54 }, { start: 0, end: 5 }, { start: 70, end: 99 }];
    expect(await p.verify(b, computeTextHash(b), ranges)).toEqual({ kind: 'ok', passages: sliceCodePointRanges(decodeUtf8(b), ranges) });
    expect(await p.verify(b, computeTextHash(Buffer.from('otro')), ranges)).toEqual({ kind: 'stale' });
    const bad = Buffer.concat([b, Buffer.from([0xff])]);
    expect(await p.verify(bad, computeTextHash(bad), ranges)).toEqual(unavailable('invalid_utf8'));
    expect(p.stats().spawns).toBe(1);
  }, 30_000);

  it('the process has ONE shared pool (processS2Verifier is a singleton) with the documented default bounds', () => {
    expect(processS2Verifier()).toBe(processS2Verifier());
    expect(DEFAULT_S2_POOL_OPTIONS).toMatchObject({ queueCapacity: 32, jobTimeoutMs: 2_000, queueWaitTimeoutMs: 5_000, startupTimeoutMs: 5_000, maxConsecutiveFailures: 3, cooldownMs: 5_000 });
    expect(DEFAULT_S2_POOL_OPTIONS.now()).toBeGreaterThan(0);
    expect(Object.isFrozen(DEFAULT_S2_POOL_OPTIONS)).toBe(true);
  });
});
