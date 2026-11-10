import { QueryContextSource } from '../../../../src/knowledge/retrieval/query-context-source.service';
import { DEFAULT_RETRIEVAL_CONFIG, Passage } from '../../../../src/knowledge/retrieval/retrieval.types';
import { bookId, USER_A } from '../support/fixtures';

const [B1, B2, B3] = [bookId(1), bookId(2), bookId(3)];
const H = (c: string) => `sha256:${c.repeat(64)}`;
const passage = (bookId: string, ref: string, text: string): Passage => ({
  ref, bookId, textHash: H('a'), chunkIndex: 0, charStart: 0, charEnd: text.length, chapterLabel: null, phraseRange: null, language: 'es', rank: 1, text, tokens: 2,
});

function setup(decisions: Record<string, any>, passages: Passage[] = []) {
  const permission = { check: jest.fn(async (b: string) => decisions[b] ?? { permitted: false, reason: 'text_identity_unknown' }) };
  const retrieval = { retrieve: jest.fn(async () => ({ passages, excluded: { unindexed: [], stale: [B3], unavailable: [] }, truncated: true })) };
  const metrics = { excludedInc: jest.fn() };
  return { qcs: new QueryContextSource(permission as any, retrieval, metrics as any, DEFAULT_RETRIEVAL_CONFIG), permission, retrieval, metrics };
}

describe('QueryContextSource (§5.7, §9.2) — dark E6 boundary', () => {
  it('re-checks book-level index permission (current hash from TextIdentityPort) and retrieves only permitted books', async () => {
    const s = setup({ [B1]: { permitted: true, textHash: H('a') }, [B2]: { permitted: false, reason: 'operation_not_permitted' } }, [passage(B1, 'chunk:x', 'una canción')]);
    const out = await s.qcs.resolve(USER_A, [B2, B1, B1], 'canción');
    expect(s.permission.check).toHaveBeenCalledTimes(2); // cached per request (deduplicated)
    expect(s.retrieval.retrieve).toHaveBeenCalledWith({ allowed: [{ bookId: B1, textHash: H('a') }], query: 'canción', topK: 8, budgetTokens: 6000 });
    expect(out.items).toEqual([{ kind: 'chunk', ref: 'chunk:x', bookId: B1, text: 'una canción' }]);
    expect(out.excluded).toEqual({ unindexed: [], stale: [B3], unavailable: [], indexNotPermitted: [B2] });
    expect(out.truncated).toBe(true);
    expect(s.metrics.excludedInc).toHaveBeenCalledWith('index_not_permitted', 1);
  });

  it('returns chunk items only (no highlight or note: Amendment 1, B-1), never user-owned', async () => {
    const s = setup({ [B1]: { permitted: true, textHash: H('a') } }, [passage(B1, 'chunk:a', 'x'), passage(B1, 'chunk:b', 'y')]);
    const items = await s.qcs.candidatesFor(USER_A, [B1], 'x');
    expect(items.every((i) => i.kind === 'chunk' && i.userId === undefined)).toBe(true);
  });

  it('passes caller budget/topK, capped at the retrieval maximum', async () => {
    const s = setup({ [B1]: { permitted: true, textHash: H('a') } });
    await s.qcs.candidatesFor(USER_A, [B1], 'q', { topK: 3, budgetTokens: 99_999 });
    expect(s.retrieval.retrieve).toHaveBeenCalledWith(expect.objectContaining({ topK: 3, budgetTokens: 8000 }));
  });

  it('default deny: no permitted book, empty set, invalid ids, or empty query → nothing, retrieval never called', async () => {
    const s = setup({});
    expect(await s.qcs.candidatesFor(USER_A, [B1], 'q')).toEqual([]);
    expect(await s.qcs.candidatesFor(USER_A, [], 'q')).toEqual([]);
    expect(await s.qcs.candidatesFor(USER_A, ['not-a-uuid'], 'q')).toEqual([]);
    expect(await s.qcs.candidatesFor(USER_A, [B1], '   ')).toEqual([]);
    expect(s.retrieval.retrieve).not.toHaveBeenCalled();
  });
});
