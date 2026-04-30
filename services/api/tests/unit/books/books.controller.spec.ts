import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from '../../../src/books/books.controller';
import { BooksService } from '../../../src/books/books.service';
import { StorageService } from '../../../src/storage/storage.service';
import { SyncMapService } from '../../../src/books/sync-map.service';
import { ReadingProgressService } from '../../../src/books/reading-progress.service';
import { FragmentsService } from '../../../src/fragments/fragments.service';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import { SubscriptionGuard } from '../../../src/subscriptions/subscription.guard';
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
};

const mockStorageService = { presign: jest.fn(), upload: jest.fn() };
const mockSyncMapService = { findByBook: jest.fn(), upsert: jest.fn() };
const mockProgressService = { findByUserAndBook: jest.fn(), upsert: jest.fn() };
const mockFragmentsService = { findByUserAndBook: jest.fn() };

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
        { provide: ReadingProgressService, useValue: mockProgressService },
        { provide: FragmentsService, useValue: mockFragmentsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SubscriptionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BooksController>(BooksController);
    jest.clearAllMocks();
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

    it('allows admin to create and auto-publishes the book', async () => {
      const book = { id: 'b-1', isPublished: true };
      mockBooksService.create.mockResolvedValue(book);

      const result = await controller.create({ user: adminUser }, dto, noFiles);

      expect(mockBooksService.create).toHaveBeenCalledWith(
        dto, undefined, undefined, 'admin-1', true,
      );
      expect(result).toEqual(book);
    });

    it('allows author user to create with isPublished=false (pending review)', async () => {
      const book = { id: 'b-2', isPublished: false };
      mockBooksService.create.mockResolvedValue(book);

      const result = await controller.create({ user: authorUser }, dto, noFiles);

      expect(mockBooksService.create).toHaveBeenCalledWith(
        dto, undefined, undefined, 'author-1', false,
      );
      expect(result).toEqual(book);
    });

    it('allows editorial user to create with isPublished=false', async () => {
      const editorialUser = { id: 'ed-1', isAdmin: false, userType: UserType.EDITORIAL };
      mockBooksService.create.mockResolvedValue({ id: 'b-3', isPublished: false });

      await controller.create({ user: editorialUser }, dto, noFiles);

      expect(mockBooksService.create).toHaveBeenCalledWith(
        dto, undefined, undefined, 'ed-1', false,
      );
    });

    it('throws ForbiddenException for personal users', async () => {
      await expect(controller.create({ user: personalUser }, dto, noFiles)).rejects.toThrow(ForbiddenException);
      expect(mockBooksService.create).not.toHaveBeenCalled();
    });
  });
});
