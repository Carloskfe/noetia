import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BooksService } from '../../../src/books/books.service';
import { Book, BookCategory } from '../../../src/books/book.entity';
import { CreateBookDto } from '../../../src/books/dto/create-book.dto';

const mockRepo = {
  find: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('BooksService', () => {
  let service: BooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: getRepositoryToken(Book), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all published books when no category is given', async () => {
      const books = [{ id: '1', isPublished: true }];
      mockRepo.find.mockResolvedValue(books);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { isPublished: true },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(books);
    });

    it('adds category to where clause when provided', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll(BookCategory.BUSINESS);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { isPublished: true, category: BookCategory.BUSINESS },
        order: { createdAt: 'DESC' },
      });
    });

    it('returns empty array when no books match', async () => {
      mockRepo.find.mockResolvedValue([]);
      expect(await service.findAll()).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the book when found', async () => {
      const book = { id: 'b-1', title: 'Test Book', isPublished: true };
      mockRepo.findOneBy.mockResolvedValue(book);
      expect(await service.findById('b-1')).toEqual(book);
    });

    it('throws NotFoundException when book does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findById('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const baseDto: CreateBookDto = {
      title: 'Mi Libro',
      author: 'Autor',
      category: BookCategory.LEADERSHIP,
      description: 'Una descripción',
    } as CreateBookDto;

    it('defaults language to "es" when not provided in dto', async () => {
      const built = { ...baseDto, language: 'es', isPublished: false };
      mockRepo.create.mockReturnValue(built);
      mockRepo.save.mockResolvedValue({ id: 'new-id', ...built });

      await service.create(baseDto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'es' }),
      );
    });

    it('uses dto.language when explicitly set', async () => {
      const dto = { ...baseDto, language: 'en' };
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '2' });

      await service.create(dto as CreateBookDto);

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
    });

    it('always creates with isPublished set to false', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '3' });

      await service.create(baseDto);

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isPublished: false }));
    });

    it('stores textFileKey when provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '4' });

      await service.create(baseDto, 'books/text.html');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ textFileKey: 'books/text.html' }),
      );
    });

    it('stores audioFileKey when provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '5' });

      await service.create(baseDto, undefined, 'audio/file.mp3');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ audioFileKey: 'audio/file.mp3' }),
      );
    });

    it('sets both file keys to null when not provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '6' });

      await service.create(baseDto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ textFileKey: null, audioFileKey: null }),
      );
    });
  });
});
