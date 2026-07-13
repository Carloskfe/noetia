import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from '../../../src/search/search.service';
import { MEILI_INDEX } from '../../../src/search/search.constants';
import { Book, BookCategory } from '../../../src/books/book.entity';

const mockIndex = {
  updateSettings: jest.fn().mockResolvedValue({}),
  addDocuments: jest.fn().mockResolvedValue({}),
  deleteDocument: jest.fn().mockResolvedValue({}),
  search: jest.fn(),
};

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
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    jest.clearAllMocks();
    mockIndex.updateSettings.mockResolvedValue({});
  });

  describe('onModuleInit', () => {
    it('configures searchable, filterable, and sortable attributes', async () => {
      await service.onModuleInit();
      expect(mockIndex.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          searchableAttributes: ['title', 'author', 'description'],
          filterableAttributes: ['category', 'isFree', 'isPublished', 'language'],
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
