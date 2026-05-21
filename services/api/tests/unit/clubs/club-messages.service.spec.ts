import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClubMessage } from '../../../src/clubs/club-message.entity';
import { ClubMessagesService } from '../../../src/clubs/club-messages.service';

const mockRepo = () => ({ findOne: jest.fn(), save: jest.fn(), create: jest.fn(v => v), createQueryBuilder: jest.fn() });

describe('ClubMessagesService', () => {
  let service: ClubMessagesService;
  let msgRepo: ReturnType<typeof mockRepo>;
  let clubsService: any;

  const mockQb = () => {
    const qb: any = {};
    qb.leftJoinAndSelect = jest.fn(() => qb);
    qb.where = jest.fn(() => qb);
    qb.andWhere = jest.fn(() => qb);
    qb.orderBy = jest.fn(() => qb);
    qb.take = jest.fn(() => qb);
    qb.getMany = jest.fn(() => []);
    return qb;
  };

  beforeEach(() => {
    msgRepo     = mockRepo();
    clubsService = { assertActiveMember: jest.fn() };
    service = new ClubMessagesService(msgRepo as any, clubsService);
  });

  describe('findAll', () => {
    it('returns messages for active member', async () => {
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      msgRepo.createQueryBuilder.mockReturnValue(mockQb());
      const r = await service.findAll('u1', 'c1');
      expect(Array.isArray(r)).toBe(true);
    });
  });

  describe('create', () => {
    it('creates message', async () => {
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      msgRepo.save.mockResolvedValue({ id: 'm1', content: 'hello' });
      const r = await service.create('u1', 'c1', 'hello');
      expect(r.content).toBe('hello');
    });
  });

  describe('remove', () => {
    it('allows owner to delete own message', async () => {
      const msg = { id: 'm1', userId: 'u1', clubId: 'c1', deletedAt: null } as ClubMessage;
      msgRepo.findOne.mockResolvedValue(msg);
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      await service.remove('u1', 'c1', 'm1');
      expect(msg.deletedAt).toBeDefined();
    });

    it('allows moderator to delete others message', async () => {
      const msg = { id: 'm1', userId: 'u2', clubId: 'c1', deletedAt: null } as ClubMessage;
      msgRepo.findOne.mockResolvedValue(msg);
      clubsService.assertActiveMember.mockResolvedValue({ role: 'moderator' });
      await service.remove('mod', 'c1', 'm1');
      expect(msg.deletedAt).toBeDefined();
    });

    it('throws when non-mod tries to delete others message', async () => {
      msgRepo.findOne.mockResolvedValue({ id: 'm1', userId: 'u2', clubId: 'c1', deletedAt: null } as ClubMessage);
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      await expect(service.remove('u1', 'c1', 'm1')).rejects.toThrow(ForbiddenException);
    });

    it('throws when message not found', async () => {
      msgRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('u1', 'c1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
