import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CausesService } from '../../../src/causes/causes.service';
import { Cause } from '../../../src/causes/cause.entity';
import { UserCausePreference } from '../../../src/causes/user-cause-preference.entity';

const mockCause = (slug: string): Cause => ({
  id: `cause-${slug}`,
  slug,
  name: slug,
  description: 'desc',
  statFact: 'fact',
  icon: '🐾',
  active: true,
  createdAt: new Date(),
});

const mockCauseRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockPrefRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('CausesService', () => {
  let service: CausesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CausesService,
        { provide: getRepositoryToken(Cause), useValue: mockCauseRepo },
        { provide: getRepositoryToken(UserCausePreference), useValue: mockPrefRepo },
      ],
    }).compile();
    service = module.get(CausesService);
  });

  describe('findAllActive', () => {
    it('returns active causes ordered by createdAt ASC', async () => {
      const causes = [mockCause('bienestar-animal'), mockCause('ninez-y-juventud')];
      mockCauseRepo.find.mockResolvedValue(causes);
      const result = await service.findAllActive();
      expect(mockCauseRepo.find).toHaveBeenCalledWith({ where: { active: true }, order: { createdAt: 'ASC' } });
      expect(result).toHaveLength(2);
    });
  });

  describe('getPreferences', () => {
    it('returns preference when found', async () => {
      const pref = { userId: 'u1', randomDistribution: false, cause1Id: 'c1', cause2Id: null };
      mockPrefRepo.findOne.mockResolvedValue(pref);
      const result = await service.getPreferences('u1');
      expect(result).toEqual(pref);
    });

    it('returns null when no preference exists', async () => {
      mockPrefRepo.findOne.mockResolvedValue(null);
      expect(await service.getPreferences('u1')).toBeNull();
    });
  });

  describe('savePreferences (PO-053: one cause or none)', () => {
    it('creates a single-cause preference when none exists', async () => {
      const animal = mockCause('bienestar-animal');
      mockCauseRepo.findOne.mockResolvedValue(animal);
      mockPrefRepo.findOne.mockResolvedValue(null);
      const newPref: any = { userId: 'u1' };
      mockPrefRepo.create.mockReturnValue(newPref);
      mockPrefRepo.save.mockImplementation(async (p) => p);

      const result = await service.savePreferences('u1', { cause1Id: animal.id });

      expect(mockCauseRepo.findOne).toHaveBeenCalledWith({ where: { id: animal.id, active: true } });
      expect(mockPrefRepo.create).toHaveBeenCalledWith({ userId: 'u1' });
      expect(result.cause1Id).toBe(animal.id);
      expect(result.cause1).toBe(animal);
      expect(result.cause2Id).toBeNull();
      expect(result.cause2).toBeNull();
      expect(result.randomDistribution).toBe(false);
    });

    it('replaces the previous cause when the user changes selection', async () => {
      const env = mockCause('medio-ambiente');
      mockCauseRepo.findOne.mockResolvedValue(env);
      const existing: any = {
        userId: 'u1',
        cause1Id: 'cause-bienestar-animal',
        cause1: mockCause('bienestar-animal'),
        cause2Id: null,
        cause2: null,
        randomDistribution: false,
      };
      mockPrefRepo.findOne.mockResolvedValue(existing);
      mockPrefRepo.save.mockImplementation(async (p) => p);

      const result = await service.savePreferences('u1', { cause1Id: env.id });

      expect(mockPrefRepo.create).not.toHaveBeenCalled();
      expect(result.cause1Id).toBe(env.id);
      expect(result.cause1).toBe(env);
    });

    it('stores no preference (equal split) when cause1Id is null or absent', async () => {
      const existing: any = { userId: 'u1', cause1Id: 'c1', cause1: mockCause('x'), cause2Id: null, randomDistribution: false };
      mockPrefRepo.findOne.mockResolvedValue(existing);
      mockPrefRepo.save.mockImplementation(async (p) => p);

      const result = await service.savePreferences('u1', { cause1Id: null });

      expect(mockCauseRepo.findOne).not.toHaveBeenCalled();
      expect(result.cause1Id).toBeNull();
      expect(result.cause1).toBeNull();
      expect(result.randomDistribution).toBe(false);

      const result2 = await service.savePreferences('u1', {});
      expect(result2.cause1Id).toBeNull();
    });

    it('normalises a legacy two-cause/random row to the single-cause shape on the next save', async () => {
      const kids = mockCause('ninez-y-juventud');
      mockCauseRepo.findOne.mockResolvedValue(kids);
      const legacy: any = { userId: 'u1', cause1Id: 'a', cause2Id: 'b', cause2: mockCause('b'), randomDistribution: true };
      mockPrefRepo.findOne.mockResolvedValue(legacy);
      mockPrefRepo.save.mockImplementation(async (p) => p);

      const result = await service.savePreferences('u1', { cause1Id: kids.id, cause2Id: null, randomDistribution: false });

      expect(result.cause1Id).toBe(kids.id);
      expect(result.cause2Id).toBeNull();
      expect(result.cause2).toBeNull();
      expect(result.randomDistribution).toBe(false);
    });

    it('rejects a second cause', async () => {
      await expect(service.savePreferences('u1', { cause1Id: 'a', cause2Id: 'b' })).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrefRepo.save).not.toHaveBeenCalled();
    });

    it('rejects random distribution', async () => {
      await expect(
        service.savePreferences('u1', { cause1Id: null, randomDistribution: true as unknown as false }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrefRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an unknown or inactive cause without saving', async () => {
      mockCauseRepo.findOne.mockResolvedValue(null);
      await expect(service.savePreferences('u1', { cause1Id: 'missing' })).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrefRepo.findOne).not.toHaveBeenCalled();
      expect(mockPrefRepo.save).not.toHaveBeenCalled();
    });

    it('propagates repository failures (no silent success)', async () => {
      mockPrefRepo.findOne.mockResolvedValue(null);
      mockPrefRepo.create.mockReturnValue({ userId: 'u1' });
      mockPrefRepo.save.mockRejectedValue(new Error('db down'));
      await expect(service.savePreferences('u1', { cause1Id: null })).rejects.toThrow('db down');
    });
  });
});
