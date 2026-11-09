import { CreateIntelligenceSessions1748300000070 } from '../../../src/migrations/1748300000070-CreateIntelligenceSessions';

const runner = () => {
  const calls: string[] = [];
  return { calls, qr: { query: jest.fn(async (sql: string) => { calls.push(sql); return []; }) } as any };
};

describe('CreateIntelligenceSessions1748300000070 (NEM-019)', () => {
  it('creates sessions cascading from users and books with SET NULL + snapshot', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceSessions1748300000070().up(qr);
    const all = calls.join('\n');
    expect(all).not.toMatch(/ALTER TABLE/i);
    const conv = calls.find((s) => /CREATE TABLE ai_conversations/.test(s))!;
    expect(conv).toMatch(/"userId" uuid NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
    const books = calls.find((s) => /CREATE TABLE ai_session_books/.test(s))!;
    expect(books).toMatch(/REFERENCES ai_conversations\(id\) ON DELETE CASCADE/);
    expect(books).toMatch(/"bookId" uuid REFERENCES books\(id\) ON DELETE SET NULL/);
    expect(books).toMatch(/CHECK \(position BETWEEN 1 AND 10\)/);
    expect(books).toMatch(/UNIQUE \("sessionId", "bookId"\)/);
    expect(books).toMatch(/UNIQUE \("sessionId", position\)/);
    expect(books).toMatch(/"titleSnapshot" varchar NOT NULL/);
  });

  it('down drops child before parent', async () => {
    const { calls, qr } = runner();
    await new CreateIntelligenceSessions1748300000070().down(qr);
    expect(calls).toEqual(['DROP TABLE IF EXISTS ai_session_books', 'DROP TABLE IF EXISTS ai_conversations']);
  });
});
