import { citationFor, enforceCitations, originAfterRules, validateSegment } from '../../../../../src/knowledge/ai/gateway/citation-policy';
import { sealContext } from '../../../../../src/knowledge/ai/verified-context';

const ctx = sealContext({
  pathId: 'research_session.turn', invariant: 'research_session_context', userId: 'u', allowedBookIds: ['b-1'],
  items: [
    { kind: 'chunk', ref: 'c-1', bookId: 'b-1' },
    { kind: 'highlight', ref: 'h-1', bookId: 'b-1', userId: 'u' },
    { kind: 'note', ref: 'n-1', bookId: 'b-1', userId: 'u' },
    { kind: 'chunk', ref: 'c-orphan', bookId: null },
    { kind: 'chunk', ref: 'c-other', bookId: 'b-2' },
  ],
});
const seg = (origin: string, cites: string[] = [], text = 'Invented.') => ({ origin, text, citations: cites.map((ref) => ({ ref })) });

describe('citation and origin policy (ADR-003 origins, ADR-006 trust boundary)', () => {
  it('citations resolve only to sealed items of allowed books, keeping anchors', () => {
    expect(citationFor(ctx, 'c-1', 'p.4')).toEqual({ ref: 'c-1', anchor: 'p.4', kind: 'chunk', bookId: 'b-1' });
    expect(citationFor(ctx, 'c-1')).toEqual({ ref: 'c-1', kind: 'chunk', bookId: 'b-1' });
    for (const ref of ['missing', 'c-orphan', 'c-other']) expect(citationFor(ctx, ref)).toBeNull();
  });

  it.each([
    ['a ref not in the sealed context', [seg('library', ['missing'])], []],
    ['an item of a book outside the allowed set', [seg('synthesis', ['c-other'])], []],
    ['an unknown origin label', [seg('web')], []],
    ['a tool call naming a disallowed book', [seg('synthesis')], [{ name: 'retrieve', bookId: 'b-9' }]],
  ])('scope violation: %s (whole answer dropped)', (_l, raw, tools) => {
    expect(enforceCitations(ctx, raw as any, tools)).toEqual({ segments: [], scopeViolation: true, relabelled: 0 });
  });

  it('library needs at least one citation and only book chunks; otherwise it is relabelled synthesis', () => {
    expect(originAfterRules('library', [{ ref: 'c-1', kind: 'chunk', bookId: 'b-1' }])).toBe('library');
    const r = enforceCitations(ctx, [seg('library'), seg('library', ['h-1']), seg('library', ['c-1', 'n-1']), seg('library', ['c-1'])], []);
    expect(r.segments.map((s) => s.origin)).toEqual(['synthesis', 'synthesis', 'synthesis', 'library']);
    expect(r.relabelled).toBe(3);
  });

  it('user content cites only the user own highlights and notes, never book chunks; broader carries no citations', () => {
    expect(validateSegment(ctx, seg('user_content', ['h-1', 'n-1']))!.origin).toBe('user_content');
    expect(validateSegment(ctx, seg('user_content', ['c-1']))!.origin).toBe('synthesis');
    expect(validateSegment(ctx, seg('broader'))!.origin).toBe('broader');
    expect(validateSegment(ctx, seg('broader', ['c-1']))!.origin).toBe('synthesis');
    expect(validateSegment(ctx, seg('synthesis', ['c-1', 'h-1']))!.origin).toBe('synthesis');
  });

  it('a valid answer keeps text and tool calls within the allowed set', () => {
    const r = enforceCitations(ctx, [seg('library', ['c-1']), seg('synthesis')], [{ name: 'retrieve', bookId: 'b-1' }]);
    expect(r).toMatchObject({ scopeViolation: false, relabelled: 0 });
    expect(r.segments[0]).toEqual({ origin: 'library', text: 'Invented.', citations: [{ ref: 'c-1', kind: 'chunk', bookId: 'b-1' }] });
  });
});
