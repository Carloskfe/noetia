import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClubBook } from '../../../src/clubs/club-book.entity';
import { ClubMember } from '../../../src/clubs/club-member.entity';
import { Club } from '../../../src/clubs/club.entity';
import { ClubsService } from '../../../src/clubs/clubs.service';

const mockRepo = () => ({ count: jest.fn(), findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn(v => v), remove: jest.fn(), createQueryBuilder: jest.fn() });

describe('ClubsService', () => {
  let service: ClubsService;
  let clubRepo: ReturnType<typeof mockRepo>;
  let memberRepo: ReturnType<typeof mockRepo>;
  let clubBookRepo: ReturnType<typeof mockRepo>;
  let bookRepo: ReturnType<typeof mockRepo>;
  let subRepo: ReturnType<typeof mockRepo>;

  beforeEach(() => {
    clubRepo    = mockRepo();
    memberRepo  = mockRepo();
    clubBookRepo = mockRepo();
    bookRepo    = mockRepo();
    subRepo     = mockRepo();
    service = new ClubsService(clubRepo as any, memberRepo as any, clubBookRepo as any, bookRepo as any, subRepo as any);
  });

  describe('create', () => {
    const dto = { name: 'Club Test', type: 'public' as const, bookId: 'book-1' };

    it('creates club with free book for any user', async () => {
      clubRepo.count.mockResolvedValue(0);
      bookRepo.findOne.mockResolvedValue({ id: 'book-1', isFree: true });
      subRepo.findOne.mockResolvedValue(null);
      clubRepo.save.mockResolvedValue({ id: 'club-1', ...dto, ownerId: 'user-1', maxMembers: 20 });
      memberRepo.save.mockResolvedValue({});
      clubBookRepo.save.mockResolvedValue({});

      const result = await service.create('user-1', dto);
      expect(result.ownerId).toBe('user-1');
      expect(memberRepo.save).toHaveBeenCalled();
    });

    it('throws when club limit reached', async () => {
      clubRepo.count.mockResolvedValue(3);
      await expect(service.create('user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws when paid book and no subscription', async () => {
      clubRepo.count.mockResolvedValue(0);
      bookRepo.findOne.mockResolvedValue({ id: 'book-1', isFree: false });
      subRepo.findOne.mockResolvedValue(null);
      await expect(service.create('user-1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('allows paid book for subscriber', async () => {
      clubRepo.count.mockResolvedValue(0);
      bookRepo.findOne.mockResolvedValue({ id: 'book-1', isFree: false });
      subRepo.findOne.mockResolvedValue({ id: 'sub-1', status: 'active' });
      clubRepo.save.mockResolvedValue({ id: 'club-1', ownerId: 'user-1', maxMembers: 20 });
      memberRepo.save.mockResolvedValue({});
      clubBookRepo.save.mockResolvedValue({});
      await expect(service.create('user-1', dto)).resolves.toBeDefined();
    });

    it('throws when book not found', async () => {
      clubRepo.count.mockResolvedValue(0);
      bookRepo.findOne.mockResolvedValue(null);
      await expect(service.create('user-1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns club', async () => {
      clubRepo.findOne.mockResolvedValue({ id: 'club-1', name: 'Club' });
      const r = await service.findOne('club-1');
      expect(r.id).toBe('club-1');
    });

    it('throws when not found', async () => {
      clubRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes when owner', async () => {
      clubRepo.findOne.mockResolvedValue({ id: 'c1', ownerId: 'u1' } as Club);
      await service.remove('u1', 'c1');
      expect(clubRepo.remove).toHaveBeenCalled();
    });

    it('throws when not owner', async () => {
      clubRepo.findOne.mockResolvedValue({ id: 'c1', ownerId: 'u2' } as Club);
      await expect(service.remove('u1', 'c1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assertAdmin', () => {
    it('passes for admin', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin', status: 'active' } as ClubMember);
      await expect(service.assertAdmin('u1', 'c1')).resolves.toBeUndefined();
    });

    it('throws for plain member', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'member', status: 'active' } as ClubMember);
      await expect(service.assertAdmin('u1', 'c1')).rejects.toThrow(ForbiddenException);
    });
  });
});
