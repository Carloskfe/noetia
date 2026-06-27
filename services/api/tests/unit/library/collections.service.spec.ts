import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Book } from '../../../src/books/book.entity';
import { BookCollection } from '../../../src/library/book-collection.entity';
import { Collection } from '../../../src/library/collection.entity';
import { CollectionsService } from '../../../src/library/collections.service';

const mockCollection = {
  id: 'col-1',
  name: 'Biblia Reina-Valera',
  slug: 'biblia-reina-valera',
  description: null,
  coverUrl: null,
  createdAt: new Date(),
} as Collection;

const makeFreeBook = (id = 'book-1', title = 'Génesis') =>
  ({ id, title, isPublished: true, isFree: true }) as Book;

const makePaidBook = (id = 'book-p', title = 'Paid Book') =>
  ({ id, title, isPublished: true, isFree: false }) as Book;

// QueryBuilder mock for bcRepo.createQueryBuilder(...).innerJoin...getCount()
const makeQb = (count: number) => {
  const qb: Record<string, jest.Mock> = {
    innerJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getCount: jest.fn().mockResolvedValue(count),
  };
  Object.keys(qb).forEach((k) => {
    if (k !== 'getCount') qb[k].mockReturnValue(qb);
  });
  return qb;
};

async function buildService(collOverrides = {}, bcOverrides = {}) {
  const module = await Test.createTestingModule({
    providers: [
      CollectionsService,
      {
        provide: getRepositoryToken(Collection),
        useValue: {
          find: jest.fn(),
          findOneBy: jest.fn(),
          create: jest.fn(),
          save: jest.fn(),
          update: jest.fn(),
          ...collOverrides,
        },
      },
      {
        provide: getRepositoryToken(BookCollection),
        useValue: {
          find: jest.fn(),
          createQueryBuilder: jest.fn(),
          query: jest.fn(),
          delete: jest.fn(),
          save: jest.fn(),
          create: jest.fn((v) => v),
          ...bcOverrides,
        },
      },
    ],
  }).compile();
  return {
    service: module.get(CollectionsService),
    collRepo: module.get(getRepositoryToken(Collection)),
    bcRepo: module.get(getRepositoryToken(BookCollection)),
  };
}

describe('CollectionsService.findAll', () => {
  it('returns summary list with quality-passing book count', async () => {
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.find.mockResolvedValue([mockCollection]);
    bcRepo.createQueryBuilder.mockReturnValue(makeQb(10));

    const result = await service.findAll();

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('biblia-reina-valera');
    expect(result[0].bookCount).toBe(10);
  });

  it('hides collections with zero quality-passing books', async () => {
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.find.mockResolvedValue([mockCollection]);
    bcRepo.createQueryBuilder.mockReturnValue(makeQb(0));

    const result = await service.findAll();

    expect(result).toHaveLength(0);
  });

  it('returns empty array when no collections exist', async () => {
    const { service, collRepo } = await buildService();
    collRepo.find.mockResolvedValue([]);

    const result = await service.findAll();

    expect(result).toEqual([]);
  });

  it('applies quality gate via createQueryBuilder on bcRepo', async () => {
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.find.mockResolvedValue([mockCollection]);
    const qb = makeQb(5);
    bcRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll();

    expect(bcRepo.createQueryBuilder).toHaveBeenCalledWith('bc');
    // andWhere must include the syncCoverage threshold
    const syncCall = (qb.andWhere.mock.calls as unknown[][]).find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('syncCoverage'),
    );
    expect(syncCall).toBeDefined();
  });
});

describe('CollectionsService.findBySlug', () => {
  it('returns quality-passing free books within a collection', async () => {
    const freeBook = makeFreeBook();
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.findOneBy.mockResolvedValue(mockCollection);
    bcRepo.find.mockResolvedValue([{ book: freeBook, position: 1 } as BookCollection]);
    // quality gate query returns count = 1 → book passes
    bcRepo.query.mockResolvedValue([{ count: '1' }]);

    const result = await service.findBySlug('biblia-reina-valera');

    expect(result.slug).toBe('biblia-reina-valera');
    expect(result.books).toHaveLength(1);
    expect(result.books[0].title).toBe('Génesis');
  });

  it('filters out free books that fail the quality gate', async () => {
    const freeBook = makeFreeBook();
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.findOneBy.mockResolvedValue(mockCollection);
    bcRepo.find.mockResolvedValue([{ book: freeBook, position: 1 } as BookCollection]);
    // quality gate query returns count = 0 → book fails
    bcRepo.query.mockResolvedValue([{ count: '0' }]);

    const result = await service.findBySlug('biblia-reina-valera');

    expect(result.books).toHaveLength(0);
    expect(result.bookCount).toBe(0);
  });

  it('always includes paid books regardless of sync coverage', async () => {
    const paidBook = makePaidBook();
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.findOneBy.mockResolvedValue(mockCollection);
    bcRepo.find.mockResolvedValue([{ book: paidBook, position: 1 } as BookCollection]);

    const result = await service.findBySlug('biblia-reina-valera');

    // query() should NOT have been called for paid books
    expect(bcRepo.query).not.toHaveBeenCalled();
    expect(result.books).toHaveLength(1);
  });

  it('throws NotFoundException for unknown slug', async () => {
    const { service, collRepo } = await buildService();
    collRepo.findOneBy.mockResolvedValue(null);

    await expect(service.findBySlug('unknown')).rejects.toThrow(NotFoundException);
  });

  it('filters out null book relations', async () => {
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.findOneBy.mockResolvedValue(mockCollection);
    bcRepo.find.mockResolvedValue([{ book: null, position: 1 }]);

    const result = await service.findBySlug('biblia-reina-valera');

    expect(result.books).toHaveLength(0);
  });

  it('filters out unpublished books', async () => {
    const unpublished = { id: 'b-2', title: 'Draft', isPublished: false, isFree: true } as Book;
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.findOneBy.mockResolvedValue(mockCollection);
    bcRepo.find.mockResolvedValue([{ book: unpublished, position: 1 } as BookCollection]);

    const result = await service.findBySlug('biblia-reina-valera');

    expect(result.books).toHaveLength(0);
  });
});

describe('CollectionsService.upsertCollection', () => {
  it('creates a new collection when slug does not exist', async () => {
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.findOneBy.mockResolvedValue(null);
    collRepo.create.mockReturnValue(mockCollection);
    collRepo.save.mockResolvedValue(mockCollection);
    bcRepo.delete.mockResolvedValue({});
    bcRepo.save.mockResolvedValue({});

    await service.upsertCollection('biblia-reina-valera', 'Biblia Reina-Valera', null, null, [
      { bookId: 'book-1', position: 1 },
    ]);

    expect(collRepo.create).toHaveBeenCalled();
    expect(collRepo.save).toHaveBeenCalled();
    expect(bcRepo.save).toHaveBeenCalledTimes(1);
  });

  it('updates existing collection and replaces book entries', async () => {
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.findOneBy.mockResolvedValue(mockCollection);
    collRepo.update.mockResolvedValue({});
    bcRepo.delete.mockResolvedValue({});
    bcRepo.save.mockResolvedValue({});

    await service.upsertCollection('biblia-reina-valera', 'Biblia Reina-Valera', null, null, [
      { bookId: 'book-1', position: 1 },
      { bookId: 'book-2', position: 2 },
    ]);

    expect(collRepo.update).toHaveBeenCalled();
    expect(bcRepo.delete).toHaveBeenCalledWith({ collectionId: mockCollection.id });
    expect(bcRepo.save).toHaveBeenCalledTimes(2);
  });

  it('saves each book position in order', async () => {
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.findOneBy.mockResolvedValue(null);
    collRepo.create.mockReturnValue(mockCollection);
    collRepo.save.mockResolvedValue(mockCollection);
    bcRepo.delete.mockResolvedValue({});
    bcRepo.save.mockResolvedValue({});

    await service.upsertCollection('test', 'Test', null, null, [
      { bookId: 'b-1', position: 1 },
      { bookId: 'b-2', position: 2 },
      { bookId: 'b-3', position: 3 },
    ]);

    expect(bcRepo.save).toHaveBeenCalledTimes(3);
  });
});
