import { AnchorResolver } from '../../../../src/knowledge/retrieval/anchor-resolver';
import { FakeDb } from '../support/fixtures';

const ID = '0b6b5f0e-3a8e-4c55-9a43-7d1c2b9e8f10';
const H = `sha256:${'a'.repeat(64)}`;
const row = { bookId: 'b1', textHash: H, charStart: 10, charEnd: 20, chapterLabel: null, phraseIndexStart: null, phraseIndexEnd: null };

function setup(current: string | null | 'throw', rows: any[] = [row]) {
  const db = new FakeDb().on(/FROM ai_book_chunks WHERE id/, () => rows);
  const ti = { currentTextHash: jest.fn(async () => { if (current === 'throw') throw new Error('x'); return current; }) };
  return { r: new AnchorResolver(db as any, ti), db, ti };
}

describe('AnchorResolver (§5.8)', () => {
  it('resolves a chunk ref while its hash is the current one; Stage-1 metadata is null', async () => {
    expect(await setup(H).r.resolve(`chunk:${ID}`)).toEqual({
      bookId: 'b1', textHash: H, charStart: 10, charEnd: 20, chapterLabel: null, phraseRange: null, anchor: `${H}:10-20`,
    });
  });
  it('maps stored phrase indexes when present (future approved path)', async () => {
    const out = await setup(H, [{ ...row, phraseIndexStart: 3, phraseIndexEnd: 5, chapterLabel: 'I' }]).r.resolve(`chunk:${ID}`);
    expect(out).toMatchObject({ phraseRange: { start: 3, end: 5 }, chapterLabel: 'I' });
  });
  it.each<[string, string | null | 'throw']>([['stale (text replaced)', `sha256:${'b'.repeat(64)}`], ['unknown identity', null], ['identity throws', 'throw']])('refuses: %s', async (_l, cur) => {
    expect(await setup(cur).r.resolve(`chunk:${ID}`)).toBeNull();
  });
  it('refuses malformed refs without querying, and unknown ids', async () => {
    const s = setup(H, []);
    expect(await s.r.resolve('chunk:nope')).toBeNull();
    expect(s.db.query).not.toHaveBeenCalled();
    expect(await s.r.resolve(`chunk:${ID}`)).toBeNull();
    expect(s.ti.currentTextHash).not.toHaveBeenCalled();
  });
});
