import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BooksService } from '../../../src/books/books.service';
import { Book, BookCategory } from '../../../src/books/book.entity';
import { CreateBookDto } from '../../../src/books/dto/create-book.dto';
import { HostingTier, User } from '../../../src/users/user.entity';

// QueryBuilder mock — each method returns `this` for chaining; getMany returns books
const makeQb = (books: unknown[] = []) => {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    getMany: jest.fn().mockResolvedValue(books),
  };
  // Make every method return the same qb so chaining works
  Object.keys(qb).forEach((k) => {
    if (k !== 'getMany') qb[k].mockReturnValue(qb);
  });
  return qb;
};

const mockRepo = {
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
};

const mockUserRepo = {
  findOneBy: jest.fn(),
};

describe('BooksService', () => {
  let service: BooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: getRepositoryToken(Book), useValue: mockRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('excludes collection books by default (standalone=true)', async () => {
      const books = [{ id: '1', isPublished: true, collection: null }];
      const qb = makeQb(books);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll();

      expect(qb.andWhere).toHaveBeenCalledWith(
        'NOT EXISTS (SELECT 1 FROM book_collections bc WHERE bc."bookId" = book.id)',
      );
      expect(result).toEqual(books);
    });

    it('includes collection books when standalone=false', async () => {
      const qb = makeQb([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(undefined, undefined, false);
      const standaloneCall = qb.andWhere.mock.calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('collection'),
      );
      expect(standaloneCall).toBeUndefined();
    });

    it('adds category filter when provided', async () => {
      const qb = makeQb([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(BookCategory.BUSINESS);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'book.category = :category',
        { category: BookCategory.BUSINESS },
      );
    });

    it('adds isFree=true filter when isFree is true', async () => {
      const qb = makeQb([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(undefined, true);
      expect(qb.andWhere).toHaveBeenCalledWith('book.isFree = :isFree', { isFree: true });
    });

    it('adds isFree=false filter when isFree is false', async () => {
      const qb = makeQb([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(undefined, false);
      expect(qb.andWhere).toHaveBeenCalledWith('book.isFree = :isFree', { isFree: false });
    });

    it('does not add isFree filter when isFree is undefined', async () => {
      const qb = makeQb([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(undefined, undefined);
      const freeCalls = qb.andWhere.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('isFree'),
      );
      expect(freeCalls).toHaveLength(0);
    });

    it('combines category and isFree filters', async () => {
      const qb = makeQb([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(BookCategory.CLASSIC, true);
      expect(qb.andWhere).toHaveBeenCalledWith('book.category = :category', { category: BookCategory.CLASSIC });
      expect(qb.andWhere).toHaveBeenCalledWith('book.isFree = :isFree', { isFree: true });
    });

    it('returns empty array when no books match', async () => {
      const qb = makeQb([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      expect(await service.findAll()).toEqual([]);
    });

    it('includes collection books and excludes standalone filter when standalone=false', async () => {
      const qb = makeQb([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(undefined, undefined, false);
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('collection'),
        expect.anything(),
      );
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

  describe('checkUploadQuota', () => {
    it('allows upload when count is below the BASIC tier limit', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({ hostingTier: HostingTier.BASIC });
      mockRepo.count.mockResolvedValue(0);

      await expect(service.checkUploadQuota('user-1')).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when BASIC tier limit (1 book) is reached', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({ hostingTier: HostingTier.BASIC });
      mockRepo.count.mockResolvedValue(1);

      await expect(service.checkUploadQuota('user-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows upload when count is below the STARTER tier limit', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({ hostingTier: HostingTier.STARTER });
      mockRepo.count.mockResolvedValue(2);

      await expect(service.checkUploadQuota('user-1')).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when STARTER tier limit (3 books) is reached', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({ hostingTier: HostingTier.STARTER });
      mockRepo.count.mockResolvedValue(3);

      await expect(service.checkUploadQuota('user-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows upload when count is below the PRO tier limit', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({ hostingTier: HostingTier.PRO });
      mockRepo.count.mockResolvedValue(11);

      await expect(service.checkUploadQuota('user-1')).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when PRO tier limit (12 books) is reached', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({ hostingTier: HostingTier.PRO });
      mockRepo.count.mockResolvedValue(12);

      await expect(service.checkUploadQuota('user-1')).rejects.toThrow(ForbiddenException);
    });

    it('defaults to BASIC tier when user is not found', async () => {
      mockUserRepo.findOneBy.mockResolvedValue(null);
      mockRepo.count.mockResolvedValue(1);

      await expect(service.checkUploadQuota('unknown-user')).rejects.toThrow(ForbiddenException);
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

    it('stores textFileSizeBytes and audioFileSizeBytes when provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '10' });

      await service.create(baseDto, 'text.html', 'audio.mp3', 'u-1', false, 1024, 2048);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ textFileSizeBytes: 1024, audioFileSizeBytes: 2048 }),
      );
    });

    it('sets file size bytes to null when not provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({ id: '11' });

      await service.create(baseDto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ textFileSizeBytes: null, audioFileSizeBytes: null }),
      );
    });
  });
});
