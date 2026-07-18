import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StatsService } from '../../../src/stats/stats.service';
import { ReadingStat } from '../../../src/stats/reading-stat.entity';
import { User } from '../../../src/users/user.entity';

const mockStatsRepo = {
  query: jest.fn(),
};

const mockUsersRepo = {
  findOneBy: jest.fn(),
};

// Date helpers — computed once per file load, always within the 7-day window
function utcDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().split('T')[0];
}

describe('StatsService', () => {
  let service: StatsService;

  beforeEach(async () => {
    jest.resetAllMocks(); // clears call counts AND mockResolvedValueOnce queues
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: getRepositoryToken(ReadingStat), useValue: mockStatsRepo },
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  // ── heartbeat ──────────────────────────────────────────────────────────────

  describe('heartbeat', () => {
    it('upserts a reading stat row for today', async () => {
      mockStatsRepo.query.mockResolvedValue(undefined);
      await service.heartbeat('user-1', 5);
      expect(mockStatsRepo.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockStatsRepo.query.mock.calls[0];
      expect(sql).toContain('ON CONFLICT');
      expect(params[0]).toBe('user-1');
      expect(params[2]).toBe(5);
    });

    it('clamps negative phraseDelta to 0', async () => {
      mockStatsRepo.query.mockResolvedValue(undefined);
      await service.heartbeat('user-1', -10);
      const [, params] = mockStatsRepo.query.mock.calls[0];
      expect(params[2]).toBe(0);
    });
  });

  // ── getMyStats ─────────────────────────────────────────────────────────────

  describe('getMyStats', () => {
    const user = { goalWeeklyMinutes: 60, goalWeeklyBooks: 2 } as User;

    function setupGetMyStatsMocks(
      weekRows: object[],
      allDateRows: { date: string }[] = [],
    ) {
      mockUsersRepo.findOneBy.mockResolvedValue(user);
      mockStatsRepo.query
        .mockResolvedValueOnce(weekRows)
        .mockResolvedValueOnce([{ totalMinutes: '100', totalPhrases: '200' }])
        .mockResolvedValueOnce([{ booksThisWeek: '3' }])
        .mockResolvedValueOnce(allDateRows);
    }

    it('returns a thisWeek array of 7 days', async () => {
      setupGetMyStatsMocks([]);
      const result = await service.getMyStats('user-1');
      expect(result.thisWeek).toHaveLength(7);
    });

    it('fills missing days with 0 when no data', async () => {
      setupGetMyStatsMocks([]);
      const result = await service.getMyStats('user-1');
      expect(result.thisWeek.every((d) => d.minutes === 0)).toBe(true);
    });

    it('maps week rows onto the correct days', async () => {
      const yesterday = utcDate(1);
      const threeDaysAgo = utcDate(3);
      setupGetMyStatsMocks([
        { date: yesterday, minutesRead: '10', phrasesRead: '20' },
        { date: threeDaysAgo, minutesRead: '5', phrasesRead: '8' },
      ]);
      const result = await service.getMyStats('user-1');
      const yRow = result.thisWeek.find((d) => d.date === yesterday);
      const tRow = result.thisWeek.find((d) => d.date === threeDaysAgo);
      expect(yRow?.minutes).toBe(10);
      expect(tRow?.minutes).toBe(5);
      expect(result.thisWeekMinutes).toBe(15);
    });

    it('returns allTimeMinutes and allTimePhrases', async () => {
      setupGetMyStatsMocks([]);
      const result = await service.getMyStats('user-1');
      expect(result.allTimeMinutes).toBe(100);
      expect(result.allTimePhrases).toBe(200);
    });

    it('returns booksThisWeek', async () => {
      setupGetMyStatsMocks([]);
      const result = await service.getMyStats('user-1');
      expect(result.booksThisWeek).toBe(3);
    });

    it('returns user goals', async () => {
      setupGetMyStatsMocks([]);
      const result = await service.getMyStats('user-1');
      expect(result.goals.weeklyMinutes).toBe(60);
      expect(result.goals.weeklyBooks).toBe(2);
    });

    it('returns null goals when user has none set', async () => {
      mockUsersRepo.findOneBy.mockResolvedValue({ goalWeeklyMinutes: null, goalWeeklyBooks: null });
      mockStatsRepo.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ totalMinutes: '0', totalPhrases: '0' }])
        .mockResolvedValueOnce([{ booksThisWeek: '0' }])
        .mockResolvedValueOnce([]);
      const result = await service.getMyStats('user-2');
      expect(result.goals.weeklyMinutes).toBeNull();
      expect(result.goals.weeklyBooks).toBeNull();
    });
  });

  // ── getStatsHistory ────────────────────────────────────────────────────────

  describe('getStatsHistory', () => {
    it('returns weekly and monthly bucket arrays', async () => {
      mockStatsRepo.query
        .mockResolvedValueOnce([]) // weekly
        .mockResolvedValueOnce([]); // monthly
      const result = await service.getStatsHistory('user-1');
      expect(result).toHaveProperty('weekly');
      expect(result).toHaveProperty('monthly');
    });

    it('maps DB string columns to numbers', async () => {
      mockStatsRepo.query
        .mockResolvedValueOnce([
          { start: '2026-07-06', minutes: '42', phrases: '300', activeDays: '5' },
        ])
        .mockResolvedValueOnce([
          { start: '2026-07-01', minutes: '180', phrases: '1200', activeDays: '20' },
        ]);
      const result = await service.getStatsHistory('user-1');
      expect(result.weekly[0]).toEqual({ start: '2026-07-06', minutes: 42, phrases: 300, activeDays: 5 });
      expect(result.monthly[0]).toEqual({ start: '2026-07-01', minutes: 180, phrases: 1200, activeDays: 20 });
    });

    it('requests a week bucket series and a month bucket series scoped to the user', async () => {
      mockStatsRepo.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      await service.getStatsHistory('user-9');
      const [weekSql, weekParams] = mockStatsRepo.query.mock.calls[0];
      const [, monthParams] = mockStatsRepo.query.mock.calls[1];
      expect(weekSql).toContain('generate_series');
      expect(weekParams).toEqual(['user-9', 'week', 11]);
      expect(monthParams).toEqual(['user-9', 'month', 11]);
    });

    it('zero-fills: empty rows produce an empty (not errored) result', async () => {
      mockStatsRepo.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const result = await service.getStatsHistory('user-1');
      expect(result.weekly).toEqual([]);
      expect(result.monthly).toEqual([]);
    });
  });

  // ── computeStreak (via getMyStats) ─────────────────────────────────────────

  describe('streak calculation', () => {
    function setupStreak(dates: string[]) {
      mockUsersRepo.findOneBy.mockResolvedValue({ goalWeeklyMinutes: null, goalWeeklyBooks: null });
      mockStatsRepo.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ totalMinutes: '0', totalPhrases: '0' }])
        .mockResolvedValueOnce([{ booksThisWeek: '0' }])
        .mockResolvedValueOnce(dates.map((date) => ({ date })));
    }

    it('returns 0 when no dates', async () => {
      setupStreak([]);
      const { streak } = await service.getMyStats('u');
      expect(streak).toBe(0);
    });

    it('returns 1 when only today', async () => {
      setupStreak([utcDate(0)]);
      const { streak } = await service.getMyStats('u');
      expect(streak).toBe(1);
    });

    it('returns 1 when only yesterday', async () => {
      setupStreak([utcDate(1)]);
      const { streak } = await service.getMyStats('u');
      expect(streak).toBe(1);
    });

    it('counts consecutive days including today', async () => {
      setupStreak([utcDate(0), utcDate(1), utcDate(2)]);
      const { streak } = await service.getMyStats('u');
      expect(streak).toBe(3);
    });

    it('stops at a gap', async () => {
      setupStreak([utcDate(0), utcDate(1), utcDate(3)]);
      const { streak } = await service.getMyStats('u');
      expect(streak).toBe(2);
    });

    it('returns 0 when most recent is two days ago', async () => {
      setupStreak([utcDate(2), utcDate(3)]);
      const { streak } = await service.getMyStats('u');
      expect(streak).toBe(0);
    });
  });
});
