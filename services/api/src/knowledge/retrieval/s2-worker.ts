import { performance } from 'perf_hooks';
import { isMainThread, parentPort, workerData } from 'worker_threads';
import { computeTextHash } from '../rights/text-hash';
import { isStrictUtf8, sliceUtf8CodePointRanges } from './utf8-slice';

/**
 * PO-045 (Option D) — the S2 worker-thread entry point.
 *
 * Runs the CPU-heavy per-book S2 steps off the API event loop, in this order (unchanged from the in-loop version):
 *   1. SHA-256 over the exact bytes through the single `computeTextHash` definition, compared with the caller's hash;
 *   2. strict UTF-8 validation of the WHOLE object;
 *   3. code-point → byte offset mapping and decoding of the requested passages only.
 * It never reads storage, caches nothing between jobs, logs nothing, and returns passage text only after both checks
 * pass. Any exception is reported as `error`, which the main thread maps to `unavailable` (fail closed).
 *
 * Importing this module on the main thread only exposes `S2_WORKER_FILE` and the pure `runS2Job`; the message loop is
 * attached only inside a worker started with the S2 role marker.
 */
export const S2_WORKER_FILE = __filename;
export const S2_WORKER_ROLE = 'noetia-s2-verify';

export interface S2Range {
  start: number;
  end: number;
}

export interface S2Job {
  id: number;
  bytes: Uint8Array;
  expectedHash: string;
  ranges: S2Range[];
}

export type S2Reply =
  | { id: number; kind: 'ok'; passages: (string | null)[]; execMs: number }
  | { id: number; kind: 'stale' | 'invalid_utf8' | 'error'; execMs: number };

export function runS2Job(job: S2Job): S2Reply {
  const t0 = performance.now();
  const id = job && Number.isInteger(job.id) ? job.id : -1;
  const done = (r: { kind: S2Reply['kind']; passages?: (string | null)[] }) => ({ ...r, id, execMs: performance.now() - t0 }) as S2Reply;
  try {
    if (id < 0 || !(job.bytes instanceof Uint8Array) || typeof job.expectedHash !== 'string' || !Array.isArray(job.ranges)) return done({ kind: 'error' });
    if (computeTextHash(job.bytes) !== job.expectedHash) return done({ kind: 'stale' });
    if (!isStrictUtf8(job.bytes)) return done({ kind: 'invalid_utf8' });
    return done({ kind: 'ok', passages: sliceUtf8CodePointRanges(job.bytes, job.ranges) });
  } catch {
    return done({ kind: 'error' });
  }
}

/* istanbul ignore next -- runs only inside the worker thread; exercised by the real-worker tests. */
if (!isMainThread && parentPort && workerData && workerData.role === S2_WORKER_ROLE) {
  const port = parentPort;
  port.on('message', (job: S2Job) => port.postMessage(runS2Job(job)));
  port.postMessage({ kind: 'ready' });
}
