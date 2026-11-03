import { isBookPubliclyEligible, qualityGateSql } from '../../../src/books/book-eligibility';

describe('qualityGateSql', () => {
  it('lets author uploads through and requires ≥90% sync coverage for ingested books', () => {
    const sql = qualityGateSql('b');
    expect(sql).toContain('b."uploadedById" IS NOT NULL');
    expect(sql).toContain('sm."bookId" = b.id');
    expect(sql).toContain('sm."syncCoverage" >= 0.90');
  });
});

describe('isBookPubliclyEligible', () => {
  const qb = { where: jest.fn(), andWhere: jest.fn(), getCount: jest.fn() };
  const repo = { createQueryBuilder: jest.fn(() => qb) };

  beforeEach(() => {
    jest.clearAllMocks();
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);
  });

  it('is true for a published book that passes the quality gate', async () => {
    qb.getCount.mockResolvedValue(1);
    await expect(isBookPubliclyEligible(repo as never, 'b1')).resolves.toBe(true);
    expect(qb.where).toHaveBeenCalledWith('book.id = :bookId', { bookId: 'b1' });
    expect(qb.andWhere).toHaveBeenCalledWith('book.isPublished = :published', { published: true });
    expect(qb.andWhere).toHaveBeenCalledWith(qualityGateSql('book'));
  });

  it('is false for an unpublished, culled or missing book', async () => {
    qb.getCount.mockResolvedValue(0);
    await expect(isBookPubliclyEligible(repo as never, 'b1')).resolves.toBe(false);
  });
});
