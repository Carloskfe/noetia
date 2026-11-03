import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { SharingService, shareConfigHash } from '../../../src/sharing/sharing.service';
import { QuoteIntegrityService } from '../../../src/sharing/quote-integrity.service';
import { ShareRateLimiter } from '../../../src/sharing/share-rate-limiter';
import { StorageService } from '../../../src/storage/storage.service';
import { Share } from '../../../src/sharing/share.entity';
import { Book } from '../../../src/books/book.entity';
import { Fragment } from '../../../src/fragments/fragment.entity';
import { ShareFragmentDto } from '../../../src/sharing/dto/share-fragment.dto';
import * as eligibility from '../../../src/books/book-eligibility';

const IMG = 'https://storage.noetia.app/images/11111111-2222-4333-8444-555555555555.png';
const PROV = { v: 1, source: 'sync_map', sourceSha256: 'a'.repeat(64), spans: [{ start: 0, end: 19 }], checkedAt: '2026-11-02T00:00:00.000Z' };
const mockFragment = { id: 'frag-1', userId: 'user-1', bookId: 'book-1', text: 'Original quote text' } as Fragment;
const mockBook = {
  id: 'book-1', title: 'My Book', author: 'An Author', coverUrl: 'https://c/x.jpg', isFree: true,
} as Book;
const dto = (o: Partial<ShareFragmentDto> = {}): ShareFragmentDto =>
  ({ platform: 'linkedin', format: 'post', ...o }) as ShareFragmentDto;

const mockShareRepo = {
  create: jest.fn((x) => x),
  save: jest.fn(),
  findOneBy: jest.fn(),
  increment: jest.fn(),
};
const mockBookRepo = { findOneBy: jest.fn() };
const mockQuote = { assertFaithfulExcerpt: jest.fn() };
const mockLimiter = { consume: jest.fn() };
const mockStorage = { delete: jest.fn() };

const okFetch = (url = IMG) =>
  (global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ url }) }) as unknown as typeof fetch);
const sentBody = () => JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);

describe('SharingService', () => {
  let service: SharingService;
  let eligible: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockShareRepo.findOneBy.mockResolvedValue(null);
    mockShareRepo.save.mockImplementation(async (x) => x);
    mockShareRepo.increment.mockResolvedValue(undefined);
    mockQuote.assertFaithfulExcerpt.mockResolvedValue(PROV);
    mockLimiter.consume.mockResolvedValue(undefined);
    mockStorage.delete.mockResolvedValue(undefined);
    eligible = jest.spyOn(eligibility, 'isBookPubliclyEligible').mockResolvedValue(true);
    okFetch();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharingService,
        { provide: getRepositoryToken(Share), useValue: mockShareRepo },
        { provide: getRepositoryToken(Book), useValue: mockBookRepo },
        { provide: QuoteIntegrityService, useValue: mockQuote },
        { provide: ShareRateLimiter, useValue: mockLimiter },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();
    service = module.get(SharingService);
  });

  afterEach(() => eligible.mockRestore());

  describe('createOrReuseShare', () => {
    it('renders a card, persists a share snapshot with creator and config hash, returns both URLs', async () => {
      const result = await service.createOrReuseShare(mockFragment, mockBook, dto(), 'user-1');

      expect(result.imageUrl).toBe(IMG);
      expect(result.pageUrl).toMatch(/\/s\/[A-Za-z0-9]{10}$/);
      expect(result.reused).toBe(false);
      const saved = mockShareRepo.save.mock.calls[0][0];
      expect(saved).toMatchObject({
        bookId: 'book-1', fragmentId: 'frag-1', quote: 'Original quote text', author: 'An Author',
        title: 'My Book', imageUrl: IMG, platform: 'linkedin', createdById: 'user-1', revokedAt: null,
      });
      expect(saved.configHash).toMatch(/^[0-9a-f]{64}$/);
      expect(saved.quoteProvenance).toEqual(PROV); // C1 traceability
    });

    it('renders and stores typed [...] as the approved [ … ] marker without touching the fragment', async () => {
      const fragment = { ...mockFragment, text: 'rocín flaco y galgo [...] Una olla de algo' } as Fragment;
      await service.createOrReuseShare(fragment, mockBook, dto(), 'user-1');
      expect(mockQuote.assertFaithfulExcerpt).toHaveBeenCalledWith(mockBook, 'rocín flaco y galgo […] Una olla de algo');
      expect(sentBody().text).toBe('rocín flaco y galgo […] Una olla de algo');
      expect(mockShareRepo.save.mock.calls[0][0].quote).toBe('rocín flaco y galgo […] Una olla de algo');
      expect(fragment.text).toBe('rocín flaco y galgo [...] Una olla de algo');
    });

    it('typed [...] and the canonical [ … ] are the same card (same config hash → re-used share)', async () => {
      await service.createOrReuseShare(mockFragment, mockBook, dto({ text: 'rocín flaco y galgo [...] Una olla de algo' }), 'user-1');
      await service.createOrReuseShare(mockFragment, mockBook, dto({ text: 'rocín flaco y galgo […] Una olla de algo' }), 'user-1');
      const [first, second] = mockShareRepo.findOneBy.mock.calls.map((c) => c[0].configHash);
      expect(first).toBe(second);
    });

    // S2 / C1 — unauthorized text overrides
    it('verifies the rendered text against the book source before rendering', async () => {
      await service.createOrReuseShare(mockFragment, mockBook, dto({ text: 'quote text' }), 'user-1');
      expect(mockQuote.assertFaithfulExcerpt).toHaveBeenCalledWith(mockBook, 'quote text');
      expect(sentBody().text).toBe('quote text');
    });

    it('verifies the stored fragment text when no override is given (fragment text is editable)', async () => {
      await service.createOrReuseShare(mockFragment, mockBook, dto(), 'user-1');
      expect(mockQuote.assertFaithfulExcerpt).toHaveBeenCalledWith(mockBook, 'Original quote text');
    });

    it('refuses an unfaithful quote: no render, no share, no rate-limit charge', async () => {
      mockQuote.assertFaithfulExcerpt.mockRejectedValue(new UnprocessableEntityException({ error: 'quote_not_in_source' }));
      await expect(
        service.createOrReuseShare(mockFragment, mockBook, dto({ text: 'words the author never wrote' }), 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockShareRepo.save).not.toHaveBeenCalled();
      expect(mockLimiter.consume).not.toHaveBeenCalled();
    });

    // S12 — unsafe background URLs
    it('rejects an arbitrary background URL before calling the renderer', async () => {
      await expect(
        service.createOrReuseShare(mockFragment, mockBook, dto({ bgImage: 'http://api:4000/internal' }), 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('forwards an allowed preset background in canonical form', async () => {
      await service.createOrReuseShare(
        mockFragment, mockBook, dto({ bgType: 'image', bgImage: 'https://noetia.app/backgrounds/imagen-4.jpg' }), 'user-1',
      );
      expect(sentBody().bgImage).toBe('https://noetia.app/backgrounds/imagen-4.jpg');
    });

    it('forwards all rendering options to image-gen and omits unset ones', async () => {
      await service.createOrReuseShare(mockFragment, mockBook, dto({
        font: 'lora', bgType: 'gradient', bgColors: ['#000000', '#FFFFFF'], textColor: '#FFFFFF',
        citation: 'Cap. 1', textBold: true, textItalic: true, gradientDir: 'to-right', bgFlip: true,
        bgFit: 'cover', textAlign: 'left', textScale: 1.2,
      }), 'user-1');
      expect(sentBody()).toEqual({
        text: 'Original quote text', author: 'An Author', title: 'My Book', platform: 'linkedin', format: 'post',
        font: 'lora', bgType: 'gradient', bgColors: ['#000000', '#FFFFFF'], textColor: '#FFFFFF',
        citation: 'Cap. 1', textBold: true, textItalic: true, gradientDir: 'to-right', bgFlip: true,
        bgFit: 'cover', textAlign: 'left', textScale: 1.2,
      });

      jest.clearAllMocks();
      okFetch();
      await service.createOrReuseShare(mockFragment, mockBook, dto(), 'user-1');
      expect(sentBody()).toEqual({
        text: 'Original quote text', author: 'An Author', title: 'My Book', platform: 'linkedin', format: 'post',
      });
    });

    it('throws BadGatewayException when image generation fails, persisting nothing', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
      await expect(service.createOrReuseShare(mockFragment, mockBook, dto(), 'user-1')).rejects.toThrow(BadGatewayException);
      expect(mockShareRepo.save).not.toHaveBeenCalled();
    });

    // G8 — duplicate prevention
    it('returns the existing live share for an identical card without re-rendering', async () => {
      mockShareRepo.findOneBy.mockResolvedValue({ id: 'EXISTING01', imageUrl: IMG });
      const result = await service.createOrReuseShare(mockFragment, mockBook, dto(), 'user-1');
      expect(result).toEqual({ pageUrl: expect.stringMatching(/\/s\/EXISTING01$/), imageUrl: IMG, reused: true });
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockShareRepo.save).not.toHaveBeenCalled();
      expect(mockLimiter.consume).not.toHaveBeenCalled();
      const where = mockShareRepo.findOneBy.mock.calls[0][0];
      expect(where.createdById).toBe('user-1');
      expect(where.revokedAt).toBeDefined(); // IsNull() — revoked shares are never re-used
    });

    it('on a concurrent duplicate (unique violation) returns the winner and deletes the extra image', async () => {
      const err = new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' }));
      mockShareRepo.save.mockRejectedValue(err);
      mockShareRepo.findOneBy.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'WINNER0001', imageUrl: 'https://x/images/w.png' });

      const result = await service.createOrReuseShare(mockFragment, mockBook, dto(), 'user-1');

      expect(result.reused).toBe(true);
      expect(result.pageUrl).toMatch(/WINNER0001$/);
      expect(mockStorage.delete).toHaveBeenCalledWith('images', '11111111-2222-4333-8444-555555555555.png');
    });

    it('rethrows other database errors', async () => {
      mockShareRepo.save.mockRejectedValue(new Error('connection lost'));
      await expect(service.createOrReuseShare(mockFragment, mockBook, dto(), 'user-1')).rejects.toThrow('connection lost');
    });

    // S8 — rate limit
    it('charges the per-user rate limit only for new renders, and stops when exceeded', async () => {
      mockLimiter.consume.mockRejectedValue(new HttpException({ error: 'rate_limited' }, 429));
      await expect(service.createOrReuseShare(mockFragment, mockBook, dto(), 'user-1')).rejects.toMatchObject({ status: 429 });
      expect(mockLimiter.consume).toHaveBeenCalledWith('share_create', 'user-1', expect.objectContaining({ limit: 20 }));
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('shareConfigHash', () => {
    const h = (o: Partial<ShareFragmentDto> = {}, user = 'u1', quote = 'q', bg?: string) =>
      shareConfigHash(user, 'f1', quote, dto(o), bg);

    it('is stable for identical input', () => {
      expect(h({ font: 'lora' })).toBe(h({ font: 'lora' }));
    });

    it('differs when any rendering option, the text, the creator or the background changes', () => {
      const base = h();
      expect(h({ font: 'lora' })).not.toBe(base);
      expect(h({ format: 'story' })).not.toBe(base);
      expect(h({}, 'u2')).not.toBe(base);
      expect(h({}, 'u1', 'other')).not.toBe(base);
      expect(h({}, 'u1', 'q', 'data:image/png;base64,AA')).not.toBe(base);
    });
  });

  describe('getPublicShare', () => {
    const share = {
      id: 'abc', bookId: 'book-1', quote: 'q', author: 'A', title: 'T', citation: null, imageUrl: IMG, revokedAt: null,
    };

    it('returns the snapshot plus public book fields and bumps the visit counter', async () => {
      mockShareRepo.findOneBy.mockResolvedValue(share);
      mockBookRepo.findOneBy.mockResolvedValue(mockBook);
      const result = await service.getPublicShare('abc');
      expect(result).toEqual({
        id: 'abc', quote: 'q', author: 'A', title: 'T', citation: null, imageUrl: IMG,
        book: { id: 'book-1', title: 'My Book', author: 'An Author', coverUrl: 'https://c/x.jpg', isFree: true },
      });
      expect(mockShareRepo.increment).toHaveBeenCalledWith({ id: 'abc' }, 'visitCount', 1);
    });

    it('404s for an unknown share', async () => {
      mockShareRepo.findOneBy.mockResolvedValue(null);
      await expect(service.getPublicShare('nope')).rejects.toThrow(NotFoundException);
    });

    // S3 / D07 — revoked shares
    it('404s for a revoked share and does not count the visit', async () => {
      mockShareRepo.findOneBy.mockResolvedValue({ ...share, revokedAt: new Date() });
      await expect(service.getPublicShare('abc')).rejects.toThrow(NotFoundException);
      expect(mockShareRepo.increment).not.toHaveBeenCalled();
    });

    // S14 — ineligible books
    it('404s when the book is no longer publicly eligible', async () => {
      mockShareRepo.findOneBy.mockResolvedValue(share);
      eligible.mockResolvedValue(false);
      await expect(service.getPublicShare('abc')).rejects.toThrow(NotFoundException);
      expect(mockShareRepo.increment).not.toHaveBeenCalled();
    });

    it('still renders if the visit counter fails', async () => {
      mockShareRepo.findOneBy.mockResolvedValue(share);
      mockBookRepo.findOneBy.mockResolvedValue(mockBook);
      mockShareRepo.increment.mockRejectedValue(new Error('db'));
      await expect(service.getPublicShare('abc')).resolves.toMatchObject({ id: 'abc' });
    });
  });
});
