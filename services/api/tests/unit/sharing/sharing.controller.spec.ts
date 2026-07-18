import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SharingController } from '../../../src/sharing/sharing.controller';
import { SharingService } from '../../../src/sharing/sharing.service';
import { EventsService } from '../../../src/events/events.service';
import { Fragment } from '../../../src/fragments/fragment.entity';
import { Book } from '../../../src/books/book.entity';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';

const mockSharingService = {
  generateShareUrl: jest.fn(),
};

const mockEventsService = {
  emit: jest.fn().mockResolvedValue(undefined),
};

const mockFragmentRepo = {
  findOneBy: jest.fn(),
};

const mockBookRepo = {
  findOneBy: jest.fn(),
  save: jest.fn(),
};

const mockUser = { id: 'user-1' };
const mockFragment = { id: 'frag-1', bookId: 'book-1', text: 'A great quote', themes: ['amor'] } as Fragment;
const mockBook = { id: 'book-1', title: 'My Book', author: 'An Author', shareCount: 0 } as Book;

describe('SharingController', () => {
  let controller: SharingController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEventsService.emit.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SharingController],
      providers: [
        { provide: SharingService, useValue: mockSharingService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: getRepositoryToken(Fragment), useValue: mockFragmentRepo },
        { provide: getRepositoryToken(Book), useValue: mockBookRepo },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SharingController>(SharingController);
    jest.clearAllMocks();
  });

  describe('POST /fragments/:id/share', () => {
    it('returns a share URL for a valid fragment and platform', async () => {
      mockFragmentRepo.findOneBy.mockResolvedValue(mockFragment);
      mockBookRepo.findOneBy.mockResolvedValue({ ...mockBook });
      mockSharingService.generateShareUrl.mockResolvedValue('https://cdn.example.com/image.png');
      mockBookRepo.save.mockResolvedValue(undefined);

      const result = await controller.share('frag-1', 'linkedin', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { user: mockUser });

      expect(result).toEqual({ url: 'https://cdn.example.com/image.png' });
    });

    it('increments shareCount on the book after generating the URL', async () => {
      const book = { ...mockBook, shareCount: 4 };
      mockFragmentRepo.findOneBy.mockResolvedValue(mockFragment);
      mockBookRepo.findOneBy.mockResolvedValue(book);
      mockSharingService.generateShareUrl.mockResolvedValue('https://cdn.example.com/img.png');
      mockBookRepo.save.mockResolvedValue(undefined);

      await controller.share('frag-1', 'instagram', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { user: mockUser });

      expect(mockBookRepo.save).toHaveBeenCalledWith(expect.objectContaining({ shareCount: 5 }));
    });

    it('treats null shareCount as 0 before incrementing', async () => {
      const book = { ...mockBook, shareCount: null as any };
      mockFragmentRepo.findOneBy.mockResolvedValue(mockFragment);
      mockBookRepo.findOneBy.mockResolvedValue(book);
      mockSharingService.generateShareUrl.mockResolvedValue('https://cdn.example.com/img.png');
      mockBookRepo.save.mockResolvedValue(undefined);

      await controller.share('frag-1', 'whatsapp', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { user: mockUser });

      expect(mockBookRepo.save).toHaveBeenCalledWith(expect.objectContaining({ shareCount: 1 }));
    });

    it('throws NotFoundException when fragment does not exist', async () => {
      mockFragmentRepo.findOneBy.mockResolvedValue(null);

      await expect(
        controller.share('bad-id', 'linkedin', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { user: mockUser }),
      ).rejects.toThrow(NotFoundException);
      expect(mockSharingService.generateShareUrl).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when book for fragment does not exist', async () => {
      mockFragmentRepo.findOneBy.mockResolvedValue(mockFragment);
      mockBookRepo.findOneBy.mockResolvedValue(null);

      await expect(
        controller.share('frag-1', 'linkedin', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { user: mockUser }),
      ).rejects.toThrow(NotFoundException);
      expect(mockSharingService.generateShareUrl).not.toHaveBeenCalled();
    });

    it('passes styling options to the sharing service', async () => {
      mockFragmentRepo.findOneBy.mockResolvedValue(mockFragment);
      mockBookRepo.findOneBy.mockResolvedValue({ ...mockBook });
      mockSharingService.generateShareUrl.mockResolvedValue('https://cdn.example.com/styled.png');
      mockBookRepo.save.mockResolvedValue(undefined);

      await controller.share('frag-1', 'linkedin', 'square', 'serif', 'gradient', ['#fff', '#000'], '#333', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { user: mockUser });

      expect(mockSharingService.generateShareUrl).toHaveBeenCalledWith(
        mockFragment,
        expect.objectContaining({ id: 'book-1' }),
        'linkedin',
        expect.objectContaining({ format: 'square', font: 'serif', bgType: 'gradient', bgColors: ['#fff', '#000'], textColor: '#333' }),
      );
    });

    it('forwards bgImage, bgFlip and bgFit to the sharing service', async () => {
      mockFragmentRepo.findOneBy.mockResolvedValue(mockFragment);
      mockBookRepo.findOneBy.mockResolvedValue({ ...mockBook });
      mockSharingService.generateShareUrl.mockResolvedValue('https://cdn.example.com/flipped.png');
      mockBookRepo.save.mockResolvedValue(undefined);

      await controller.share(
        'frag-1', 'instagram', 'post', 'playfair', 'image', ['#000'], undefined,
        undefined, undefined, undefined, undefined, undefined,
        'data:image/png;base64,AAAA', true, 'contain', undefined, { user: mockUser },
      );

      expect(mockSharingService.generateShareUrl).toHaveBeenCalledWith(
        mockFragment,
        expect.objectContaining({ id: 'book-1' }),
        'instagram',
        expect.objectContaining({ bgImage: 'data:image/png;base64,AAAA', bgFlip: true, bgFit: 'contain' }),
      );
    });
  });
});
