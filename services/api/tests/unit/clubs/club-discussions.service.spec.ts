import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClubDiscussion } from '../../../src/clubs/club-discussion.entity';
import { ClubDiscussionsService } from '../../../src/clubs/club-discussions.service';

const mockRepo = () => ({ findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn(v => v), createQueryBuilder: jest.fn() });

describe('ClubDiscussionsService', () => {
  let service: ClubDiscussionsService;
  let discRepo: ReturnType<typeof mockRepo>;
  let memberRepo: ReturnType<typeof mockRepo>;
  let userBookRepo: ReturnType<typeof mockRepo>;
  let clubsService: any;
  let pushService: any;

  const mockQb = () => {
    const qb: any = {};
    ['leftJoinAndSelect','where','andWhere','orderBy','addOrderBy','getMany'].forEach(m => { qb[m] = jest.fn(() => m === 'getMany' ? [] : qb); });
    return qb;
  };

  beforeEach(() => {
    discRepo    = mockRepo();
    memberRepo  = mockRepo();
    userBookRepo = mockRepo();
    clubsService = { assertActiveMember: jest.fn() };
    pushService  = { sendToUser: jest.fn() };
    service = new ClubDiscussionsService(discRepo as any, memberRepo as any, userBookRepo as any, clubsService, pushService);
  });

  describe('create', () => {
    it('creates discussion when user owns the book', async () => {
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      userBookRepo.findOne.mockResolvedValue({ id: 'ub1' });
      discRepo.save.mockResolvedValue({ id: 'd1', phraseIndex: 42 });
      memberRepo.find.mockResolvedValue([]);

      const r = await service.create('u1', 'c1', 'b1', 42, 'great passage!');
      expect(r.phraseIndex).toBe(42);
    });

    it('throws when user does not own the book', async () => {
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      userBookRepo.findOne.mockResolvedValue(null);
      await expect(service.create('u1', 'c1', 'b1', 42, 'text')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByBook', () => {
    it('returns discussions for active member', async () => {
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      discRepo.createQueryBuilder.mockReturnValue(mockQb());
      const r = await service.findByBook('u1', 'c1', 'b1', 0, 100);
      expect(Array.isArray(r)).toBe(true);
    });
  });

  describe('remove', () => {
    it('allows author to delete own discussion', async () => {
      const disc = { id: 'd1', userId: 'u1', clubId: 'c1', deletedAt: null } as ClubDiscussion;
      discRepo.findOne.mockResolvedValue(disc);
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      await service.remove('u1', 'c1', 'd1');
      expect(disc.deletedAt).toBeDefined();
    });

    it('throws when non-mod deletes others discussion', async () => {
      discRepo.findOne.mockResolvedValue({ id: 'd1', userId: 'u2', clubId: 'c1', deletedAt: null } as ClubDiscussion);
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      await expect(service.remove('u1', 'c1', 'd1')).rejects.toThrow(ForbiddenException);
    });

    it('throws when not found', async () => {
      discRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('u1', 'c1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
