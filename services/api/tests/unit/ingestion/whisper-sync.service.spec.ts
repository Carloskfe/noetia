import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhisperSyncService } from '../../../src/ingestion/whisper-sync.service';
import { PhraseSplitterService } from '../../../src/ingestion/phrase-splitter.service';
import { StorageService } from '../../../src/storage/storage.service';
import { Book } from '../../../src/books/book.entity';
import { SyncMap } from '../../../src/books/sync-map.entity';
import * as fs from 'fs/promises';
import * as phraseAlignerModule from '../../../src/ingestion/phrase-aligner';
import * as whisperParserModule from '../../../src/ingestion/whisper-parser';

jest.mock('fs/promises');
jest.mock('../../../src/ingestion/phrase-aligner');
jest.mock('../../../src/ingestion/whisper-parser');

const mockBookRepo    = { findOneBy: jest.fn() } as unknown as Repository<Book>;
const mockSyncMapRepo = { findOneBy: jest.fn(), save: jest.fn(), create: jest.fn() } as unknown as Repository<SyncMap>;
const mockStorage     = { getText: jest.fn() } as unknown as StorageService;
const mockSplitter    = { split: jest.fn() } as unknown as PhraseSplitterService;

describe('WhisperSyncService', () => {
  let service: WhisperSyncService;

  const book: Book = {
    id: 'book-uuid-1',
    title: 'Test Book',
    textFileKey: 'book-uuid-1.txt',
  } as Book;

  const phrases = [
    { index: 0, text: 'First phrase.', startTime: 0, endTime: 0, type: 'text' },
    { index: 1, text: 'Second phrase.', startTime: 0, endTime: 0, type: 'text' },
    { index: 2, text: 'Third phrase.', startTime: 0, endTime: 0, type: 'text' },
  ];

  const timedWords = [
    { word: 'First', start: 0.0, end: 0.5 },
    { word: 'phrase', start: 0.5, end: 1.0 },
    { word: 'Second', start: 1.0, end: 1.5 },
    { word: 'phrase', start: 1.5, end: 2.0 },
    { word: 'Third', start: 2.0, end: 2.5 },
    { word: 'phrase', start: 2.5, end: 3.0 },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhisperSyncService,
        { provide: getRepositoryToken(Book),    useValue: mockBookRepo },
        { provide: getRepositoryToken(SyncMap), useValue: mockSyncMapRepo },
        { provide: StorageService,              useValue: mockStorage },
        { provide: PhraseSplitterService,       useValue: mockSplitter },
      ],
    }).compile();

    service = module.get<WhisperSyncService>(WhisperSyncService);
  });

  describe('syncBook — happy path (upsert existing)', () => {
    it('aligns and saves with coverage when sync map already exists', async () => {
      const alignedPhrases = phrases.map((p, i) => ({
        ...p, startTime: i * 1.0, endTime: i * 1.0 + 0.9,
      }));
      const stats = {
        total: 3, aligned: 3, exceptions: 0, lowConfidence: 0,
        avgConfidence: 0.95,
        lowConfidencePhrases: [], exceptionPhrases: [],
      };

      (mockBookRepo.findOneBy as jest.Mock).mockResolvedValue(book);
      (mockStorage.getText as jest.Mock).mockResolvedValue('raw text');
      (mockSplitter.split as jest.Mock).mockReturnValue(phrases);
      (fs.readFile as jest.Mock).mockResolvedValue('WEBVTT\n');
      (whisperParserModule.parseWhisperFile as jest.Mock).mockReturnValue(timedWords);
      (phraseAlignerModule.alignPhrases as jest.Mock).mockReturnValue({ phrases: alignedPhrases, stats });

      const existing = { id: 'sm-1', bookId: book.id, syncSource: 'auto', phrases: [] } as unknown as SyncMap;
      (mockSyncMapRepo.findOneBy as jest.Mock).mockResolvedValue(existing);
      (mockSyncMapRepo.save as jest.Mock).mockResolvedValue(existing);

      const result = await service.syncBook('Test Book', '/tmp/test.vtt');

      expect(result.title).toBe('Test Book');
      expect(result.stats.aligned).toBe(3);
      expect(existing.syncSource).toBe('whisper');
      expect(existing.syncCoverage).toBeCloseTo(1.0);
      expect(existing.syncExceptions).toBe(0);
      expect(existing.syncAvgConfidence).toBeCloseTo(0.95);
      expect(mockSyncMapRepo.save).toHaveBeenCalledWith(existing);
    });
  });

  describe('syncBook — happy path (create new)', () => {
    it('creates a new sync map with coverage when none exists', async () => {
      const stats = {
        total: 3, aligned: 2, exceptions: 1, lowConfidence: 0,
        avgConfidence: 0.80,
        lowConfidencePhrases: [], exceptionPhrases: [{ index: 2, text: 'Third phrase.' }],
      };

      (mockBookRepo.findOneBy as jest.Mock).mockResolvedValue(book);
      (mockStorage.getText as jest.Mock).mockResolvedValue('raw text');
      (mockSplitter.split as jest.Mock).mockReturnValue(phrases);
      (fs.readFile as jest.Mock).mockResolvedValue('WEBVTT\n');
      (whisperParserModule.parseWhisperFile as jest.Mock).mockReturnValue(timedWords);
      (phraseAlignerModule.alignPhrases as jest.Mock).mockReturnValue({ phrases, stats });

      (mockSyncMapRepo.findOneBy as jest.Mock).mockResolvedValue(null);
      const created = { bookId: book.id } as SyncMap;
      (mockSyncMapRepo.create as jest.Mock).mockReturnValue(created);
      (mockSyncMapRepo.save as jest.Mock).mockResolvedValue(created);

      await service.syncBook('Test Book', '/tmp/test.vtt');

      const createCall = (mockSyncMapRepo.create as jest.Mock).mock.calls[0][0];
      expect(createCall.syncSource).toBe('whisper');
      expect(createCall.syncCoverage).toBeCloseTo(2 / 3);
      expect(createCall.syncExceptions).toBe(1);
      expect(createCall.syncAvgConfidence).toBeCloseTo(0.80);
    });
  });

  describe('syncBook — coverage edge cases', () => {
    it('sets syncCoverage to 0 when total phrases is 0', async () => {
      const stats = {
        total: 0, aligned: 0, exceptions: 0, lowConfidence: 0,
        avgConfidence: 0,
        lowConfidencePhrases: [], exceptionPhrases: [],
      };

      (mockBookRepo.findOneBy as jest.Mock).mockResolvedValue(book);
      (mockStorage.getText as jest.Mock).mockResolvedValue('');
      (mockSplitter.split as jest.Mock).mockReturnValue([]);
      (fs.readFile as jest.Mock).mockResolvedValue('WEBVTT\n');
      (whisperParserModule.parseWhisperFile as jest.Mock).mockReturnValue([]);
      (phraseAlignerModule.alignPhrases as jest.Mock).mockReturnValue({ phrases: [], stats });

      (mockSyncMapRepo.findOneBy as jest.Mock).mockResolvedValue(null);
      (mockSyncMapRepo.create as jest.Mock).mockReturnValue({} as SyncMap);
      (mockSyncMapRepo.save as jest.Mock).mockResolvedValue({} as SyncMap);

      await service.syncBook('Test Book', '/tmp/test.vtt');

      const createCall = (mockSyncMapRepo.create as jest.Mock).mock.calls[0][0];
      expect(createCall.syncCoverage).toBe(0);
    });

    it('correctly computes partial coverage (aligned < total)', async () => {
      const stats = {
        total: 10, aligned: 7, exceptions: 3, lowConfidence: 1,
        avgConfidence: 0.72,
        lowConfidencePhrases: [], exceptionPhrases: [],
      };

      (mockBookRepo.findOneBy as jest.Mock).mockResolvedValue(book);
      (mockStorage.getText as jest.Mock).mockResolvedValue('text');
      (mockSplitter.split as jest.Mock).mockReturnValue(phrases);
      (fs.readFile as jest.Mock).mockResolvedValue('WEBVTT\n');
      (whisperParserModule.parseWhisperFile as jest.Mock).mockReturnValue(timedWords);
      (phraseAlignerModule.alignPhrases as jest.Mock).mockReturnValue({ phrases, stats });

      const existing = { syncSource: 'auto' } as unknown as SyncMap;
      (mockSyncMapRepo.findOneBy as jest.Mock).mockResolvedValue(existing);
      (mockSyncMapRepo.save as jest.Mock).mockResolvedValue(existing);

      await service.syncBook('Test Book', '/tmp/test.vtt');

      expect(existing.syncCoverage).toBeCloseTo(0.7);
      expect(existing.syncExceptions).toBe(3);
    });
  });

  describe('syncBook — error scenarios', () => {
    it('throws when book is not found', async () => {
      (mockBookRepo.findOneBy as jest.Mock).mockResolvedValue(null);

      await expect(service.syncBook('Unknown Book', '/tmp/test.vtt'))
        .rejects.toThrow('Book not found: "Unknown Book"');
    });

    it('throws when book has no stored text', async () => {
      (mockBookRepo.findOneBy as jest.Mock).mockResolvedValue({ ...book, textFileKey: null });

      await expect(service.syncBook('Test Book', '/tmp/test.vtt'))
        .rejects.toThrow('Book has no stored text');
    });
  });
});
