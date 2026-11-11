import { sliceCodePointRanges } from '../../../../src/knowledge/retrieval/chunker';
import { decodeUtf8 } from '../../../../src/knowledge/retrieval/retrieval.types';
import { runS2Job, S2_WORKER_FILE, S2_WORKER_ROLE } from '../../../../src/knowledge/retrieval/s2-worker';
import { computeTextHash } from '../../../../src/knowledge/rights/text-hash';

/** PO-045 — the pure per-book job the worker runs: hash → whole-object UTF-8 → byte-level slicing. */
const T = 'Érase una vez un niño que cantaba. 𝔘na canción antigua sonaba en la plaza.';
const B = Buffer.from(T);
const H = computeTextHash(B);

describe('runS2Job (S2 worker job)', () => {
  it('ok: verified hash + valid UTF-8 → passages identical to the in-loop implementation; execMs reported', () => {
    const ranges = [{ start: 35, end: 54 }, { start: 0, end: 5 }, { start: 3, end: 2 }];
    const r = runS2Job({ id: 7, bytes: B, expectedHash: H, ranges });
    expect(r).toMatchObject({ id: 7, kind: 'ok', passages: sliceCodePointRanges(decodeUtf8(B), ranges) });
    expect(r.kind === 'ok' && r.passages).toEqual(['𝔘na canción antigua', 'Érase', null]);
    expect(r.execMs).toBeGreaterThanOrEqual(0);
  });

  it('hash mismatch → stale, with no passage text (hash is checked before UTF-8, as before)', () => {
    const r = runS2Job({ id: 1, bytes: Buffer.from(`${T}!`), expectedHash: H, ranges: [{ start: 0, end: 5 }] });
    expect(r).toEqual({ id: 1, kind: 'stale', execMs: expect.any(Number) });
    const invalidWrongHash = runS2Job({ id: 2, bytes: Uint8Array.from([0xff, 0x61]), expectedHash: H, ranges: [] });
    expect(invalidWrongHash.kind).toBe('stale');
  });

  it('invalid UTF-8 anywhere in the object (hash matching) → invalid_utf8, never partial passages', () => {
    const bad = Buffer.concat([Buffer.from('Hola mundo, '), Buffer.from([0xc3]), Buffer.from(' adiós')]);
    const r = runS2Job({ id: 3, bytes: bad, expectedHash: computeTextHash(bad), ranges: [{ start: 0, end: 4 }] });
    expect(r).toEqual({ id: 3, kind: 'invalid_utf8', execMs: expect.any(Number) });
    const truncated = Buffer.from('fin 😀').subarray(0, 6);
    expect(runS2Job({ id: 4, bytes: truncated, expectedHash: computeTextHash(truncated), ranges: [{ start: 0, end: 3 }] }).kind).toBe('invalid_utf8');
  });

  it('malformed job or an internal exception → error (the main thread maps it to unavailable)', () => {
    expect(runS2Job({ id: 5, bytes: 'x' as any, expectedHash: H, ranges: [] }).kind).toBe('error');
    expect(runS2Job({ id: 6, bytes: B, expectedHash: 1 as any, ranges: [] }).kind).toBe('error');
    expect(runS2Job({ id: 8, bytes: B, expectedHash: H, ranges: null as any }).kind).toBe('error');
    expect(runS2Job({ bytes: B } as any)).toMatchObject({ id: -1, kind: 'error' });
    expect(runS2Job(null as any)).toMatchObject({ id: -1, kind: 'error' });
    const throwing = { id: 9, bytes: B, expectedHash: H, ranges: [{ get start(): number { throw new Error('boom'); }, end: 3 }] };
    expect(runS2Job(throwing as any)).toMatchObject({ id: 9, kind: 'error' });
  });

  it('exposes its own file (for spawning) and attaches no message loop when imported on the main thread', () => {
    expect(S2_WORKER_FILE).toMatch(/s2-worker\.(ts|js)$/);
    expect(S2_WORKER_ROLE).toBe('noetia-s2-verify');
  });
});
