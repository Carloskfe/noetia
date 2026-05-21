import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClubPollsService } from '../../../src/clubs/club-polls.service';

const mockRepo = () => ({ findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn(v => v), createQueryBuilder: jest.fn() });

describe('ClubPollsService', () => {
  let service: ClubPollsService;
  let pollRepo: ReturnType<typeof mockRepo>;
  let optionRepo: ReturnType<typeof mockRepo>;
  let voteRepo: ReturnType<typeof mockRepo>;
  let memberRepo: ReturnType<typeof mockRepo>;
  let clubsService: any;

  const futureDate = new Date(Date.now() + 86_400_000).toISOString();
  const pastDate   = new Date(Date.now() - 1000).toISOString();

  const mockQb = (rawResult?: object) => {
    const qb: any = {};
    ['select','addSelect','where','groupBy','orderBy','limit'].forEach(m => { qb[m] = jest.fn(() => qb); });
    qb.getRawOne = jest.fn(() => rawResult ?? null);
    return qb;
  };

  beforeEach(() => {
    pollRepo   = mockRepo();
    optionRepo = mockRepo();
    voteRepo   = mockRepo();
    memberRepo = mockRepo();
    clubsService = { assertActiveMember: jest.fn(), assertAdmin: jest.fn() };
    service = new ClubPollsService(pollRepo as any, optionRepo as any, voteRepo as any, memberRepo as any, clubsService);
  });

  describe('create', () => {
    const dto = { question: 'Next book?', bookIds: ['b1', 'b2'], closesAt: futureDate };

    it('creates poll with options', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      pollRepo.save.mockResolvedValue({ id: 'p1', question: dto.question });
      optionRepo.save.mockResolvedValue([]);

      const r = await service.create('admin', 'c1', dto);
      expect(r.question).toBe('Next book?');
      expect(optionRepo.save).toHaveBeenCalled();
    });

    it('throws when closesAt is in the past', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      await expect(service.create('admin', 'c1', { ...dto, closesAt: pastDate })).rejects.toThrow(BadRequestException);
    });
  });

  describe('vote', () => {
    it('casts a vote', async () => {
      clubsService.assertActiveMember.mockResolvedValue({});
      pollRepo.findOne.mockResolvedValue({ id: 'p1', clubId: 'c1', status: 'open', closesAt: new Date(Date.now() + 86_400_000) });
      optionRepo.findOne.mockResolvedValue({ id: 'opt1' });
      voteRepo.findOne.mockResolvedValue(null);
      voteRepo.save.mockResolvedValue({ id: 'v1', optionId: 'opt1' });

      const r = await service.vote('u1', 'c1', 'p1', 'opt1');
      expect(r.optionId).toBe('opt1');
    });

    it('throws on closed poll', async () => {
      clubsService.assertActiveMember.mockResolvedValue({});
      pollRepo.findOne.mockResolvedValue({ id: 'p1', clubId: 'c1', status: 'closed', closesAt: new Date() });
      await expect(service.vote('u1', 'c1', 'p1', 'opt1')).rejects.toThrow(BadRequestException);
    });

    it('throws when already voted', async () => {
      clubsService.assertActiveMember.mockResolvedValue({});
      pollRepo.findOne.mockResolvedValue({ status: 'open', closesAt: new Date(Date.now() + 1000) });
      optionRepo.findOne.mockResolvedValue({ id: 'opt1' });
      voteRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.vote('u1', 'c1', 'p1', 'opt1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('close', () => {
    it('closes poll and sets winner', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      const poll = { id: 'p1', status: 'open', winnerOptionId: null };
      pollRepo.findOne.mockResolvedValue(poll);
      voteRepo.createQueryBuilder.mockReturnValue(mockQb({ optionId: 'opt-winner' }));
      pollRepo.save.mockImplementation(async v => v);

      const r = await service.close('admin', 'c1', 'p1');
      expect(r.status).toBe('closed');
      expect(r.winnerOptionId).toBe('opt-winner');
    });

    it('throws when poll not found', async () => {
      clubsService.assertAdmin.mockResolvedValue(undefined);
      pollRepo.findOne.mockResolvedValue(null);
      await expect(service.close('admin', 'c1', 'p-missing')).rejects.toThrow(NotFoundException);
    });
  });
});
