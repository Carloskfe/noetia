import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReadingProgressService } from '../../../src/books/reading-progress.service';
import { ReadingProgress } from '../../../src/books/reading-progress.entity';

const mockRepo = {
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('ReadingProgressService', () => {
  let service: ReadingProgressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingProgressService,
        { provide: getRepositoryToken(ReadingProgress), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ReadingProgressService>(ReadingProgressService);
    jest.clearAllMocks();
  });

  describe('findByUserAndBook', () => {
    it('returns the progress record when it exists', async () => {
      const record = { id: 'rp-1', userId: 'u-1', bookId: 'b-1', phraseIndex: 42 };
      mockRepo.findOneBy.mockResolvedValue(record);

      const result = await service.findByUserAndBook('u-1', 'b-1');

      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ userId: 'u-1', bookId: 'b-1' });
      expect(result).toEqual(record);
    });

    it('returns null when no record exists (first visit)', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      const result = await service.findByUserAndBook('u-new', 'b-1');

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('creates a new record when none exists', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      const created = { id: 'rp-new', userId: 'u-1', bookId: 'b-1', phraseIndex: 10 };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.upsert('u-1', 'b-1', 10);

      expect(mockRepo.create).toHaveBeenCalledWith({ userId: 'u-1', bookId: 'b-1', phraseIndex: 10 });
      expect(mockRepo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });

    it('updates phraseIndex when a record already exists', async () => {
      const existing = { id: 'rp-1', userId: 'u-1', bookId: 'b-1', phraseIndex: 5 };
      mockRepo.findOneBy.mockResolvedValue(existing);
      const updated = { ...existing, phraseIndex: 99 };
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.upsert('u-1', 'b-1', 99);

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(existing.phraseIndex).toBe(99);
      expect(mockRepo.save).toHaveBeenCalledWith(existing);
      expect(result).toEqual(updated);
    });

    it('saves phraseIndex 0 (start of book)', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      const created = { id: 'rp-2', userId: 'u-2', bookId: 'b-2', phraseIndex: 0 };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.upsert('u-2', 'b-2', 0);

      expect(result.phraseIndex).toBe(0);
    });

    it('propagates repository errors', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockRejectedValue(new Error('DB constraint'));

      await expect(service.upsert('u-1', 'b-1', 5)).rejects.toThrow('DB constraint');
    });
  });
});
