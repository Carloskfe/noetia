import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Book } from '../../../src/books/book.entity';
import { LibraryService } from '../../../src/library/library.service';
import { UserBook } from '../../../src/library/user-book.entity';

const USER_ID = 'user-1';
const BOOK_ID = 'book-1';

const mockBook = { id: BOOK_ID, title: 'Test', isPublished: true, isFree: true } as Book;
const mockPaidBook = { id: BOOK_ID, title: 'Paid', isPublished: true, isFree: false } as Book;
const mockEntry = { id: 'ub-1', userId: USER_ID, bookId: BOOK_ID, book: mockBook } as UserBook;

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
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
    it('inserts a free-library entry when the book is published and free', async () => {
      const { service, repo, bookRepo } = await buildService();
      bookRepo.findOneBy.mockResolvedValue(mockBook);
      repo.insert.mockResolvedValue({});

      await service.addBook(USER_ID, BOOK_ID);

      expect(repo.insert).toHaveBeenCalledWith({ userId: USER_ID, bookId: BOOK_ID, purchaseType: 'free' });
    });

    it('rejects a paid book with acquisition_required and writes nothing (NEM-011)', async () => {
      const { service, repo, bookRepo } = await buildService();
      bookRepo.findOneBy.mockResolvedValue(mockPaidBook);

      await expect(service.addBook(USER_ID, BOOK_ID)).rejects.toThrow(ForbiddenException);
      await expect(service.addBook(USER_ID, BOOK_ID)).rejects.toMatchObject({
        response: { error: 'acquisition_required' },
      });
      expect(repo.insert).not.toHaveBeenCalled();
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
    it('deletes a free-library entry', async () => {
      const { service, repo } = await buildService();
      repo.findOne.mockResolvedValue({ ...mockEntry, purchaseType: 'free', book: mockBook });
      repo.delete.mockResolvedValue({ affected: 1 });

      await service.removeBook(USER_ID, BOOK_ID);

      expect(repo.delete).toHaveBeenCalledWith({ userId: USER_ID, bookId: BOOK_ID });
    });

    it('does not throw when entry does not exist', async () => {
      const { service, repo } = await buildService();
      repo.findOne.mockResolvedValue(null);

      await expect(service.removeBook(USER_ID, BOOK_ID)).resolves.toBeUndefined();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it.each(['token', 'purchase', 'courtesy'])('never deletes %s-acquired ownership (NEM-011)', async (purchaseType) => {
      const { service, repo } = await buildService();
      repo.findOne.mockResolvedValue({ ...mockEntry, purchaseType, book: mockPaidBook });

      await expect(service.removeBook(USER_ID, BOOK_ID)).rejects.toThrow(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('never deletes a free-typed row on a paid book (pre-NEM-011 rows are preserved)', async () => {
      const { service, repo } = await buildService();
      repo.findOne.mockResolvedValue({ ...mockEntry, purchaseType: 'free', book: mockPaidBook });

      await expect(service.removeBook(USER_ID, BOOK_ID)).rejects.toThrow(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
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
