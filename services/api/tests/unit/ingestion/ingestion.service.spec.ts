import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IngestionService } from '../../../src/ingestion/ingestion.service';
import { GutenbergFetcherService } from '../../../src/ingestion/gutenberg-fetcher.service';
import { WikisourceFetcherService } from '../../../src/ingestion/wikisource-fetcher.service';
import { PhraseSplitterService } from '../../../src/ingestion/phrase-splitter.service';
import { MinioUploaderService } from '../../../src/ingestion/minio-uploader.service';
import { LibrivoxApiService } from '../../../src/ingestion/librivox-api.service';
import { AudioDownloaderService } from '../../../src/ingestion/audio-downloader.service';
import { Book, BookCategory } from '../../../src/books/book.entity';
import { SyncMap } from '../../../src/books/sync-map.entity';
import { CatalogueEntry } from '../../../src/ingestion/catalogue';

const mockBookRepo = {
  findOneBy: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};
const mockSyncMapRepo = { create: jest.fn(), save: jest.fn(), delete: jest.fn() };
const mockGutenbergFetcher = { fetch: jest.fn() };
const mockWikisourceFetcher = { fetch: jest.fn() };
const mockPhraseSplitter = { split: jest.fn() };
const mockMinioUploader = { upload: jest.fn() };
const mockLibrivoxApi = { getZipUrl: jest.fn(), getM4bUrl: jest.fn() };
const mockAudioDownloader = { downloadAndStore: jest.fn() };

const gutenbergEntry: CatalogueEntry = {
  title: 'Test Book',
  author: 'Test Author',
  description: 'A test book.',
  source: 'gutenberg',
  gutenbergId: 123,
  librivoxAudioUrl: 'https://librivox.org/test-book/',
};

const wikisourceEntry: CatalogueEntry = {
  title: 'Wikisource Book',
  author: 'Wikisource Author',
  description: 'A wikisource book.',
  source: 'wikisource',
  wikisourceTitle: 'Wikisource Book',
  librivoxAudioUrl: 'https://librivox.org/wikisource-book/',
};

describe('IngestionService', () => {
  let service: IngestionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: GutenbergFetcherService, useValue: mockGutenbergFetcher },
        { provide: WikisourceFetcherService, useValue: mockWikisourceFetcher },
        { provide: PhraseSplitterService, useValue: mockPhraseSplitter },
        { provide: MinioUploaderService, useValue: mockMinioUploader },
        { provide: LibrivoxApiService, useValue: mockLibrivoxApi },
        { provide: AudioDownloaderService, useValue: mockAudioDownloader },
        { provide: getRepositoryToken(Book), useValue: mockBookRepo },
        { provide: getRepositoryToken(SyncMap), useValue: mockSyncMapRepo },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  // ── ingestOne ──────────────────────────────────────────────────────────────

  describe('ingestOne', () => {
    it('fetches from Gutenberg and creates book + syncmap records', async () => {
      const savedBook = { id: 'book-uuid', textFileKey: null } as Book;
      mockBookRepo.findOneBy.mockResolvedValue(null);
      mockGutenbergFetcher.fetch.mockResolvedValue('Chapter 1. The beginning.');
      mockPhraseSplitter.split.mockReturnValue([
        { index: 0, text: 'Chapter 1. The beginning.', startTime: 0, endTime: 0 },
      ]);
      mockBookRepo.create.mockReturnValue(savedBook);
      mockBookRepo.save.mockResolvedValue(savedBook);
      mockMinioUploader.upload.mockResolvedValue(undefined);
      mockSyncMapRepo.create.mockReturnValue({});
      mockSyncMapRepo.save.mockResolvedValue({});

      const result = await service.ingestOne(gutenbergEntry);

      expect(mockGutenbergFetcher.fetch).toHaveBeenCalledWith(123);
      expect(mockMinioUploader.upload).toHaveBeenCalledWith(
        'book-uuid.txt',
        'Chapter 1. The beginning.',
      );
      expect(mockBookRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Book',
          author: 'Test Author',
          category: BookCategory.CLASSIC,
          isFree: true,
          isPublished: true,
          language: 'es',
          audioFileKey: 'https://librivox.org/test-book/',
        }),
      );
      expect(mockSyncMapRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedBook);
    });

    it('fetches from Wikisource for wikisource-source entries', async () => {
      const savedBook = { id: 'ws-uuid', textFileKey: null } as Book;
      mockBookRepo.findOneBy.mockResolvedValue(null);
      mockWikisourceFetcher.fetch.mockResolvedValue('Acto I. Escena I.');
      mockPhraseSplitter.split.mockReturnValue([]);
      mockBookRepo.create.mockReturnValue(savedBook);
      mockBookRepo.save.mockResolvedValue(savedBook);
      mockMinioUploader.upload.mockResolvedValue(undefined);
      mockSyncMapRepo.create.mockReturnValue({});
      mockSyncMapRepo.save.mockResolvedValue({});

      await service.ingestOne(wikisourceEntry);

      expect(mockWikisourceFetcher.fetch).toHaveBeenCalledWith('Wikisource Book');
      expect(mockGutenbergFetcher.fetch).not.toHaveBeenCalled();
    });

    it('returns existing book and skips ingestion when book already exists', async () => {
      const existing = { id: 'existing-uuid' } as Book;
      mockBookRepo.findOneBy.mockResolvedValue(existing);

      const result = await service.ingestOne(gutenbergEntry);

      expect(result).toBe(existing);
      expect(mockGutenbergFetcher.fetch).not.toHaveBeenCalled();
      expect(mockMinioUploader.upload).not.toHaveBeenCalled();
    });

    it('sets textFileKey on the book after uploading to MinIO', async () => {
      const savedBook = { id: 'tf-uuid', textFileKey: null } as Book;
      mockBookRepo.findOneBy.mockResolvedValue(null);
      mockGutenbergFetcher.fetch.mockResolvedValue('Some text.');
      mockPhraseSplitter.split.mockReturnValue([]);
      mockBookRepo.create.mockReturnValue(savedBook);
      mockBookRepo.save.mockResolvedValue(savedBook);
      mockMinioUploader.upload.mockResolvedValue(undefined);
      mockSyncMapRepo.create.mockReturnValue({});
      mockSyncMapRepo.save.mockResolvedValue({});

      await service.ingestOne(gutenbergEntry);

      expect(savedBook.textFileKey).toBe('tf-uuid.txt');
      expect(mockBookRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  // ── ingestAll ─────────────────────────────────────────────────────────────

  describe('ingestAll', () => {
    it('calls ingestOne for every entry in CATALOGUE', async () => {
      const ingestOneSpy = jest
        .spyOn(service, 'ingestOne')
        .mockResolvedValue({} as Book);

      await service.ingestAll();

      const { CATALOGUE } = await import('../../../src/ingestion/catalogue');
      expect(ingestOneSpy).toHaveBeenCalledTimes(CATALOGUE.length);
    });

    it('continues processing remaining entries when one fails', async () => {
      const ingestOneSpy = jest
        .spyOn(service, 'ingestOne')
        .mockRejectedValueOnce(new Error('fetch error'))
        .mockResolvedValue({} as Book);

      await expect(service.ingestAll()).resolves.toBeUndefined();
      expect(ingestOneSpy.mock.calls.length).toBeGreaterThan(1);
    });
  });

  // ── ingestAudio ───────────────────────────────────────────────────────────

  describe('ingestAudio', () => {
    it('scrapes zip URL from LibriVox page and stores in MinIO audio bucket', async () => {
      const book = { id: 'bk-1', audioFileKey: 'https://librivox.org/test-book/' } as Book;
      mockLibrivoxApi.getZipUrl.mockResolvedValue('https://archive.org/compress/x/x.zip');
      mockAudioDownloader.downloadAndStore.mockResolvedValue(undefined);
      mockBookRepo.save.mockResolvedValue(book);

      await service.ingestAudio(gutenbergEntry, book);

      expect(mockLibrivoxApi.getZipUrl).toHaveBeenCalledWith('https://librivox.org/test-book/');
      expect(mockAudioDownloader.downloadAndStore).toHaveBeenCalledWith(
        'https://archive.org/compress/x/x.zip',
        'bk-1.zip',
      );
    });

    it('updates audioFileKey to the MinIO key after download', async () => {
      const book = { id: 'bk-2', audioFileKey: 'https://librivox.org/x/' } as Book;
      mockLibrivoxApi.getZipUrl.mockResolvedValue('https://archive.org/y.zip');
      mockAudioDownloader.downloadAndStore.mockResolvedValue(undefined);
      mockBookRepo.save.mockResolvedValue(book);

      await service.ingestAudio(gutenbergEntry, book);

      expect(book.audioFileKey).toBe('bk-2.zip');
      expect(mockBookRepo.save).toHaveBeenCalledWith(book);
    });

    it('propagates errors from LibriVox API', async () => {
      const book = { id: 'bk-3' } as Book;
      mockLibrivoxApi.getZipUrl.mockRejectedValue(new Error('API down'));

      await expect(service.ingestAudio(gutenbergEntry, book)).rejects.toThrow('API down');
    });
  });

  // ── ingestAudioStream ─────────────────────────────────────────────────────

  describe('ingestAudioStream', () => {
    it('scrapes the M4B URL from the LibriVox page and stores it as audioStreamKey', async () => {
      const book = { id: 'bk-s1', audioStreamKey: null } as Book;
      mockLibrivoxApi.getM4bUrl = jest.fn().mockResolvedValue('https://archive.org/download/x/x.m4b');
      mockBookRepo.save.mockResolvedValue(book);

      await service.ingestAudioStream(gutenbergEntry, book);

      expect(mockLibrivoxApi.getM4bUrl).toHaveBeenCalledWith('https://librivox.org/test-book/');
      expect(book.audioStreamKey).toBe('https://archive.org/download/x/x.m4b');
      expect(mockBookRepo.save).toHaveBeenCalledWith(book);
    });

    it('propagates errors from LibriVox page scraping', async () => {
      const book = { id: 'bk-s2' } as Book;
      mockLibrivoxApi.getM4bUrl = jest.fn().mockRejectedValue(new Error('no M4B found'));

      await expect(service.ingestAudioStream(gutenbergEntry, book)).rejects.toThrow('no M4B found');
    });
  });

  // ── ingestAllAudioStream ──────────────────────────────────────────────────

  describe('ingestAllAudioStream', () => {
    it('calls ingestAudioStream for books missing audioStreamKey', async () => {
      const books = [
        { id: 'b1', title: 'Lazarillo de Tormes', author: 'Anónimo', audioStreamKey: null },
      ] as Book[];
      mockBookRepo.find.mockResolvedValue(books);
      const spy = jest.spyOn(service, 'ingestAudioStream').mockResolvedValue(undefined);

      await service.ingestAllAudioStream();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('skips books that already have audioStreamKey set', async () => {
      const books = [
        { id: 'b1', title: 'Lazarillo de Tormes', author: 'Anónimo', audioStreamKey: 'https://archive.org/x.m4b' },
      ] as Book[];
      mockBookRepo.find.mockResolvedValue(books);
      const spy = jest.spyOn(service, 'ingestAudioStream').mockResolvedValue(undefined);

      await service.ingestAllAudioStream();

      expect(spy).not.toHaveBeenCalled();
    });

    it('skips books without a matching catalogue entry', async () => {
      const books = [
        { id: 'b1', title: 'Unknown', author: 'Unknown', audioStreamKey: null },
      ] as Book[];
      mockBookRepo.find.mockResolvedValue(books);
      const spy = jest.spyOn(service, 'ingestAudioStream').mockResolvedValue(undefined);

      await service.ingestAllAudioStream();

      expect(spy).not.toHaveBeenCalled();
    });

    it('continues to the next book when one fails', async () => {
      const books = [
        { id: 'b1', title: 'Lazarillo de Tormes', author: 'Anónimo', audioStreamKey: null },
        { id: 'b2', title: 'Leyendas', author: 'Gustavo Adolfo Bécquer', audioStreamKey: null },
      ] as Book[];
      mockBookRepo.find.mockResolvedValue(books);
      const spy = jest
        .spyOn(service, 'ingestAudioStream')
        .mockRejectedValueOnce(new Error('scrape error'))
        .mockResolvedValueOnce(undefined);

      await expect(service.ingestAllAudioStream()).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  // ── resyncSyncMap + resyncWikisourceSyncMaps ──────────────────────────────

  describe('resyncSyncMap', () => {
    it('deletes the existing SyncMap and creates a new one with re-fetched phrases', async () => {
      const book = { id: 'ws-1' } as Book;
      mockWikisourceFetcher.fetch.mockResolvedValue('Capítulo I. Texto del capítulo uno.');
      mockPhraseSplitter.split.mockReturnValue([
        { index: 0, text: 'Capítulo I.', type: 'heading', startTime: 0, endTime: 0 },
      ]);
      mockSyncMapRepo.delete.mockResolvedValue({ affected: 1 });
      mockSyncMapRepo.create.mockReturnValue({ bookId: 'ws-1', phrases: [] });
      mockSyncMapRepo.save.mockResolvedValue({});

      await service.resyncSyncMap(wikisourceEntry, book);

      expect(mockWikisourceFetcher.fetch).toHaveBeenCalledWith('Wikisource Book');
      expect(mockSyncMapRepo.delete).toHaveBeenCalledWith({ bookId: 'ws-1' });
      expect(mockSyncMapRepo.save).toHaveBeenCalled();
    });

    it('propagates errors from the Wikisource fetcher', async () => {
      const book = { id: 'ws-2' } as Book;
      mockWikisourceFetcher.fetch.mockRejectedValue(new Error('rate limited'));

      await expect(service.resyncSyncMap(wikisourceEntry, book)).rejects.toThrow('rate limited');
    });
  });

  describe('resyncWikisourceSyncMaps', () => {
    it('re-syncs all Wikisource books that exist in the DB', async () => {
      const book = { id: 'ws-1', title: 'Wikisource Book', author: 'Wikisource Author' } as Book;
      mockBookRepo.findOneBy.mockResolvedValue(book);
      const spy = jest.spyOn(service, 'resyncSyncMap').mockResolvedValue(undefined);

      // Only wikisource entries from CATALOGUE — we spy rather than run the real method
      await service.resyncWikisourceSyncMaps();

      // At minimum, should have attempted findOneBy for each Wikisource entry
      expect(mockBookRepo.findOneBy).toHaveBeenCalled();
    });

    it('skips books that are not yet ingested (not found in DB)', async () => {
      mockBookRepo.findOneBy.mockResolvedValue(null);
      const spy = jest.spyOn(service, 'resyncSyncMap').mockResolvedValue(undefined);

      await service.resyncWikisourceSyncMaps();

      expect(spy).not.toHaveBeenCalled();
    });

    it('continues to the next book when one resync fails', async () => {
      const book = { id: 'ws-x', title: 'X', author: 'Y' } as Book;
      mockBookRepo.findOneBy.mockResolvedValue(book);
      const spy = jest.spyOn(service, 'resyncSyncMap')
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue(undefined);

      await expect(service.resyncWikisourceSyncMaps()).resolves.toBeUndefined();
    });
  });

  // ── ingestAllCovers ───────────────────────────────────────────────────────

  describe('ingestAllCovers', () => {
    let sleepSpy: jest.SpyInstance;

    beforeEach(() => {
      sleepSpy = jest.spyOn(service as unknown as { sleep: () => Promise<void> }, 'sleep')
        .mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('sets coverUrl when Open Library returns a cover ID', async () => {
      const book = { id: 'b1', title: 'Lazarillo de Tormes', author: 'Anónimo', coverUrl: null } as Book;
      mockBookRepo.find.mockResolvedValue([book]);
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [{ cover_i: 12345 }] }),
      } as Response);
      mockBookRepo.save.mockResolvedValue(book);

      await service.ingestAllCovers();

      expect(book.coverUrl).toBe('https://covers.openlibrary.org/b/id/12345-L.jpg');
      expect(mockBookRepo.save).toHaveBeenCalledWith(book);
    });

    it('skips books that already have coverUrl set', async () => {
      const book = { id: 'b1', title: 'Leyendas', author: 'Bécquer', coverUrl: 'https://covers.openlibrary.org/b/id/999-L.jpg' } as Book;
      mockBookRepo.find.mockResolvedValue([book]);

      await service.ingestAllCovers();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockBookRepo.save).not.toHaveBeenCalled();
    });

    it('leaves coverUrl null when Open Library returns no cover_i', async () => {
      const book = { id: 'b1', title: 'Unknown Title', author: 'Unknown', coverUrl: null } as Book;
      mockBookRepo.find.mockResolvedValue([book]);
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [] }),
      } as Response);

      await service.ingestAllCovers();

      expect(book.coverUrl).toBeNull();
      expect(mockBookRepo.save).not.toHaveBeenCalled();
    });

    it('continues to next book when fetch fails for one', async () => {
      const books = [
        { id: 'b1', title: 'Book One', author: 'Author', coverUrl: null },
        { id: 'b2', title: 'Book Two', author: 'Author', coverUrl: null },
      ] as Book[];
      mockBookRepo.find.mockResolvedValue(books);
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ docs: [{ cover_i: 99 }] }),
        } as Response);
      mockBookRepo.save.mockResolvedValue({});

      await expect(service.ingestAllCovers()).resolves.toBeUndefined();
      expect(mockBookRepo.save).toHaveBeenCalledTimes(1);
    });

    it('leaves coverUrl null when Open Library responds with non-ok status', async () => {
      const book = { id: 'b1', title: 'Book', author: 'Author', coverUrl: null } as Book;
      mockBookRepo.find.mockResolvedValue([book]);
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 500 } as Response);

      await service.ingestAllCovers();

      expect(book.coverUrl).toBeNull();
    });

    it('uses hardcoded coverUrl from catalogue without calling Open Library', async () => {
      const book = { id: 'b1', title: 'Génesis', author: 'Anónimo', coverUrl: null } as Book;
      mockBookRepo.find.mockResolvedValue([book]);
      global.fetch = jest.fn();
      mockBookRepo.save.mockResolvedValue(book);

      await service.ingestAllCovers();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(book.coverUrl).toBe('https://covers.openlibrary.org/b/id/12324628-L.jpg');
      expect(mockBookRepo.save).toHaveBeenCalledWith(book);
    });
  });

  // ── fetchOpenLibraryCover ─────────────────────────────────────────────────

  describe('fetchOpenLibraryCover', () => {
    afterEach(() => jest.restoreAllMocks());

    it('returns a cover URL when Open Library has a matching cover', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [{ cover_i: 7890 }] }),
      } as Response);

      const result = await service.fetchOpenLibraryCover('Don Quijote', 'Cervantes');

      expect(result).toBe('https://covers.openlibrary.org/b/id/7890-L.jpg');
    });

    it('returns null when docs array is empty', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [] }),
      } as Response);

      expect(await service.fetchOpenLibraryCover('Unknown', 'Nobody')).toBeNull();
    });

    it('returns null when cover_i is absent from the first doc', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [{ title: 'Something' }] }),
      } as Response);

      expect(await service.fetchOpenLibraryCover('Something', 'Someone')).toBeNull();
    });

    it('returns null on a non-ok HTTP response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 429 } as Response);

      expect(await service.fetchOpenLibraryCover('Any', 'Any')).toBeNull();
    });

    it('includes title and author in the search query', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [] }),
      } as Response);

      await service.fetchOpenLibraryCover('La Odisea', 'Homero');

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('La%20Odisea');
      expect(url).toContain('Homero');
    });
  });

  // ── ingestAllAudio ────────────────────────────────────────────────────────

  describe('ingestAllAudio', () => {
    it('calls ingestAudio for books with a URL-based audioFileKey', async () => {
      const books = [
        { id: 'b1', title: 'Lazarillo de Tormes', author: 'Anónimo', audioFileKey: 'https://librivox.org/lazarillo-de-tormes/' },
      ] as Book[];
      mockBookRepo.find.mockResolvedValue(books);
      const ingestAudioSpy = jest
        .spyOn(service, 'ingestAudio')
        .mockResolvedValue(undefined);

      await service.ingestAllAudio();

      expect(ingestAudioSpy).toHaveBeenCalledTimes(1);
    });

    it('skips books that already have a MinIO key (non-URL audioFileKey)', async () => {
      const books = [
        { id: 'b1', title: 'Lazarillo de Tormes', author: 'Anónimo', audioFileKey: 'b1.zip' },
      ] as Book[];
      mockBookRepo.find.mockResolvedValue(books);
      const ingestAudioSpy = jest.spyOn(service, 'ingestAudio').mockResolvedValue(undefined);

      await service.ingestAllAudio();

      expect(ingestAudioSpy).not.toHaveBeenCalled();
    });

    it('skips books without a matching catalogue entry', async () => {
      const books = [
        { id: 'b1', title: 'Unknown Book', author: 'Unknown', audioFileKey: 'https://x.org/' },
      ] as Book[];
      mockBookRepo.find.mockResolvedValue(books);
      const ingestAudioSpy = jest.spyOn(service, 'ingestAudio').mockResolvedValue(undefined);

      await service.ingestAllAudio();

      expect(ingestAudioSpy).not.toHaveBeenCalled();
    });

    it('continues to next book when one audio download fails', async () => {
      const books = [
        { id: 'b1', title: 'Lazarillo de Tormes', author: 'Anónimo', audioFileKey: 'https://librivox.org/lazarillo-de-tormes/' },
        { id: 'b2', title: 'Leyendas', author: 'Gustavo Adolfo Bécquer', audioFileKey: 'https://librivox.org/leyendas/' },
      ] as Book[];
      mockBookRepo.find.mockResolvedValue(books);
      const ingestAudioSpy = jest
        .spyOn(service, 'ingestAudio')
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce(undefined);

      await expect(service.ingestAllAudio()).resolves.toBeUndefined();
      expect(ingestAudioSpy).toHaveBeenCalledTimes(2);
    });
  });
});
