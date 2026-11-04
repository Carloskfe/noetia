import { classifyCardImages, runOrphanImageAudit, ShareRef, StorageObject } from '../../../src/sharing/orphan-image-audit';

const NOW = new Date('2026-11-03T12:00:00Z');
const OLD = new Date('2026-10-01T00:00:00Z');
const RECENT = new Date('2026-11-03T11:00:00Z');
const key = (n: number) => `${String(n).padStart(8, '0')}-2222-4333-8444-555555555555.png`;
const url = (n: number) => `https://storage.noetia.app/images/${key(n)}`;
const obj = (n: number, lastModified = OLD): StorageObject => ({ key: key(n), lastModified });
const share = (n: number, over: Partial<ShareRef> = {}): ShareRef => ({
  id: `s${n}`, imageUrl: url(n), revoked: false, bookExists: true, bookEligible: true, createdAt: new Date('2026-09-01T00:00:00Z'), ...over,
});
const run = (objects: StorageObject[], shares: ShareRef[], outbox: string[] = []) =>
  classifyCardImages(objects, shares, outbox, { now: NOW, minAgeHours: 24 });

describe('classifyCardImages', () => {
  it('never proposes anything for an image in use', () => {
    const r = run([obj(1)], [share(1)]);
    expect(r.counts.in_use).toBe(1);
    expect(r.proposedActions).toEqual({ revokeShares: [], deleteObjects: [] });
  });

  it('marks a live share of a deleted book as safely identified (the F2 defect)', () => {
    const r = run([obj(1)], [share(1, { bookExists: false, bookEligible: false })]);
    expect(r.keys.book_deleted).toEqual([key(1)]);
    expect(r.proposedActions).toEqual({ revokeShares: ['s1'], deleteObjects: [key(1)] });
  });

  it('marks a revoked share with nothing queued as safely identified', () => {
    const r = run([obj(1)], [share(1, { revoked: true })]);
    expect(r.keys.revoked_not_deleted).toEqual([key(1)]);
    expect(r.proposedActions).toEqual({ revokeShares: [], deleteObjects: [key(1)] });
  });

  it('leaves a queued image to the sweep', () => {
    const r = run([obj(1)], [share(1, { revoked: true })], [key(1)]);
    expect(r.keys.queued).toEqual([key(1)]);
    expect(r.proposedActions.deleteObjects).toEqual([]);
  });

  it('treats a live share of a book that fails the gate today as ambiguous', () => {
    const r = run([obj(1)], [share(1, { bookEligible: false })]);
    expect(r.keys.live_book_ineligible).toEqual([key(1)]);
    expect(r.proposedActions.deleteObjects).toEqual([]);
  });

  it('never proposes a recent object, even with the book gone or the share revoked', () => {
    const gone = run([obj(1, RECENT)], [share(1, { bookExists: false })]);
    const revoked = run([obj(1, RECENT)], [share(1, { revoked: true })]);
    const none = run([obj(1, RECENT)], []);
    for (const r of [gone, revoked, none]) {
      expect(r.keys.recent).toEqual([key(1)]);
      expect(r.proposedActions).toEqual({ revokeShares: [], deleteObjects: [] });
    }
  });

  it('never proposes an unreferenced object: older than every share', () => {
    const r = run([obj(1, new Date('2026-08-01T00:00:00Z'))], [share(2)]);
    expect(r.keys.unreferenced_before_shares).toEqual([key(1)]);
    expect(r.proposedActions.deleteObjects).toEqual([]);
  });

  it('never proposes an unreferenced object: newer than the first share', () => {
    const r = run([obj(1)], [share(2)]);
    expect(r.keys.unreferenced).toEqual([key(1)]);
    expect(r.proposedActions.deleteObjects).toEqual([]);
  });

  it('with no shares at all, everything unreferenced is treated as older than shares', () => {
    expect(run([obj(1)], []).keys.unreferenced_before_shares).toEqual([key(1)]);
  });

  it('keeps an image if any live share of an eligible book uses it', () => {
    const r = run([obj(1)], [share(1, { id: 'a', revoked: true }), share(1, { id: 'b' })]);
    expect(r.counts.in_use).toBe(1);
    expect(r.proposedActions.deleteObjects).toEqual([]);
  });

  it('ignores covers, presets and anything that is not a root-level card', () => {
    const r = run([
      { key: 'covers/abc.png', lastModified: OLD },
      { key: `covers/${key(1)}`, lastModified: OLD },
      { key: 'backgrounds/presets/imagen-1.png', lastModified: OLD },
      { key: 'share/old.png', lastModified: OLD },
    ], []);
    expect(r.ignoredNonCards).toBe(4);
    expect(r.proposedActions.deleteObjects).toEqual([]);
    expect(Object.values(r.counts).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('reports a live share whose image is missing, without proposing anything', () => {
    const r = run([], [share(1)]);
    expect(r.liveSharesMissingImage).toEqual(['s1']);
    expect(r.proposedActions).toEqual({ revokeShares: [], deleteObjects: [] });
  });

  it('reports a share with a foreign image URL', () => {
    expect(run([], [share(1, { imageUrl: 'https://elsewhere/x.png' })]).sharesWithForeignImage).toEqual(['s1']);
  });

  it('holds no quote text, names or addresses', () => {
    const dump = JSON.stringify(run([obj(1)], [share(1)]));
    expect(dump).not.toMatch(/quote|email|author/i);
  });

  it('says it is read-only', () => {
    expect(run([], []).readOnly).toBe(true);
  });
});

describe('runOrphanImageAudit', () => {
  const rows = [{ id: 's1', imageUrl: url(1), createdAt: '2026-09-01T00:00:00Z', revoked: false, bookExists: false, bookEligible: false }];

  const fakeDb = (over: { hasColumn?: boolean; hasOutbox?: boolean; outbox?: string[] } = {}) => {
    const sql: string[] = [];
    return {
      sql,
      query: jest.fn(async (q: string) => {
        sql.push(q);
        if (q.includes('information_schema')) return over.hasColumn === false ? [] : [{ '?column?': 1 }];
        if (q.includes('to_regclass')) return [{ present: over.hasOutbox !== false }];
        if (q.includes('FROM card_image_deletions')) return (over.outbox ?? []).map((k) => ({ key: k }));
        return rows;
      }),
    };
  };

  it('only ever runs SELECT statements', async () => {
    const db = fakeDb();
    await runOrphanImageAudit(db, async () => [obj(1)], { now: NOW, minAgeHours: 24 });
    for (const q of db.sql) expect(q.trim()).toMatch(/^SELECT/);
    expect(db.sql.join(' ')).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/);
  });

  it('classifies rows from the database against the listing', async () => {
    const r = await runOrphanImageAudit(fakeDb(), async () => [obj(1)], { now: NOW, minAgeHours: 24 });
    expect(r.keys.book_deleted).toEqual([key(1)]);
  });

  it('works before migration 068: no revokedAt column and no outbox', async () => {
    const db = fakeDb({ hasColumn: false, hasOutbox: false });
    const r = await runOrphanImageAudit(db, async () => [obj(1)], { now: NOW, minAgeHours: 24 });
    expect(db.sql.join(' ')).not.toContain('"revokedAt"');
    expect(db.sql.join(' ')).not.toContain('FROM card_image_deletions');
    expect(r.keys.book_deleted).toEqual([key(1)]);
  });

  it('honours the outbox', async () => {
    const r = await runOrphanImageAudit(fakeDb({ outbox: [key(1)] }), async () => [obj(1)], { now: NOW, minAgeHours: 24 });
    expect(r.keys.queued).toEqual([key(1)]);
  });
});
