import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../src/users/user.entity';
import { PushToken } from '../../../src/push/push-token.entity';
import { PushService } from '../../../src/push/push.service';

const mockTokenRepo = { upsert: jest.fn(), findBy: jest.fn() };
const mockUserRepo = { findOneBy: jest.fn() };

global.fetch = jest.fn();

describe('PushService', () => {
  let service: PushService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: getRepositoryToken(PushToken), useValue: mockTokenRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get(PushService);
  });

  describe('registerToken', () => {
    it('upserts token for user', async () => {
      mockTokenRepo.upsert.mockResolvedValue({});
      await service.registerToken('u1', 'ExponentPushToken[abc]', 'ios');
      expect(mockTokenRepo.upsert).toHaveBeenCalledWith(
        { userId: 'u1', token: 'ExponentPushToken[abc]', platform: 'ios' },
        { conflictPaths: ['userId', 'token'] },
      );
    });
  });

  describe('sendToUser', () => {
    it('sends push for invite_accepted in Spanish', async () => {
      mockTokenRepo.findBy.mockResolvedValue([{ token: 'ExponentPushToken[abc]' }]);
      mockUserRepo.findOneBy.mockResolvedValue({ uiLanguage: 'es' });

      await service.sendToUser('u1', 'invite_accepted', { planName: 'Duo' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({
          body: expect.stringContaining('Invitación aceptada'),
        }),
      );
    });

    it('sends push for invite_accepted in English', async () => {
      mockTokenRepo.findBy.mockResolvedValue([{ token: 'ExponentPushToken[abc]' }]);
      mockUserRepo.findOneBy.mockResolvedValue({ uiLanguage: 'en' });

      await service.sendToUser('u1', 'invite_accepted', { planName: 'Duo' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({
          body: expect.stringContaining('Invitation accepted'),
        }),
      );
    });

    it('sends push for gift_claimed with correct token count', async () => {
      mockTokenRepo.findBy.mockResolvedValue([{ token: 'ExponentPushToken[xyz]' }]);
      mockUserRepo.findOneBy.mockResolvedValue({ uiLanguage: 'es' });

      await service.sendToUser('u1', 'gift_claimed', { tokenCount: 3 });

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.body).toContain('3 tokens');
    });

    it('does nothing when user has no push tokens', async () => {
      mockTokenRepo.findBy.mockResolvedValue([]);
      mockUserRepo.findOneBy.mockResolvedValue({ uiLanguage: 'es' });

      await service.sendToUser('u1', 'invite_accepted', {});
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not throw when Expo API fails', async () => {
      mockTokenRepo.findBy.mockResolvedValue([{ token: 'ExponentPushToken[abc]' }]);
      mockUserRepo.findOneBy.mockResolvedValue({ uiLanguage: 'es' });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(service.sendToUser('u1', 'invite_accepted', { planName: 'Duo' }))
        .resolves.toBeUndefined();
    });
  });
});
