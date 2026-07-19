import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SharingService } from '../../../src/sharing/sharing.service';
import { Fragment } from '../../../src/fragments/fragment.entity';
import { Book } from '../../../src/books/book.entity';
import { Share } from '../../../src/sharing/share.entity';

const mockShareRepo = {
  create: jest.fn((v: unknown) => v),
  save: jest.fn(async (v: unknown) => v),
  findOneBy: jest.fn(),
  increment: jest.fn(async () => ({ affected: 1 })),
};
const mockBookRepo = {
  findOneBy: jest.fn(),
};

const mockFragment = (): Partial<Fragment> => ({
  id: 'frag-1',
  userId: 'user-1',
  bookId: 'book-1',
  text: 'El conocimiento es poder.',
  startPhraseIndex: null,
  endPhraseIndex: null,
  note: null,
});

const mockBook = (): Partial<Book> => ({
  id: 'book-1',
  title: 'Meditationes Sacrae',
  author: 'Francis Bacon',
});

describe('SharingService', () => {
  let service: SharingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharingService,
        { provide: getRepositoryToken(Share), useValue: mockShareRepo },
        { provide: getRepositoryToken(Book), useValue: mockBookRepo },
      ],
    }).compile();

    service = module.get<SharingService>(SharingService);
    jest.clearAllMocks();
    mockShareRepo.create.mockImplementation((v: unknown) => v);
    mockShareRepo.save.mockImplementation(async (v: unknown) => v);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateShareUrl', () => {
    it('returns the image URL and a public invite page URL, and persists a share', async () => {
      const expectedUrl = 'http://storage:9000/images/uuid.png?token=abc';
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: expectedUrl }),
      } as Response);

      const result = await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'linkedin',
        {},
        'user-1',
      );

      expect(result.imageUrl).toBe(expectedUrl);
      expect(result.pageUrl).toMatch(/\/s\/[A-Za-z0-9]{10}$/);
      expect(mockShareRepo.save).toHaveBeenCalledTimes(1);
      const saved = mockShareRepo.save.mock.calls[0][0] as Share;
      expect(saved).toMatchObject({
        bookId: 'book-1',
        fragmentId: 'frag-1',
        quote: 'El conocimiento es poder.',
        author: 'Francis Bacon',
        title: 'Meditationes Sacrae',
        imageUrl: expectedUrl,
        platform: 'linkedin',
        createdById: 'user-1',
      });
      expect(saved.id).toHaveLength(10);
      // The persisted slug is the one in the returned page URL.
      expect(result.pageUrl.endsWith(`/s/${saved.id}`)).toBe(true);
    });

    it('snapshots the edited text override as the quote', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'linkedin',
        { textOverride: 'Texto editado.' },
      );

      const saved = mockShareRepo.save.mock.calls[0][0] as Share;
      expect(saved.quote).toBe('Texto editado.');
    });

    it('sends platform and required fields in payload', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'instagram',
      );

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/generate');
      const body = JSON.parse(options.body);
      expect(body).toMatchObject({
        text: 'El conocimiento es poder.',
        author: 'Francis Bacon',
        title: 'Meditationes Sacrae',
        platform: 'instagram',
      });
    });

    it('includes all share options in payload when provided', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'instagram',
        { format: 'story', font: 'playfair', bgType: 'gradient', bgColors: ['#0D1B2A', '#1A4A4A'] },
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.format).toBe('story');
      expect(body.font).toBe('playfair');
      expect(body.bgType).toBe('gradient');
      expect(body.bgColors).toEqual(['#0D1B2A', '#1A4A4A']);
    });

    it('omits optional fields from payload when not provided', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'instagram',
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body).not.toHaveProperty('format');
      expect(body).not.toHaveProperty('font');
      expect(body).not.toHaveProperty('bgType');
      expect(body).not.toHaveProperty('bgColors');
    });

    it('includes textColor in payload when provided', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'linkedin',
        { textColor: '#FF0000' },
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.textColor).toBe('#FF0000');
    });

    it('omits textColor from payload when not provided', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'linkedin',
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body).not.toHaveProperty('textColor');
    });

    it('sends bgFlip=true when the mirror option is set', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'instagram',
        { bgType: 'image', bgImage: 'data:image/png;base64,AAAA', bgFlip: true },
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.bgFlip).toBe(true);
    });

    it('omits bgFlip from payload when not set', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'instagram',
        { bgType: 'image', bgImage: 'data:image/png;base64,AAAA' },
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body).not.toHaveProperty('bgFlip');
    });

    it('forwards bgFit to the image-gen payload when set', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'instagram',
        { bgType: 'image', bgImage: 'data:image/png;base64,AAAA', bgFit: 'contain' },
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.bgFit).toBe('contain');
    });

    it('omits bgFit from payload when not set', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'instagram',
        { bgType: 'image', bgImage: 'data:image/png;base64,AAAA' },
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body).not.toHaveProperty('bgFit');
    });

    it('forwards textScale to the image-gen payload when set', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'instagram',
        { textScale: 1.5 },
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.textScale).toBe(1.5);
    });

    it('omits textScale from payload when not set', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'instagram',
        {},
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body).not.toHaveProperty('textScale');
    });

    it('forwards textAlign when set', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(
        mockFragment() as Fragment,
        mockBook() as Book,
        'instagram',
        { textAlign: 'left' },
      );

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(options.body).textAlign).toBe('left');
    });

    it('omits textAlign when not set', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'http://example.com/img.png' }),
      } as Response);

      await service.generateShareUrl(mockFragment() as Fragment, mockBook() as Book, 'instagram');

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(options.body)).not.toHaveProperty('textAlign');
    });

    it('throws BadGatewayException when image-gen returns non-200', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'unsupported platform' }),
      } as Response);

      await expect(
        service.generateShareUrl(mockFragment() as Fragment, mockBook() as Book, 'tiktok'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws when fetch rejects', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        service.generateShareUrl(mockFragment() as Fragment, mockBook() as Book, 'linkedin'),
      ).rejects.toThrow();
    });
  });

  describe('getPublicShare', () => {
    it('returns the share snapshot with book info and bumps the visit count', async () => {
      mockShareRepo.findOneBy.mockResolvedValueOnce({
        id: 'abc123', bookId: 'book-1', quote: 'Una frase.', author: 'A', title: 'T',
        citation: null, imageUrl: 'http://img/x.png',
      });
      mockBookRepo.findOneBy.mockResolvedValueOnce({
        id: 'book-1', title: 'T', author: 'A', coverUrl: 'http://cov.png', isFree: true,
      });

      const res = await service.getPublicShare('abc123');

      expect(res).toMatchObject({
        id: 'abc123',
        quote: 'Una frase.',
        imageUrl: 'http://img/x.png',
        book: { id: 'book-1', coverUrl: 'http://cov.png', isFree: true },
      });
      expect(mockShareRepo.increment).toHaveBeenCalledWith({ id: 'abc123' }, 'visitCount', 1);
    });

    it('still returns the share when the book is gone (book: null)', async () => {
      mockShareRepo.findOneBy.mockResolvedValueOnce({
        id: 'abc123', bookId: 'gone', quote: 'q', author: 'A', title: 'T',
        citation: null, imageUrl: 'http://img/x.png',
      });
      mockBookRepo.findOneBy.mockResolvedValueOnce(null);

      const res = await service.getPublicShare('abc123');
      expect(res.book).toBeNull();
    });

    it('throws NotFoundException for an unknown slug', async () => {
      mockShareRepo.findOneBy.mockResolvedValueOnce(null);
      await expect(service.getPublicShare('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
