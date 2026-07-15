import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from '../../../src/search/search.service';
import { MEILI_INDEX } from '../../../src/search/search.constants';
import { Book, BookCategory } from '../../../src/books/book.entity';
import { SyncMap } from '../../../src/books/sync-map.entity';

const mockIndex = {
  updateSettings: jest.fn().mockResolvedValue({}),
  addDocuments: jest.fn().mockResolvedValue({}),
  deleteDocument: jest.fn().mockResolvedValue({}),
  search: jest.fn(),
};

// Query-builder mock for the syncCoverage gate lookup. `getRawMany` returns the
// rows for bookIds that clear the gate — tests set it per case.
const mockQb = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
};
const mockSyncMapRepo = { createQueryBuilder: jest.fn(() => mockQb) };

const makeBook = (overrides: Partial<Book> = {}): Book =>
  ({
    id: 'b-1',
    title: 'Don Quijote',
    author: 'Cervantes',
    description: 'Una novela',
    category: BookCategory.CLASSIC,
    language: 'es',
    isFree: true,
    isPublished: true,
    coverUrl: 'https://example.com/cover.jpg',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Book);

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: MEILI_INDEX, useValue: mockIndex },
        { provide: getRepositoryToken(SyncMap), useValue: mockSyncMapRepo },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    jest.clearAllMocks();
    mockIndex.updateSettings.mockResolvedValue({});
    mockSyncMapRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.select.mockReturnThis();
    mockQb.where.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.getRawMany.mockResolvedValue([]);
  });

  describe('onModuleInit', () => {
    it('configures searchable, filterable, and sortable attributes', async () => {
      await service.onModuleInit();
      expect(mockIndex.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          searchableAttributes: ['title', 'author', 'description'],
          filterableAttributes: ['category', 'isFree', 'isPublished', 'language', 'meetsStandard'],
          sortableAttributes: ['createdAt'],
        }),
      );
    });

    it('does not throw when Meilisearch is unreachable', async () => {
      mockIndex.updateSettings.mockRejectedValue(new Error('Connection refused'));
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('indexBook', () => {
    it('adds the book as a document with the correct shape', async () => {
      const book = makeBook();
      mockIndex.addDocuments.mockResolvedValue({});

      await service.indexBook(book);

      expect(mockIndex.addDocuments).toHaveBeenCalledWith(
        [expect.objectContaining({
          id: 'b-1',
          title: 'Don Quijote',
          author: 'Cervantes',
          category: BookCategory.CLASSIC,
          isFree: true,
          isPublished: true,
        })],
        { primaryKey: 'id' },
      );
    });

    it('uses empty string for missing description', async () => {
      const book = makeBook({ description: null });
      mockIndex.addDocuments.mockResolvedValue({});

      await service.indexBook(book);

      expect(mockIndex.addDocuments).toHaveBeenCalledWith(
        [expect.objectContaining({ description: '' })],
        expect.anything(),
      );
    });

    it('does not throw when Meilisearch fails', async () => {
      mockIndex.addDocuments.mockRejectedValue(new Error('unavailable'));
      await expect(service.indexBook(makeBook())).resolves.not.toThrow();
    });

    it('marks a free book meetsStandard=true when its sync map clears the gate', async () => {
      mockQb.getRawMany.mockResolvedValue([{ bookId: 'b-1' }]);

      await service.indexBook(makeBook({ id: 'b-1', uploadedById: null }));

      expect(mockIndex.addDocuments).toHaveBeenCalledWith(
        [expect.objectContaining({ meetsStandard: true })],
        { primaryKey: 'id' },
      );
    });

    it('marks a below-standard free book meetsStandard=false (culled from search)', async () => {
      mockQb.getRawMany.mockResolvedValue([]); // no sync map clears 0.90

      await service.indexBook(makeBook({ id: 'b-1', uploadedById: null }));

      expect(mockIndex.addDocuments).toHaveBeenCalledWith(
        [expect.objectContaining({ meetsStandard: false })],
        { primaryKey: 'id' },
      );
    });

    it('marks an author upload meetsStandard=true without needing a sync map', async () => {
      await service.indexBook(makeBook({ id: 'b-9', uploadedById: 'author-1', isFree: false }));

      expect(mockSyncMapRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockIndex.addDocuments).toHaveBeenCalledWith(
        [expect.objectContaining({ meetsStandard: true })],
        { primaryKey: 'id' },
      );
    });
  });

  describe('removeBook', () => {
    it('deletes the document by book id', async () => {
      mockIndex.deleteDocument.mockResolvedValue({});
      await service.removeBook('b-1');
      expect(mockIndex.deleteDocument).toHaveBeenCalledWith('b-1');
    });

    it('does not throw when Meilisearch fails', async () => {
      mockIndex.deleteDocument.mockRejectedValue(new Error('unavailable'));
      await expect(service.removeBook('b-1')).resolves.not.toThrow();
    });
  });

  describe('search', () => {
    it('searches with isPublished filter always applied', async () => {
      mockIndex.search.mockResolvedValue({ hits: [], estimatedTotalHits: 0 });

      await service.search('quijote', {});

      expect(mockIndex.search).toHaveBeenCalledWith(
        'quijote',
        expect.objectContaining({ filter: expect.stringContaining('isPublished = true') }),
      );
    });

    it('always filters on meetsStandard = true (culls below-standard titles)', async () => {
      mockIndex.search.mockResolvedValue({ hits: [] });

      await service.search('crimen', {});

      const call = mockIndex.search.mock.calls[0][1];
      expect(call.filter).toContain('meetsStandard = true');
    });

    it('appends category filter when provided', async () => {
      mockIndex.search.mockResolvedValue({ hits: [] });

      await service.search('', { category: 'classic' });

      const call = mockIndex.search.mock.calls[0][1];
      expect(call.filter).toContain('category = "classic"');
    });

    it('defaults to isFree = true — never offers below-standard (culled) titles', async () => {
      mockIndex.search.mockResolvedValue({ hits: [] });

      await service.search('quijote', {}); // no isFree specified

      const call = mockIndex.search.mock.calls[0][1];
      expect(call.filter).toContain('isFree = true');
    });

    it('allows an explicit isFree = false override (e.g. admin/internal)', async () => {
      mockIndex.search.mockResolvedValue({ hits: [] });

      await service.search('', { isFree: false });

      const call = mockIndex.search.mock.calls[0][1];
      expect(call.filter).toContain('isFree = false');
    });

    it('returns the raw Meilisearch result', async () => {
      const hits = [{ id: 'b-1', title: 'Don Quijote' }];
      mockIndex.search.mockResolvedValue({ hits, estimatedTotalHits: 1 });

      const result = await service.search('quijote', {});

      expect(result).toEqual({ hits, estimatedTotalHits: 1 });
    });
  });

  describe('indexAll', () => {
    it('indexes all provided books as documents', async () => {
      const books = [makeBook({ id: 'b-1' }), makeBook({ id: 'b-2', title: 'Odisea' })];
      mockIndex.addDocuments.mockResolvedValue({});

      await service.indexAll(books);

      expect(mockIndex.addDocuments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'b-1' }),
          expect.objectContaining({ id: 'b-2' }),
        ]),
        { primaryKey: 'id' },
      );
    });

    it('indexes an empty array without error', async () => {
      mockIndex.addDocuments.mockResolvedValue({});
      await service.indexAll([]);
      expect(mockIndex.addDocuments).toHaveBeenCalledWith([], { primaryKey: 'id' });
    });
  });
});
