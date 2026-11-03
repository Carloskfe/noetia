import {
  MIGRATION_068_CHECK,
  auditQueries,
  runLegacyShareAudit,
} from '../../../src/sharing/legacy-share-audit';

const SOURCE = 'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, vivía un hidalgo.';

function fakeDb(applied: boolean, rows: Record<string, Array<Record<string, unknown>>>) {
  const q = auditQueries(applied);
  const executed: string[] = [];
  return {
    executed,
    query: jest.fn(async (sql: string) => {
      executed.push(sql);
      if (sql === MIGRATION_068_CHECK) return [{ applied }];
      if (sql === q.liveShares) return [{ count: rows.quotes?.length ?? 0 }];
      for (const [k, v] of Object.entries(rows)) if (sql === (q as Record<string, string>)[k]) return v;
      return [];
    }),
  };
}

describe('auditQueries', () => {
  it('only counts live (unrevoked) shares once migration 068 is applied', () => {
    for (const sql of Object.values(auditQueries(true))) expect(sql).toContain('s."revokedAt" IS NULL');
    for (const sql of Object.values(auditQueries(false))) expect(sql).not.toContain('revokedAt');
  });

  it('is strictly read-only SQL', () => {
    for (const sql of [MIGRATION_068_CHECK, ...Object.values(auditQueries(true))]) {
      expect(sql.trim()).toMatch(/^SELECT/i);
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|GRANT)\b/i);
    }
  });

  it('defines each requested check', () => {
    const q = auditQueries(true);
    expect(q.createdByNonOwner).toContain('IS DISTINCT FROM f."userId"');
    expect(q.orphanCreator).toContain('NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s."createdById")');
    expect(q.ineligibleBook).toContain('book."isPublished" = true');
    expect(q.ineligibleBook).toContain('syncCoverage');
  });
});

describe('runLegacyShareAudit', () => {
  it('reports ids and counts for every check, with no quote text in the output', async () => {
    const db = fakeDb(true, {
      createdByNonOwner: [{ id: 'S1' }],
      sourceFragmentMissing: [{ id: 'S2' }],
      orphanCreator: [{ id: 'S3' }, { id: 'S4' }],
      ineligibleBook: [{ id: 'S5' }],
      quotes: [
        { id: 'Q1', bookId: 'b1', quote: 'de cuyo nombre no quiero acordarme', textFileKey: null },
        { id: 'Q2', bookId: 'b1', quote: 'de cuyo nombre sí quiero acordarme', textFileKey: null },
        { id: 'Q3', bookId: 'b1', quote: 'En un lugar de la Mancha … vivía un hidalgo', textFileKey: null },
        { id: 'Q4', bookId: 'b2', quote: 'anything', textFileKey: 'k' },
      ],
    });
    const loader = jest.fn(async (bookId: string) => (bookId === 'b1' ? SOURCE : null));

    const report = await runLegacyShareAudit(db, loader);

    expect(report.migration068Applied).toBe(true);
    expect(report.liveShares).toBe(4);
    expect(report.createdByNonOwner).toEqual({ count: 1, shareIds: ['S1'] });
    expect(report.sourceFragmentMissing).toEqual({ count: 1, shareIds: ['S2'] });
    expect(report.orphanCreator).toEqual({ count: 2, shareIds: ['S3', 'S4'] });
    expect(report.ineligibleBook).toEqual({ count: 1, shareIds: ['S5'] });
    expect(report.quoteIntegrity.checked).toBe(3);
    expect(report.quoteIntegrity.failing.shareIds).toEqual(['Q2', 'Q3']);
    expect(report.quoteIntegrity.failing.byReason).toEqual({ not_in_source: 2 });
    expect(report.quoteIntegrity.unverifiable).toEqual({ count: 1, shareIds: ['Q4'] });
    expect(JSON.stringify(report)).not.toContain('quiero');
    expect(loader).toHaveBeenCalledTimes(2); // source loaded once per book
  });

  it('works before migration 068 (no revokedAt column yet)', async () => {
    const db = fakeDb(false, { quotes: [] });
    const report = await runLegacyShareAudit(db, async () => null);
    expect(report.migration068Applied).toBe(false);
    expect(db.executed.some((sql) => sql.includes('revokedAt IS NULL'))).toBe(false);
  });

  it('treats a source-loading failure as unverifiable, not as a failing quote', async () => {
    const db = fakeDb(true, { quotes: [{ id: 'Q1', bookId: 'b1', quote: 'x y z', textFileKey: 'k' }] });
    const report = await runLegacyShareAudit(db, async () => { throw new Error('minio down'); });
    expect(report.quoteIntegrity.unverifiable.shareIds).toEqual(['Q1']);
    expect(report.quoteIntegrity.failing.count).toBe(0);
  });
});
