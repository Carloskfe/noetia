import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthorsService } from '../../../src/authors/authors.service';
import { Book, BookCategory } from '../../../src/books/book.entity';

const mockBooksRepo = {
  find: jest.fn(),
};

describe('AuthorsService', () => {
  let service: AuthorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorsService,
        { provide: getRepositoryToken(Book), useValue: mockBooksRepo },
      ],
    }).compile();

    service = module.get<AuthorsService>(AuthorsService);
    jest.clearAllMocks();
  });

  describe('findMyBooks', () => {
    it('returns books belonging to the given user', async () => {
      const books = [
        { id: 'b-1', title: 'Mi Libro', uploadedById: 'user-1' },
      ];
      mockBooksRepo.find.mockResolvedValue(books);

      const result = await service.findMyBooks('user-1');

      expect(mockBooksRepo.find).toHaveBeenCalledWith({
        where: { uploadedById: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(books);
    });

    it('returns empty array when user has no books', async () => {
      mockBooksRepo.find.mockResolvedValue([]);
      const result = await service.findMyBooks('user-with-no-books');
      expect(result).toEqual([]);
    });

    it('passes a different userId for a different user', async () => {
      mockBooksRepo.find.mockResolvedValue([]);
      await service.findMyBooks('user-2');
      expect(mockBooksRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { uploadedById: 'user-2' } }),
      );
    });
  });
});
