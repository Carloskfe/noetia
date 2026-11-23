import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../../src/users/users.controller';
import { UsersService } from '../../../src/users/users.service';

const mockUsersService = {
  findById: jest.fn(),
  update: jest.fn(),
  updateOnboarding: jest.fn(),
  deleteAccount: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('returns the user without the password hash', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: 'secret' });
      const result = await controller.getMe({ user: { id: 'u1' } });
      expect(result).toEqual({ id: 'u1', email: 'a@b.com' });
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('returns null when the user is not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);
      expect(await controller.getMe({ user: { id: 'ghost' } })).toBeNull();
    });
  });

  describe('updateMe', () => {
    it('applies the update then returns the safe user', async () => {
      mockUsersService.update.mockResolvedValue(undefined);
      mockUsersService.findById.mockResolvedValue({ id: 'u1', name: 'Bob', passwordHash: 'x' });
      const result = await controller.updateMe({ user: { id: 'u1' } }, { name: 'Bob' } as any);
      expect(mockUsersService.update).toHaveBeenCalledWith('u1', { name: 'Bob' });
      expect(result).toEqual({ id: 'u1', name: 'Bob' });
    });

    describe('interface language (NEM-025 Checkpoint A)', () => {
      const prev = process.env.FR_CA_ENABLED;
      afterEach(() => {
        if (prev === undefined) delete process.env.FR_CA_ENABLED;
        else process.env.FR_CA_ENABLED = prev;
      });

      it.each(['es', 'en'])('stores %p as before', async (lang) => {
        delete process.env.FR_CA_ENABLED;
        mockUsersService.findById.mockResolvedValue({ id: 'u1', uiLanguage: lang });
        await controller.updateMe({ user: { id: 'u1' } }, { uiLanguage: lang } as any);
        expect(mockUsersService.update).toHaveBeenCalledWith('u1', { uiLanguage: lang });
      });

      it('refuses fr-CA while the French readiness gate is closed, without writing anything', async () => {
        delete process.env.FR_CA_ENABLED;
        await expect(
          controller.updateMe({ user: { id: 'u1' } }, { uiLanguage: 'fr-CA' } as any),
        ).rejects.toThrow('Unsupported interface language');
        expect(mockUsersService.update).not.toHaveBeenCalled();
      });

      it('refuses fr-CA when the gate has any value other than exactly "true"', async () => {
        process.env.FR_CA_ENABLED = 'TRUE';
        await expect(
          controller.updateMe({ user: { id: 'u1' } }, { uiLanguage: 'fr-CA' } as any),
        ).rejects.toThrow('Unsupported interface language');
        expect(mockUsersService.update).not.toHaveBeenCalled();
      });

      it('stores fr-CA only when the gate is explicitly open', async () => {
        process.env.FR_CA_ENABLED = 'true';
        mockUsersService.findById.mockResolvedValue({ id: 'u1', uiLanguage: 'fr-CA' });
        await controller.updateMe({ user: { id: 'u1' } }, { uiLanguage: 'fr-CA' } as any);
        expect(mockUsersService.update).toHaveBeenCalledWith('u1', { uiLanguage: 'fr-CA' });
      });

      it('only ever updates the authenticated caller (no cross-account write)', async () => {
        delete process.env.FR_CA_ENABLED;
        mockUsersService.findById.mockResolvedValue({ id: 'u2', uiLanguage: 'en' });
        await controller.updateMe({ user: { id: 'u2' } }, { uiLanguage: 'en' } as any);
        expect(mockUsersService.update).toHaveBeenCalledTimes(1);
        expect(mockUsersService.update).toHaveBeenCalledWith('u2', { uiLanguage: 'en' });
      });
    });
  });

  describe('updateOnboarding', () => {
    it('delegates to the service with the caller id and dto', async () => {
      const state = { welcome: 'in_progress', welcomeStep: 1, tours: {} };
      mockUsersService.updateOnboarding.mockResolvedValue(state);
      const dto = { welcome: 'in_progress' as const, welcomeStep: 1 };

      const result = await controller.updateOnboarding({ user: { id: 'u1' } }, dto);

      expect(mockUsersService.updateOnboarding).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(state);
    });
  });

  describe('deleteMe', () => {
    it('delegates account deletion to the service', () => {
      mockUsersService.deleteAccount.mockResolvedValue(undefined);
      controller.deleteMe({ user: { id: 'u1' } });
      expect(mockUsersService.deleteAccount).toHaveBeenCalledWith('u1');
    });
  });
});
