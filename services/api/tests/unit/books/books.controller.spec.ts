import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from '../../../src/books/books.controller';
import { BooksService } from '../../../src/books/books.service';
import { StorageService } from '../../../src/storage/storage.service';
import { SyncMapService } from '../../../src/books/sync-map.service';
import { SrtParserService } from '../../../src/books/srt-parser.service';
import { UploadCodesService } from '../../../src/codes/upload-codes.service';
import { ReadingProgressService } from '../../../src/books/reading-progress.service';
import { FragmentsService } from '../../../src/fragments/fragments.service';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import { SubscriptionGuard } from '../../../src/subscriptions/subscription.guard';
import { SearchService } from '../../../src/search/search.service';
import { BookCategory } from '../../../src/books/book.entity';
import { CreateBookDto } from '../../../src/books/dto/create-book.dto';
import { UserType } from '../../../src/users/user.entity';

const mockBooksService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findPending: jest.fn(),
  publish: jest.fn(),
  remove: jest.fn(),
  create: jest.fn(),
  checkUploadQuota: jest.fn(),
};

const mockStorageService = { presign: jest.fn(), upload: jest.fn() };
const mockSyncMapService = { findByBook: jest.fn(), upsert: jest.fn() };
const mockSrtParserService = { parse: jest.fn() };
const mockUploadCodesService = { validate: jest.fn(), consume: jest.fn() };
const mockProgressService = { findByUserAndBook: jest.fn(), upsert: jest.fn() };
const mockFragmentsService = { findByUserAndBook: jest.fn() };
const mockSearchService = { indexBook: jest.fn().mockResolvedValue(undefined), removeBook: jest.fn().mockResolvedValue(undefined) };

const adminUser = { id: 'admin-1', isAdmin: true, userType: null };
const authorUser = { id: 'author-1', isAdmin: false, userType: UserType.AUTHOR };
const personalUser = { id: 'user-1', isAdmin: false, userType: UserType.PERSONAL };

describe('BooksController', () => {
  let controller: BooksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        { provide: BooksService, useValue: mockBooksService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: SyncMapService, useValue: mockSyncMapService },
        { provide: SrtParserService, useValue: mockSrtParserService },
        { provide: UploadCodesService, useValue: mockUploadCodesService },
        { provide: ReadingProgressService, useValue: mockProgressService },
        { provide: FragmentsService, useValue: mockFragmentsService },
        { provide: SearchService, useValue: mockSearchService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SubscriptionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BooksController>(BooksController);
    jest.clearAllMocks();
    mockBooksService.checkUploadQuota.mockResolvedValue(undefined);
  });

  describe('GET /books/:id', () => {
    it('presigns audio with a long (12h) TTL and text with the short (15m) TTL', async () => {
      mockBooksService.findById.mockResolvedValue({
        id: 'b-1',
        textFileKey: 'books/x.html',
        audioFileKey: 'audio/x.mp3',
        audioStreamKey: 'audio/x-stream.mp3',
      });
      mockStorageService.presign.mockResolvedValue('signed-url');

      await controller.findOne('b-1');

      // Text is downloaded once, quickly → short TTL is fine.
      expect(mockStorageService.presign).toHaveBeenCalledWith('books', 'books/x.html', 900);
      // Audio plays for hours → the URL must outlast a listening session, else
      // the reader restarts from 0 when it expires mid-listen.
      expect(mockStorageService.presign).toHaveBeenCalledWith('audio', 'audio/x.mp3', 43200);
      expect(mockStorageService.presign).toHaveBeenCalledWith('audio', 'audio/x-stream.mp3', 43200);
    });

    it('leaves full http audio URLs untouched (no presign)', async () => {
      mockBooksService.findById.mockResolvedValue({
        id: 'b-2',
        textFileKey: null,
        audioFileKey: null,
        audioStreamKey: 'https://cdn.example.com/stream.mp3',
      });

      const res = await controller.findOne('b-2');

      expect(res.audioStreamUrl).toBe('https://cdn.example.com/stream.mp3');
      expect(mockStorageService.presign).not.toHaveBeenCalledWith('audio', expect.stringContaining('http'), expect.anything());
    });
  });

  describe('GET /books', () => {
    it('forwards the search term and parsed limit to the service', async () => {
      const books = [{ id: 'b-1', title: 'La Odisea' }];
      mockBooksService.findAll.mockResolvedValue(books);

      const result = await controller.findAll(undefined, undefined, undefined, 'odisea', '8');

      // category, isFree(undefined), standalone(true), search, limit(8)
      expect(mockBooksService.findAll).toHaveBeenCalledWith(undefined, undefined, true, 'odisea', 8);
      expect(result).toEqual(books);
    });

    it('passes undefined limit when none is provided', async () => {
      mockBooksService.findAll.mockResolvedValue([]);
      await controller.findAll(undefined, undefined, undefined, 'x');
      expect(mockBooksService.findAll).toHaveBeenCalledWith(undefined, undefined, true, 'x', undefined);
    });

    it('caps the limit at 50', async () => {
      mockBooksService.findAll.mockResolvedValue([]);
      await controller.findAll(undefined, undefined, undefined, 'x', '999');
      expect(mockBooksService.findAll).toHaveBeenCalledWith(undefined, undefined, true, 'x', 50);
    });

    it('treats includeCollections=true as non-standalone', async () => {
      mockBooksService.findAll.mockResolvedValue([]);
      await controller.findAll(undefined, undefined, 'true', 'x');
      expect(mockBooksService.findAll).toHaveBeenCalledWith(undefined, undefined, false, 'x', undefined);
    });
  });

  describe('GET /books/pending', () => {
    it('returns pending books for admin', async () => {
      const pending = [{ id: 'b-1', isPublished: false }];
      mockBooksService.findPending.mockResolvedValue(pending);

      const result = await controller.getPending({ user: adminUser });

      expect(mockBooksService.findPending).toHaveBeenCalled();
      expect(result).toEqual(pending);
    });

    it('throws ForbiddenException for non-admin users', async () => {
      await expect(controller.getPending({ user: personalUser })).rejects.toThrow(ForbiddenException);
      expect(mockBooksService.findPending).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /books/:id/publish', () => {
    it('publishes a book when called by admin', async () => {
      const published = { id: 'b-1', isPublished: true };
      mockBooksService.publish.mockResolvedValue(published);

      const result = await controller.publish('b-1', { user: adminUser });

      expect(mockBooksService.publish).toHaveBeenCalledWith('b-1');
      expect(result).toEqual(published);
    });

    it('throws ForbiddenException for non-admin users', async () => {
      await expect(controller.publish('b-1', { user: personalUser })).rejects.toThrow(ForbiddenException);
      expect(mockBooksService.publish).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /books/:id', () => {
    it('removes a book when called by admin', async () => {
      mockBooksService.remove.mockResolvedValue(undefined);
      await controller.remove('b-1', { user: adminUser });
      expect(mockBooksService.remove).toHaveBeenCalledWith('b-1');
    });

    it('throws ForbiddenException for non-admin users', async () => {
      await expect(controller.remove('b-1', { user: personalUser })).rejects.toThrow(ForbiddenException);
      expect(mockBooksService.remove).not.toHaveBeenCalled();
    });
  });

  describe('POST /books', () => {
    const dto: CreateBookDto = {
      title: 'Test',
      author: 'Author',
      category: BookCategory.CLASSIC,
    } as CreateBookDto;

    const noFiles = { textFile: undefined, audioFile: undefined };

    it('allows admin to create and auto-publishes the book without quota check', async () => {
      const book = { id: 'b-1', isPublished: true };
      mockBooksService.create.mockResolvedValue(book);

      const result = await controller.create({ user: adminUser }, dto, noFiles);

      expect(mockBooksService.checkUploadQuota).not.toHaveBeenCalled();
      expect(mockBooksService.create).toHaveBeenCalledWith(
        dto, undefined, undefined, 'admin-1', true, undefined, undefined,
      );
      expect(result).toEqual(book);
    });

    it('allows author user to create with isPublished=false (pending review)', async () => {
      const book = { id: 'b-2', isPublished: false };
      mockBooksService.create.mockResolvedValue(book);

      const result = await controller.create({ user: authorUser }, dto, noFiles);

      expect(mockBooksService.checkUploadQuota).toHaveBeenCalledWith('author-1');
      expect(mockBooksService.create).toHaveBeenCalledWith(
        dto, undefined, undefined, 'author-1', false, undefined, undefined,
      );
      expect(result).toEqual(book);
    });

    it('allows editorial user to create with isPublished=false', async () => {
      const editorialUser = { id: 'ed-1', isAdmin: false, userType: UserType.EDITORIAL };
      mockBooksService.create.mockResolvedValue({ id: 'b-3', isPublished: false });

      await controller.create({ user: editorialUser }, dto, noFiles);

      expect(mockBooksService.checkUploadQuota).toHaveBeenCalledWith('ed-1');
      expect(mockBooksService.create).toHaveBeenCalledWith(
        dto, undefined, undefined, 'ed-1', false, undefined, undefined,
      );
    });

    it('throws ForbiddenException for personal users', async () => {
      await expect(controller.create({ user: personalUser }, dto, noFiles)).rejects.toThrow(ForbiddenException);
      expect(mockBooksService.checkUploadQuota).not.toHaveBeenCalled();
      expect(mockBooksService.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when author quota is exceeded', async () => {
      mockBooksService.checkUploadQuota.mockRejectedValue(new ForbiddenException('quota exceeded'));

      await expect(controller.create({ user: authorUser }, dto, noFiles)).rejects.toThrow(ForbiddenException);
      expect(mockBooksService.create).not.toHaveBeenCalled();
    });
  });
});
