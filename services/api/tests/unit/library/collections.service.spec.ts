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

const mockBook = { id: 'book-1', title: 'Génesis' } as Book;
const mockEntry = { book: mockBook, position: 1 } as BookCollection;

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
          countBy: jest.fn(),
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
  it('returns summary list with book counts', async () => {
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.find.mockResolvedValue([mockCollection]);
    bcRepo.countBy.mockResolvedValue(17);

    const result = await service.findAll();

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('biblia-reina-valera');
    expect(result[0].bookCount).toBe(17);
  });

  it('returns empty array when no collections exist', async () => {
    const { service, collRepo } = await buildService();
    collRepo.find.mockResolvedValue([]);

    const result = await service.findAll();

    expect(result).toEqual([]);
  });
});

describe('CollectionsService.findBySlug', () => {
  it('returns collection with ordered books', async () => {
    const { service, collRepo, bcRepo } = await buildService();
    collRepo.findOneBy.mockResolvedValue(mockCollection);
    bcRepo.find.mockResolvedValue([mockEntry]);

    const result = await service.findBySlug('biblia-reina-valera');

    expect(result.slug).toBe('biblia-reina-valera');
    expect(result.books).toHaveLength(1);
    expect(result.books[0].title).toBe('Génesis');
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
});
