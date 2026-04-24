import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../../../src/users/users.service';
import { User, AuthProvider } from '../../../src/users/user.entity';

const mockRepo = {
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
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
});
