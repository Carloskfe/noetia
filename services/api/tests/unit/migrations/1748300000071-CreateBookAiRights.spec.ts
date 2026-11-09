import { CreateBookAiRights1748300000071 } from '../../../src/migrations/1748300000071-CreateBookAiRights';

const runner = () => {
  const calls: string[] = [];
  return { calls, qr: { query: jest.fn(async (sql: string) => { calls.push(sql); return []; }) } as any };
};

describe('CreateBookAiRights1748300000071 (NEM-019)', () => {
  it('creates an empty, default-unknown rights table with every 07 §3 element and no seed (AC-12)', async () => {
    const { calls, qr } = runner();
    await new CreateBookAiRights1748300000071().up(qr);
    expect(calls).toHaveLength(1);
    const sql = calls[0];
    expect(sql).not.toMatch(/INSERT/i);
    expect(sql).toMatch(/status varchar\(16\) NOT NULL DEFAULT 'unknown'/);
    for (const col of ['"textHash"', '"workTitle"', '"workAuthors"', '"authorDeathDate"', '"firstPublicationDate"', 'edition', '"editionPublisher"',
      '"editionYear"', '"textSource"', '"isTranslation"', 'translators', '"translatorDeathDate"', '"translationDate"', '"addedMaterial"',
      '"sourceUrl"', '"rightsBasis"', '"rightsEvidence"', 'jurisdiction', '"permittedOperations"', 'verifier', '"verifiedAt"', '"evidenceLinks"', '"reviewDate"']) {
      expect(sql).toContain(col);
    }
    expect(sql).toMatch(/UNIQUE \("bookId", "textHash"\)/);
  });

  it('down drops the table', async () => {
    const { calls, qr } = runner();
    await new CreateBookAiRights1748300000071().down(qr);
    expect(calls).toEqual(['DROP TABLE IF EXISTS book_ai_rights']);
  });
});
