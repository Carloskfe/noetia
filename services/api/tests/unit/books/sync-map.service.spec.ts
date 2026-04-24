import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SyncMapService } from '../../../src/books/sync-map.service';
import { SyncMap, SyncPhrase } from '../../../src/books/sync-map.entity';
import { BooksService } from '../../../src/books/books.service';

const samplePhrases: SyncPhrase[] = [
  { index: 0, text: 'Hello world.', startTime: 0, endTime: 2.5 },
  { index: 1, text: 'This is a test.', startTime: 2.5, endTime: 5.0 },
];

const mockRepo = {
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockBooksService = {
  findById: jest.fn(),
};

describe('SyncMapService', () => {
  let service: SyncMapService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncMapService,
        { provide: getRepositoryToken(SyncMap), useValue: mockRepo },
        { provide: BooksService, useValue: mockBooksService },
      ],
    }).compile();

    service = module.get<SyncMapService>(SyncMapService);
    jest.clearAllMocks();
  });

  describe('findByBook', () => {
    it('returns the sync map when one exists for the book', async () => {
      const syncMap = { id: 'sm-1', bookId: 'b-1', phrases: samplePhrases };
      mockRepo.findOneBy.mockResolvedValue(syncMap);

      const result = await service.findByBook('b-1');

      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ bookId: 'b-1' });
      expect(result).toEqual(syncMap);
    });

    it('returns null when no sync map exists for the book', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      const result = await service.findByBook('missing-book');

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('creates a new sync map when none exists', async () => {
      mockBooksService.findById.mockResolvedValue({ id: 'b-1' });
      mockRepo.findOneBy.mockResolvedValue(null);
      const created = { id: 'sm-new', bookId: 'b-1', phrases: samplePhrases };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.upsert('b-1', samplePhrases);

      expect(mockRepo.create).toHaveBeenCalledWith({ bookId: 'b-1', phrases: samplePhrases });
      expect(mockRepo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });

    it('updates phrases when a sync map already exists', async () => {
      mockBooksService.findById.mockResolvedValue({ id: 'b-1' });
      const existing = { id: 'sm-1', bookId: 'b-1', phrases: [], updatedAt: new Date('2024-01-01') };
      mockRepo.findOneBy.mockResolvedValue(existing);
      const updated = { ...existing, phrases: samplePhrases };
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.upsert('b-1', samplePhrases);

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(existing.phrases).toEqual(samplePhrases);
      expect(mockRepo.save).toHaveBeenCalledWith(existing);
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when the book does not exist', async () => {
      mockBooksService.findById.mockRejectedValue(new NotFoundException('Book not found'));

      await expect(service.upsert('missing-id', samplePhrases)).rejects.toThrow(NotFoundException);
      expect(mockRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('propagates repository errors on save', async () => {
      mockBooksService.findById.mockResolvedValue({ id: 'b-1' });
      mockRepo.findOneBy.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.upsert('b-1', samplePhrases)).rejects.toThrow('DB error');
    });
  });
});
