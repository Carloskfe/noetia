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
  remove: jest.fn(),
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

    it('adds isFree=true to where clause when isFree is true', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll(undefined, true);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { isPublished: true, isFree: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('adds isFree=false to where clause when isFree is false', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll(undefined, false);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { isPublished: true, isFree: false },
        order: { createdAt: 'DESC' },
      });
    });

    it('omits isFree from where clause when isFree is undefined', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll(undefined, undefined);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { isPublished: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('combines category and isFree filters together', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll(BookCategory.CLASSIC, true);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { isPublished: true, category: BookCategory.CLASSIC, isFree: true },
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

  describe('findPending', () => {
    it('returns books where isPublished is false with uploadedBy relation', async () => {
      const pending = [{ id: 'b-1', isPublished: false, uploadedBy: { id: 'u-1' } }];
      mockRepo.find.mockResolvedValue(pending);

      const result = await service.findPending();

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { isPublished: false },
        relations: ['uploadedBy'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(pending);
    });

    it('returns empty array when there are no pending books', async () => {
      mockRepo.find.mockResolvedValue([]);
      expect(await service.findPending()).toEqual([]);
    });
  });

  describe('publish', () => {
    it('sets isPublished to true and saves the book', async () => {
      const book = { id: 'b-1', isPublished: false };
      const saved = { ...book, isPublished: true };
      mockRepo.findOneBy.mockResolvedValue(book);
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.publish('b-1');

      expect(book.isPublished).toBe(true);
      expect(mockRepo.save).toHaveBeenCalledWith(book);
      expect(result).toEqual(saved);
    });

    it('throws NotFoundException when book does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.publish('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the book from the repository', async () => {
      const book = { id: 'b-1', title: 'To Delete' };
      mockRepo.findOneBy.mockResolvedValue(book);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.remove('b-1');

      expect(mockRepo.remove).toHaveBeenCalledWith(book);
    });

    it('throws NotFoundException when book does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
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

    it('defaults isPublished to false', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '3' });

      await service.create(baseDto);

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isPublished: false }));
    });

    it('creates with isPublished=true when passed', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '4', isPublished: true });

      await service.create(baseDto, undefined, undefined, undefined, true);

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isPublished: true }));
    });

    it('stores uploadedById when provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '5' });

      await service.create(baseDto, undefined, undefined, 'user-99');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ uploadedById: 'user-99' }),
      );
    });

    it('sets uploadedById to null when not provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '6' });

      await service.create(baseDto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ uploadedById: null }),
      );
    });

    it('stores textFileKey when provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '7' });

      await service.create(baseDto, 'books/text.html');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ textFileKey: 'books/text.html' }),
      );
    });

    it('stores audioFileKey when provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '8' });

      await service.create(baseDto, undefined, 'audio/file.mp3');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ audioFileKey: 'audio/file.mp3' }),
      );
    });

    it('sets both file keys to null when not provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '9' });

      await service.create(baseDto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ textFileKey: null, audioFileKey: null }),
      );
    });
  });
});
