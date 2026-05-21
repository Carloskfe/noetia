import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClubMember } from '../../../src/clubs/club-member.entity';
import { ClubMembersService } from '../../../src/clubs/club-members.service';

const mockRepo = () => ({ count: jest.fn(), findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn(v => v), remove: jest.fn() });

describe('ClubMembersService', () => {
  let service: ClubMembersService;
  let clubRepo: ReturnType<typeof mockRepo>;
  let memberRepo: ReturnType<typeof mockRepo>;
  let clubBookRepo: ReturnType<typeof mockRepo>;
  let userBookRepo: ReturnType<typeof mockRepo>;
  let clubsService: any;
  let jwtService: any;

  beforeEach(() => {
    clubRepo    = mockRepo();
    memberRepo  = mockRepo();
    clubBookRepo = mockRepo();
    userBookRepo = mockRepo();
    clubsService = { assertAdmin: jest.fn(), assertActiveMember: jest.fn() };
    jwtService   = { sign: jest.fn(() => 'tok'), verify: jest.fn(() => ({ clubId: 'c1', purpose: 'club_invite' })) };
    service = new ClubMembersService(clubRepo as any, memberRepo as any, clubBookRepo as any, userBookRepo as any, clubsService, jwtService);
  });

  describe('join', () => {
    it('joins a public club with book', async () => {
      clubRepo.findOne.mockResolvedValue({ id: 'c1', type: 'public', maxMembers: 20 });
      memberRepo.findOne.mockResolvedValueOnce(null) // not banned
                        .mockResolvedValueOnce(null) // not member
                        .mockResolvedValue(null);    // count check
      memberRepo.count.mockResolvedValue(5);
      clubBookRepo.findOne.mockResolvedValue({ bookId: 'b1', status: 'active' });
      userBookRepo.findOne.mockResolvedValue({ id: 'ub1' });
      memberRepo.save.mockResolvedValue({ id: 'cm1', clubId: 'c1', userId: 'u1', role: 'member' });

      const r = await service.join('u1', 'c1');
      expect(r.role).toBe('member');
    });

    it('throws on private club', async () => {
      clubRepo.findOne.mockResolvedValue({ id: 'c1', type: 'private' });
      await expect(service.join('u1', 'c1')).rejects.toThrow(ForbiddenException);
    });

    it('throws when banned', async () => {
      clubRepo.findOne.mockResolvedValue({ id: 'c1', type: 'public', maxMembers: 20 });
      memberRepo.findOne.mockResolvedValueOnce({ status: 'banned' });
      await expect(service.join('u1', 'c1')).rejects.toThrow(ForbiddenException);
    });

    it('throws when already a member', async () => {
      clubRepo.findOne.mockResolvedValue({ id: 'c1', type: 'public', maxMembers: 20 });
      memberRepo.findOne.mockResolvedValueOnce(null) // not banned
                        .mockResolvedValueOnce({ status: 'active' }); // already member
      await expect(service.join('u1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('throws when club full', async () => {
      clubRepo.findOne.mockResolvedValue({ id: 'c1', type: 'public', maxMembers: 20 });
      memberRepo.findOne.mockResolvedValue(null);
      memberRepo.count.mockResolvedValue(20);
      clubBookRepo.findOne.mockResolvedValue(null);
      await expect(service.join('u1', 'c1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    it('removes without ban', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      memberRepo.findOne.mockResolvedValue({ id: 'cm1', role: 'member', status: 'active' } as ClubMember);
      await service.removeMember('admin', 'c1', 'u2', false);
      expect(memberRepo.remove).toHaveBeenCalled();
    });

    it('bans and keeps record', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      memberRepo.findOne.mockResolvedValue({ id: 'cm1', role: 'member', status: 'active' } as ClubMember);
      await service.removeMember('admin', 'c1', 'u2', true);
      expect(memberRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'banned' }));
      expect(memberRepo.remove).not.toHaveBeenCalled();
    });

    it('throws when removing admin', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      memberRepo.findOne.mockResolvedValue({ role: 'admin' } as ClubMember);
      await expect(service.removeMember('admin', 'c1', 'owner', false)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('leave', () => {
    it('allows member to leave', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'member', status: 'active' } as ClubMember);
      await service.leave('u1', 'c1');
      expect(memberRepo.remove).toHaveBeenCalled();
    });

    it('throws when admin tries to leave', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin', status: 'active' } as ClubMember);
      await expect(service.leave('u1', 'c1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('generateInviteLink', () => {
    it('returns url with token', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      const r = await service.generateInviteLink('admin', 'c1');
      expect(r.url).toContain('tok');
    });
  });
});
