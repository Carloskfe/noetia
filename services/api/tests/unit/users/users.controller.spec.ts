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
