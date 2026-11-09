import { FakeDb } from './fixtures';

export interface StoredSession {
  id: string; userId: string; parentId: string | null; contextParentId: string | null;
  status: 'active' | 'read_only'; readOnlyReason: string | null; tierAtCreation: string;
  lockedAt: Date | null; bookSetHash: string | null; turnCount: number;
}
export interface StoredBook { id: string; sessionId: string; bookId: string | null; position: number; titleSnapshot: string; authorSnapshot: string }

/** In-memory stand-in for ai_conversations / ai_session_books / books used by SessionsService and TurnService. */
export function sessionStore(catalogue: string[]) {
  const db = new FakeDb();
  const sessions: StoredSession[] = [];
  const books: StoredBook[] = [];
  let seq = 0;
  const newId = () => `20000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const ordered = (sid: string) => books.filter((b) => b.sessionId === sid).sort((a, b) => a.position - b.position);

  db.on(/^SELECT id, title, author FROM books/, ([ids]) =>
    catalogue.filter((c) => ids.includes(c)).map((id) => ({ id, title: `Fixture ${id.slice(-2)}`, author: 'Fixture Author' })));
  db.on(/INSERT INTO ai_conversations/, (p) => {
    const fork = p.length === 5;
    const s: StoredSession = {
      id: newId(), userId: p[0], parentId: fork ? p[1] : null, contextParentId: fork ? p[2] : null,
      status: 'active', readOnlyReason: null, tierAtCreation: fork ? p[3] : p[1], lockedAt: null, bookSetHash: null, turnCount: 0,
    };
    sessions.push(s);
    return [{ id: s.id }];
  });
  db.on(/INSERT INTO ai_session_books/, ([sessionId, bookId, position, titleSnapshot, authorSnapshot]) => {
    books.push({ id: newId(), sessionId, bookId, position, titleSnapshot, authorSnapshot });
    return [];
  });
  db.on(/^SELECT id, "bookId", position, "titleSnapshot", "authorSnapshot" FROM ai_session_books/, ([sid]) => ordered(sid));
  db.on(/^SELECT \* FROM ai_conversations WHERE id = \$1 AND "userId" = \$2/, ([id, uid]) =>
    sessions.filter((s) => s.id === id && s.userId === uid).map((s) => ({ ...s })));
  db.on(/^SELECT (id|status) FROM ai_conversations WHERE id = \$1 AND "userId" = \$2/, ([id, uid]) =>
    sessions.filter((s) => s.id === id && s.userId === uid).map((s) => ({ id: s.id, status: s.status })));
  db.on(/SET status = 'read_only'/, ([id]) => {
    const s = sessions.find((x) => x.id === id)!;
    s.status = 'read_only';
    s.readOnlyReason = 'over_tier_limit';
    return [{ ...s }];
  });
  db.on(/SET "updatedAt" = now\(\) WHERE id/, () => []);
  db.on(/SET "lockedAt" = COALESCE/, ([id, hash]) => {
    const s = sessions.find((x) => x.id === id)!;
    s.lockedAt = s.lockedAt ?? new Date();
    s.bookSetHash = s.bookSetHash ?? hash;
    s.turnCount++;
    return [];
  });
  db.on(/^DELETE FROM ai_session_books/, ([sid, bookId]) => {
    const i = books.findIndex((b) => b.sessionId === sid && b.bookId === bookId);
    if (i < 0) return [];
    const [r] = books.splice(i, 1);
    return [{ id: r.id }];
  });
  return { db, sessions, books };
}
