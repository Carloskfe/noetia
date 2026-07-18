import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from '../../../src/stats/stats.controller';
import { StatsService } from '../../../src/stats/stats.service';

const mockStatsService = {
  heartbeat: jest.fn(),
  getMyStats: jest.fn(),
  getStatsHistory: jest.fn(),
};

const mockReq = { user: { sub: 'user-123' } };

describe('StatsController', () => {
  let controller: StatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [{ provide: StatsService, useValue: mockStatsService }],
    }).compile();

    controller = module.get<StatsController>(StatsController);
    jest.clearAllMocks();
  });

  describe('heartbeat', () => {
    it('calls statsService.heartbeat with userId and phraseDelta', async () => {
      mockStatsService.heartbeat.mockResolvedValue(undefined);
      await controller.heartbeat(mockReq, { bookId: 'book-1', phraseDelta: 3 });
      expect(mockStatsService.heartbeat).toHaveBeenCalledWith('user-123', 3);
    });

    it('defaults phraseDelta to 0 when omitted', async () => {
      mockStatsService.heartbeat.mockResolvedValue(undefined);
      await controller.heartbeat(mockReq, { bookId: 'book-1' });
      expect(mockStatsService.heartbeat).toHaveBeenCalledWith('user-123', 0);
    });
  });

  describe('getMyStats', () => {
    it('calls statsService.getMyStats with userId and returns result', async () => {
      const mockStats = { streak: 5, thisWeekMinutes: 30 };
      mockStatsService.getMyStats.mockResolvedValue(mockStats);
      const result = await controller.getMyStats(mockReq);
      expect(mockStatsService.getMyStats).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockStats);
    });
  });

  describe('getHistory', () => {
    it('calls statsService.getStatsHistory with userId and returns result', async () => {
      const mockHistory = { weekly: [], monthly: [] };
      mockStatsService.getStatsHistory.mockResolvedValue(mockHistory);
      const result = await controller.getHistory(mockReq);
      expect(mockStatsService.getStatsHistory).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockHistory);
    });
  });
});
