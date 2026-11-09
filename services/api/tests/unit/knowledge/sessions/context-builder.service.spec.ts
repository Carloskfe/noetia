import { isVerifiedContext } from '../../../../src/knowledge/ai/verified-context';
import { ContextBuilderService } from '../../../../src/knowledge/sessions/context-builder.service';
import { bookId, mockMetrics, USER_A, USER_B } from '../support/fixtures';

/** Context invariant `research_session_context` (B-3, AC-13). */
describe('ContextBuilderService — research_session_context invariant', () => {
  const metrics = mockMetrics();
  const builder = new ContextBuilderService(metrics);
  const allowed = [bookId(1), bookId(2)];
  beforeEach(() => jest.clearAllMocks());

  const expectViolation = (items: any[], allowedSet: string[] = allowed) => {
    expect(() => builder.build(USER_A, allowedSet, items)).toThrow(expect.objectContaining({ reason: 'scope_violation' }));
    expect(metrics.scopeViolationInc).toHaveBeenCalledTimes(1);
  };

  it('seals a context whose items all belong to selected books and the requester', () => {
    const c = builder.build(USER_A, allowed, [
      { kind: 'chunk', ref: 'c1', bookId: bookId(1) },
      { kind: 'highlight', ref: 'h1', bookId: bookId(2), userId: USER_A },
      { kind: 'note', ref: 'n1', bookId: bookId(1), userId: USER_A },
    ]);
    expect(isVerifiedContext(c)).toBe(true);
    expect(c.invariant).toBe('research_session_context');
    expect(c.pathId).toBe('research_session.turn');
  });

  it('a chunk from an unselected book aborts', () => expectViolation([{ kind: 'chunk', ref: 'c', bookId: bookId(3) }]));
  it('a highlight from an unselected book aborts', () => expectViolation([{ kind: 'highlight', ref: 'h', bookId: bookId(3), userId: USER_A }]));
  it('a note from an unselected book aborts', () => expectViolation([{ kind: 'note', ref: 'n', bookId: bookId(3), userId: USER_A }]));
  it("another user's highlight on a selected book aborts", () => expectViolation([{ kind: 'highlight', ref: 'h', bookId: bookId(1), userId: USER_B }]));
  it('an item with no book aborts', () => expectViolation([{ kind: 'chunk', ref: 'c', bookId: null }]));
  it('an unknown item kind aborts', () => expectViolation([{ kind: 'web', ref: 'w', bookId: bookId(1) }]));
  it('an empty allowed set aborts (retrieval needs an explicit, non-empty set)', () => expectViolation([], []));
});
