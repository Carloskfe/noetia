import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClubSessionsService } from '../../../src/clubs/club-sessions.service';

const mockRepo = () => ({ findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn(v => v) });

describe('ClubSessionsService', () => {
  let service: ClubSessionsService;
  let sessionRepo: ReturnType<typeof mockRepo>;
  let memberRepo: ReturnType<typeof mockRepo>;
  let clubsService: any;
  let pushService: any;

  const futureDate = new Date(Date.now() + 86_400_000).toISOString();
  const pastDate   = new Date(Date.now() - 1000).toISOString();

  beforeEach(() => {
    sessionRepo = mockRepo();
    memberRepo  = mockRepo();
    clubsService = { assertActiveMember: jest.fn(), assertAdmin: jest.fn() };
    pushService  = { sendToUser: jest.fn() };
    service = new ClubSessionsService(sessionRepo as any, memberRepo as any, clubsService, pushService);
  });

  describe('create', () => {
    const dto = { bookId: 'b1', title: 'Canto I', scheduledAt: futureDate, startPhraseIndex: 0, endPhraseIndex: 100 };

    it('creates session and notifies members', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      sessionRepo.save.mockResolvedValue({ id: 's1', title: dto.title, scheduledAt: new Date(futureDate) });
      memberRepo.find.mockResolvedValue([{ userId: 'u2' }]);

      const r = await service.create('admin', 'c1', dto);
      expect(r.title).toBe('Canto I');
      expect(pushService.sendToUser).toHaveBeenCalledWith('u2', 'club_session_scheduled', expect.any(Object));
    });

    it('throws when end phrase not after start', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      await expect(service.create('admin', 'c1', { ...dto, endPhraseIndex: 0 })).rejects.toThrow(BadRequestException);
    });

    it('throws when scheduledAt is in the past', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      await expect(service.create('admin', 'c1', { ...dto, scheduledAt: pastDate })).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('cancels a scheduled session', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      const session = { id: 's1', status: 'scheduled' };
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation(async v => v);

      const r = await service.cancel('admin', 'c1', 's1');
      expect(r.status).toBe('cancelled');
    });

    it('throws when session not found', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('admin', 'c1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws when trying to cancel completed session', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      sessionRepo.findOne.mockResolvedValue({ id: 's1', status: 'completed' });
      await expect(service.cancel('admin', 'c1', 's1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('returns sessions for active member', async () => {
      clubsService.assertActiveMember.mockResolvedValue({ role: 'member' });
      sessionRepo.find.mockResolvedValue([{ id: 's1' }]);
      const r = await service.findAll('u1', 'c1');
      expect(r).toHaveLength(1);
    });
  });
});
