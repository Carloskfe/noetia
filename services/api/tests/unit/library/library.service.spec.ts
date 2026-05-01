import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Book } from '../../../src/books/book.entity';
import { LibraryService } from '../../../src/library/library.service';
import { UserBook } from '../../../src/library/user-book.entity';

const USER_ID = 'user-1';
const BOOK_ID = 'book-1';

const mockBook = { id: BOOK_ID, title: 'Test', isPublished: true } as Book;
const mockEntry = { id: 'ub-1', userId: USER_ID, bookId: BOOK_ID, book: mockBook } as UserBook;

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    existsBy: jest.fn(),
    ...overrides,
  };
}

function makeBookRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOneBy: jest.fn(),
    ...overrides,
  };
}

async function buildService(repoOverrides = {}, bookRepoOverrides = {}) {
  const module = await Test.createTestingModule({
    providers: [
      LibraryService,
      { provide: getRepositoryToken(UserBook), useValue: makeRepo(repoOverrides) },
      { provide: getRepositoryToken(Book), useValue: makeBookRepo(bookRepoOverrides) },
    ],
  }).compile();
  return {
    service: module.get(LibraryService),
    repo: module.get(getRepositoryToken(UserBook)),
    bookRepo: module.get(getRepositoryToken(Book)),
  };
}

describe('LibraryService', () => {
  describe('addBook', () => {
    it('inserts a new entry when book exists and is published', async () => {
      const { service, repo, bookRepo } = await buildService();
      bookRepo.findOneBy.mockResolvedValue(mockBook);
      repo.insert.mockResolvedValue({});

      await service.addBook(USER_ID, BOOK_ID);

      expect(repo.insert).toHaveBeenCalledWith({ userId: USER_ID, bookId: BOOK_ID });
    });

    it('throws NotFoundException when book does not exist', async () => {
      const { service, bookRepo } = await buildService();
      bookRepo.findOneBy.mockResolvedValue(null);

      await expect(service.addBook(USER_ID, BOOK_ID)).rejects.toThrow(NotFoundException);
    });

    it('silently succeeds on duplicate (unique constraint violation)', async () => {
      const { service, repo, bookRepo } = await buildService();
      bookRepo.findOneBy.mockResolvedValue(mockBook);
      repo.insert.mockRejectedValue({ code: '23505' });

      await expect(service.addBook(USER_ID, BOOK_ID)).resolves.toBeUndefined();
    });

    it('rethrows unexpected errors', async () => {
      const { service, repo, bookRepo } = await buildService();
      bookRepo.findOneBy.mockResolvedValue(mockBook);
      repo.insert.mockRejectedValue(new Error('db error'));

      await expect(service.addBook(USER_ID, BOOK_ID)).rejects.toThrow('db error');
    });
  });

  describe('removeBook', () => {
    it('deletes the user-book entry', async () => {
      const { service, repo } = await buildService();
      repo.delete.mockResolvedValue({ affected: 1 });

      await service.removeBook(USER_ID, BOOK_ID);

      expect(repo.delete).toHaveBeenCalledWith({ userId: USER_ID, bookId: BOOK_ID });
    });

    it('does not throw when entry does not exist', async () => {
      const { service, repo } = await buildService();
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.removeBook(USER_ID, BOOK_ID)).resolves.toBeUndefined();
    });
  });

  describe('getUserLibrary', () => {
    it('returns books from user entries ordered by addedAt', async () => {
      const { service, repo } = await buildService();
      repo.find.mockResolvedValue([mockEntry]);

      const result = await service.getUserLibrary(USER_ID);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        relations: ['book'],
        order: { addedAt: 'DESC' },
      });
      expect(result).toEqual([mockBook]);
    });

    it('returns empty array when user has no books', async () => {
      const { service, repo } = await buildService();
      repo.find.mockResolvedValue([]);

      const result = await service.getUserLibrary(USER_ID);

      expect(result).toEqual([]);
    });

    it('filters out null book relations', async () => {
      const { service, repo } = await buildService();
      repo.find.mockResolvedValue([{ ...mockEntry, book: null }]);

      const result = await service.getUserLibrary(USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe('getUserBookIds', () => {
    it('returns array of bookIds for the user', async () => {
      const { service, repo } = await buildService();
      repo.find.mockResolvedValue([{ bookId: BOOK_ID }]);

      const result = await service.getUserBookIds(USER_ID);

      expect(result).toEqual([BOOK_ID]);
    });
  });

  describe('hasBook', () => {
    it('returns true when entry exists', async () => {
      const { service, repo } = await buildService();
      repo.existsBy.mockResolvedValue(true);

      const result = await service.hasBook(USER_ID, BOOK_ID);

      expect(result).toBe(true);
      expect(repo.existsBy).toHaveBeenCalledWith({ userId: USER_ID, bookId: BOOK_ID });
    });

    it('returns false when entry does not exist', async () => {
      const { service, repo } = await buildService();
      repo.existsBy.mockResolvedValue(false);

      const result = await service.hasBook(USER_ID, BOOK_ID);

      expect(result).toBe(false);
    });
  });
});
