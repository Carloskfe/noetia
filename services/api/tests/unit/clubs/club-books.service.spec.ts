import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClubBooksService } from '../../../src/clubs/club-books.service';

const mockRepo = () => ({ findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn(v => v), count: jest.fn() });

describe('ClubBooksService', () => {
  let service: ClubBooksService;
  let clubBookRepo: ReturnType<typeof mockRepo>;
  let memberRepo: ReturnType<typeof mockRepo>;
  let bookRepo: ReturnType<typeof mockRepo>;
  let clubsService: any;
  let pushService: any;

  beforeEach(() => {
    clubBookRepo = mockRepo();
    memberRepo   = mockRepo();
    bookRepo     = mockRepo();
    clubsService = { assertActiveMember: jest.fn(), assertAdmin: jest.fn() };
    pushService  = { sendToUser: jest.fn() };
    service = new ClubBooksService(clubBookRepo as any, memberRepo as any, bookRepo as any, clubsService, pushService);
  });

  describe('addBook', () => {
    it('adds a new book to reading list', async () => {
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      bookRepo.findOne.mockResolvedValue({ id: 'b1' });
      clubBookRepo.findOne.mockResolvedValue(null);
      clubBookRepo.save.mockResolvedValue({ id: 'cb1', bookId: 'b1', status: 'queued' });

      const r = await service.addBook('u1', 'c1', 'b1');
      expect(r.status).toBe('queued');
    });

    it('throws when book not found', async () => {
      clubsService.assertActiveMember.mockResolvedValue({});
      bookRepo.findOne.mockResolvedValue(null);
      await expect(service.addBook('u1', 'c1', 'b-missing')).rejects.toThrow(NotFoundException);
    });

    it('throws when book already in club', async () => {
      clubsService.assertActiveMember.mockResolvedValue({});
      bookRepo.findOne.mockResolvedValue({ id: 'b1' });
      clubBookRepo.findOne.mockResolvedValue({ id: 'cb1' });
      await expect(service.addBook('u1', 'c1', 'b1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('setActive', () => {
    it('completes current active book and sets new one', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      const current = { id: 'cb0', status: 'active', completedAt: null };
      const next    = { id: 'cb1', bookId: 'b2', status: 'queued', startedAt: null };
      clubBookRepo.findOne.mockResolvedValueOnce(current).mockResolvedValueOnce(next);
      memberRepo.find.mockResolvedValue([]);
      clubBookRepo.save.mockImplementation(async v => v);

      const r = await service.setActive('admin', 'c1', 'b2');
      expect(current.status).toBe('completed');
      expect(next.status).toBe('active');
    });

    it('throws when next book not in reading list', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      clubBookRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      await expect(service.setActive('admin', 'c1', 'b-missing')).rejects.toThrow(NotFoundException);
    });
  });
});
