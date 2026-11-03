import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SharingController } from '../../../src/sharing/sharing.controller';
import { SharingService } from '../../../src/sharing/sharing.service';
import { ShareLifecycleService } from '../../../src/sharing/share-lifecycle.service';
import { EventsService } from '../../../src/events/events.service';
import { Fragment } from '../../../src/fragments/fragment.entity';
import { Book } from '../../../src/books/book.entity';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import { ShareFragmentDto } from '../../../src/sharing/dto/share-fragment.dto';
import * as eligibility from '../../../src/books/book-eligibility';

const mockSharingService = {
  createOrReuseShare: jest.fn(),
  getPublicShare: jest.fn(),
};
const mockLifecycle = { revoke: jest.fn() };
const mockEventsService = { emit: jest.fn().mockResolvedValue(undefined) };
const mockFragmentRepo = { findOneBy: jest.fn() };
const mockBookRepo = { findOneBy: jest.fn(), increment: jest.fn() };

const req = { user: { id: 'user-1' } };
const mockFragment = { id: 'frag-1', userId: 'user-1', bookId: 'book-1', text: 'A great quote', themes: ['amor'] } as Fragment;
const mockBook = { id: 'book-1', title: 'My Book', author: 'An Author', shareCount: 0 } as Book;
const dto = (o: Partial<ShareFragmentDto> = {}): ShareFragmentDto =>
  ({ platform: 'linkedin', format: 'post', ...o }) as ShareFragmentDto;

describe('SharingController', () => {
  let controller: SharingController;
  let eligible: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEventsService.emit.mockResolvedValue(undefined);
    mockFragmentRepo.findOneBy.mockResolvedValue(mockFragment);
    mockBookRepo.findOneBy.mockResolvedValue(mockBook);
    mockBookRepo.increment.mockResolvedValue(undefined);
    mockSharingService.createOrReuseShare.mockResolvedValue({
      pageUrl: 'https://noetia.app/s/abc', imageUrl: 'https://cdn/img.png', reused: false,
    });
    eligible = jest.spyOn(eligibility, 'isBookPubliclyEligible').mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SharingController],
      providers: [
        { provide: SharingService, useValue: mockSharingService },
        { provide: ShareLifecycleService, useValue: mockLifecycle },
        { provide: EventsService, useValue: mockEventsService },
        { provide: getRepositoryToken(Fragment), useValue: mockFragmentRepo },
        { provide: getRepositoryToken(Book), useValue: mockBookRepo },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SharingController>(SharingController);
  });

  afterEach(() => eligible.mockRestore());

  describe('POST /fragments/:id/share', () => {
    it('returns the invite page URL as `url` plus the raw imageUrl', async () => {
      const result = await controller.share('frag-1', dto(), req);
      expect(result).toEqual({ url: 'https://noetia.app/s/abc', imageUrl: 'https://cdn/img.png' });
    });

    it('passes the fragment, book, validated body and caller to the service', async () => {
      const body = dto({ font: 'lora', bgImage: 'data:image/png;base64,AAAA', textScale: 1.2 });
      await controller.share('frag-1', body, req);
      expect(mockSharingService.createOrReuseShare).toHaveBeenCalledWith(mockFragment, mockBook, body, 'user-1');
    });

    // S1 — cross-user sharing
    it("rejects sharing another reader's fragment with 404 and renders nothing", async () => {
      mockFragmentRepo.findOneBy.mockResolvedValue({ ...mockFragment, userId: 'someone-else' });
      await expect(controller.share('frag-1', dto(), req)).rejects.toThrow(NotFoundException);
      expect(mockSharingService.createOrReuseShare).not.toHaveBeenCalled();
      expect(mockBookRepo.increment).not.toHaveBeenCalled();
      expect(mockEventsService.emit).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the fragment does not exist', async () => {
      mockFragmentRepo.findOneBy.mockResolvedValue(null);
      await expect(controller.share('missing', dto(), req)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the book for the fragment does not exist', async () => {
      mockBookRepo.findOneBy.mockResolvedValue(null);
      await expect(controller.share('frag-1', dto(), req)).rejects.toThrow(NotFoundException);
      expect(mockSharingService.createOrReuseShare).not.toHaveBeenCalled();
    });

    // S14 — ineligible books
    it('rejects shares of unpublished / quality-gated books with 422 book_not_shareable', async () => {
      eligible.mockResolvedValue(false);
      await expect(controller.share('frag-1', dto(), req)).rejects.toMatchObject({
        constructor: UnprocessableEntityException,
        response: { error: 'book_not_shareable' },
      });
      expect(eligible).toHaveBeenCalledWith(mockBookRepo, 'book-1');
      expect(mockSharingService.createOrReuseShare).not.toHaveBeenCalled();
    });

    // G8 — duplicates
    it('increments shareCount atomically for a new share', async () => {
      await controller.share('frag-1', dto(), req);
      expect(mockBookRepo.increment).toHaveBeenCalledWith({ id: 'book-1' }, 'shareCount', 1);
    });

    it('does not increment shareCount when an existing share is re-used', async () => {
      mockSharingService.createOrReuseShare.mockResolvedValue({
        pageUrl: 'https://noetia.app/s/abc', imageUrl: 'https://cdn/img.png', reused: true,
      });
      await controller.share('frag-1', dto(), req);
      expect(mockBookRepo.increment).not.toHaveBeenCalled();
      expect(mockEventsService.emit).toHaveBeenCalledWith(
        'fragment_shared', 'user-1', 'book-1', expect.objectContaining({ reused: true }),
      );
    });

    it('emits fragment_shared with platform, format and themes', async () => {
      await controller.share('frag-1', dto({ platform: 'instagram', format: 'story' }), req);
      expect(mockEventsService.emit).toHaveBeenCalledWith('fragment_shared', 'user-1', 'book-1', {
        fragmentId: 'frag-1', platform: 'instagram', format: 'story', themes: ['amor'], reused: false,
      });
    });

    it('still responds if the analytics event fails', async () => {
      mockEventsService.emit.mockRejectedValue(new Error('events down'));
      await expect(controller.share('frag-1', dto(), req)).resolves.toBeDefined();
    });

    it('propagates service errors (e.g. quote_not_in_source) without counting a share', async () => {
      mockSharingService.createOrReuseShare.mockRejectedValue(
        new UnprocessableEntityException({ error: 'quote_not_in_source' }),
      );
      await expect(controller.share('frag-1', dto({ text: 'invented words' }), req)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(mockBookRepo.increment).not.toHaveBeenCalled();
    });
  });

  describe('GET /shares/:id', () => {
    it('delegates to the sharing service', async () => {
      mockSharingService.getPublicShare.mockResolvedValue({ id: 'abc' });
      await expect(controller.getShare('abc')).resolves.toEqual({ id: 'abc' });
      expect(mockSharingService.getPublicShare).toHaveBeenCalledWith('abc');
    });
  });

  describe('DELETE /shares/:id', () => {
    it('revokes the share on behalf of the caller', async () => {
      mockLifecycle.revoke.mockResolvedValue(undefined);
      await controller.revoke('abc', req);
      expect(mockLifecycle.revoke).toHaveBeenCalledWith('abc', 'user-1');
    });

    it("propagates 404 for someone else's share", async () => {
      mockLifecycle.revoke.mockRejectedValue(new NotFoundException());
      await expect(controller.revoke('abc', req)).rejects.toThrow(NotFoundException);
    });
  });
});
