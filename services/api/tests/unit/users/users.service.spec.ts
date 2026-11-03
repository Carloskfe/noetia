import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmailService } from '../../../src/email/email.service';
import { UsersService } from '../../../src/users/users.service';
import { User, AuthProvider } from '../../../src/users/user.entity';
import { ShareLifecycleService } from '../../../src/sharing/share-lifecycle.service';

const mockRepo = {
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockTxManager = { query: jest.fn(), delete: jest.fn() };
const mockDataSource = {
  manager: mockTxManager,
  transaction: jest.fn(async (cb: (m: typeof mockTxManager) => unknown) => cb(mockTxManager)),
};
const mockEmailService = { sendFarewell: jest.fn().mockResolvedValue(undefined) };
const mockShareLifecycle = { deleteAllForUser: jest.fn().mockResolvedValue([]), purgeImages: jest.fn().mockResolvedValue(undefined) };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ShareLifecycleService, useValue: mockShareLifecycle },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
    mockEmailService.sendFarewell.mockResolvedValue(undefined);
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      const user = { id: '1', email: 'a@b.com' };
      mockRepo.findOneBy.mockResolvedValue(user);
      expect(await service.findById('1')).toEqual(user);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ id: '1' });
    });

    it('returns null when no user matches the id', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      expect(await service.findById('missing')).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('queries the repository by email', async () => {
      const user = { id: '2', email: 'x@y.com' };
      mockRepo.findOneBy.mockResolvedValue(user);
      expect(await service.findByEmail('x@y.com')).toEqual(user);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ email: 'x@y.com' });
    });

    it('returns null when email is not found', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      expect(await service.findByEmail('ghost@test.com')).toBeNull();
    });
  });

  describe('findByProvider', () => {
    it('queries by provider and providerId', async () => {
      const user = { id: '3', provider: AuthProvider.GOOGLE, providerId: 'gid-1' };
      mockRepo.findOneBy.mockResolvedValue(user);
      const result = await service.findByProvider(AuthProvider.GOOGLE, 'gid-1');
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ provider: AuthProvider.GOOGLE, providerId: 'gid-1' });
      expect(result).toEqual(user);
    });

    it('returns null when provider combo is not found', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      expect(await service.findByProvider(AuthProvider.FACEBOOK, 'unknown')).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and saves a user, returning the saved entity', async () => {
      const data: Partial<User> = { name: 'Alice', email: 'alice@test.com' };
      const built = { ...data };
      const saved = { id: 'new-uuid', ...data };
      mockRepo.create.mockReturnValue(built);
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.create(data);

      expect(mockRepo.create).toHaveBeenCalledWith(data);
      expect(mockRepo.save).toHaveBeenCalledWith(built);
      expect(result).toEqual(saved);
    });
  });

  describe('update', () => {
    it('updates the user and returns the refreshed entity', async () => {
      const updated = { id: '1', name: 'Bob', email: 'b@test.com' };
      mockRepo.update.mockResolvedValue({ affected: 1 });
      mockRepo.findOneBy.mockResolvedValue(updated);

      const result = await service.update('1', { name: 'Bob' } as Partial<User>);

      expect(mockRepo.update).toHaveBeenCalledWith('1', { name: 'Bob' });
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ id: '1' });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteAccount', () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'Ana' };

    beforeEach(() => {
      mockRepo.findOneBy.mockResolvedValue(user);
      mockTxManager.query.mockReset().mockResolvedValue(undefined);
      mockTxManager.delete.mockReset().mockResolvedValue(undefined);
      mockDataSource.transaction.mockClear();
      mockShareLifecycle.deleteAllForUser.mockReset().mockResolvedValue([]);
      mockShareLifecycle.purgeImages.mockReset().mockResolvedValue(undefined);
      mockEmailService.sendFarewell.mockReset().mockResolvedValue(undefined);
    });

    it('deletes all related data then the user record, in one transaction', async () => {
      await service.deleteAccount('u1');

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockTxManager.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM "user_books"'), ['u1']);
      expect(mockTxManager.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM "subscriptions"'), ['u1']);
      expect(mockTxManager.delete).toHaveBeenCalledWith(User, 'u1');
    });

    it('deletes shares inside the transaction before the user row, and purges images after commit', async () => {
      const order: string[] = [];
      mockShareLifecycle.deleteAllForUser.mockImplementation(async (_id: string, m: unknown) => {
        expect(m).toBe(mockTxManager);
        order.push('shares');
        return ['k.png'];
      });
      mockTxManager.delete.mockImplementation(async () => { order.push('user'); });
      mockShareLifecycle.purgeImages.mockImplementation(async () => { order.push('purge'); });

      await service.deleteAccount('u1');

      expect(mockShareLifecycle.deleteAllForUser).toHaveBeenCalledWith('u1', mockTxManager);
      expect(mockShareLifecycle.purgeImages).toHaveBeenCalledWith(['k.png']);
      expect(order).toEqual(['shares', 'user', 'purge']);
    });

    it('rolls back everything if share deletion fails: no user delete, no purge, no farewell', async () => {
      mockShareLifecycle.deleteAllForUser.mockRejectedValueOnce(new Error('db down'));

      await expect(service.deleteAccount('u1')).rejects.toThrow('db down');
      expect(mockTxManager.delete).not.toHaveBeenCalled();
      expect(mockShareLifecycle.purgeImages).not.toHaveBeenCalled();
      expect(mockEmailService.sendFarewell).not.toHaveBeenCalled();
    });

    it('does not purge or e-mail if the user delete fails', async () => {
      mockTxManager.delete.mockRejectedValueOnce(new Error('fk'));
      await expect(service.deleteAccount('u1')).rejects.toThrow('fk');
      expect(mockShareLifecycle.purgeImages).not.toHaveBeenCalled();
      expect(mockEmailService.sendFarewell).not.toHaveBeenCalled();
    });

    it('sends farewell email after deletion', async () => {
      await service.deleteAccount('u1');
      expect(mockEmailService.sendFarewell).toHaveBeenCalledWith('a@b.com', 'Ana', 'es');
    });

    it('does nothing when user does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await service.deleteAccount('ghost');
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockShareLifecycle.deleteAllForUser).not.toHaveBeenCalled();
    });

    it('completes deletion even if farewell email fails', async () => {
      mockEmailService.sendFarewell.mockRejectedValue(new Error('SMTP down'));
      await expect(service.deleteAccount('u1')).resolves.toBeUndefined();
      expect(mockTxManager.delete).toHaveBeenCalledWith(User, 'u1');
    });
  });

  describe('updateOnboarding', () => {
    it('advances the welcome tour, preserving untouched fields', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        id: 'u1',
        onboardingState: { welcome: 'not_started', welcomeStep: 0, tours: { reader: true } },
      });
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateOnboarding('u1', { welcome: 'in_progress', welcomeStep: 2 });

      expect(mockRepo.update).toHaveBeenCalledWith('u1', {
        onboardingState: { welcome: 'in_progress', welcomeStep: 2, tours: { reader: true } },
      });
      expect(result).toEqual({ welcome: 'in_progress', welcomeStep: 2, tours: { reader: true } });
    });

    it('marks a per-surface tutorial seen without touching the welcome fields', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        id: 'u1',
        onboardingState: { welcome: 'completed', welcomeStep: 5, tours: {} },
      });
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateOnboarding('u1', { tourSeen: 'clubs' });

      expect(result).toEqual({ welcome: 'completed', welcomeStep: 5, tours: { clubs: true } });
    });

    it('falls back to the default state for a legacy row with no onboardingState', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id: 'u1', onboardingState: null });
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateOnboarding('u1', { welcome: 'skipped' });

      expect(result).toEqual({ welcome: 'skipped', welcomeStep: 0, tours: {} });
    });
  });
});
