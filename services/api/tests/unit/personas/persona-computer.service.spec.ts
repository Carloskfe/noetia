import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  PersonaComputerService,
  PersonaInput,
} from '../../../src/personas/persona-computer.service';
import { UserPersona } from '../../../src/personas/user-persona.entity';

const mockPersonaRepo = { create: jest.fn(), findOneBy: jest.fn() };

const mockDs = { query: jest.fn() };

/** Build a complete PersonaInput with sensible defaults */
function input(overrides: Partial<PersonaInput> = {}): PersonaInput {
  return {
    totalFragments: 5,
    socialAmplification: 0,
    avgFragmentsPerBook: 2,
    clubDiscussions: 0,
    activeDays: 15,
    weekendDays: 4,
    avgMinutes: 25,
    ...overrides,
  };
}

describe('PersonaComputerService — static decision trees', () => {
  // ── computeArchetype ──────────────────────────────────────────────────────

  describe('computeArchetype', () => {
    it('returns social_sharer when amplification > 0.3', () => {
      expect(
        PersonaComputerService.computeArchetype(input({ socialAmplification: 0.5 })),
      ).toBe('social_sharer');
    });

    it('returns community when club discussions >= 5', () => {
      expect(
        PersonaComputerService.computeArchetype(input({ clubDiscussions: 6 })),
      ).toBe('community');
    });

    it('social_sharer takes precedence over community', () => {
      expect(
        PersonaComputerService.computeArchetype(
          input({ socialAmplification: 0.5, clubDiscussions: 10 }),
        ),
      ).toBe('social_sharer');
    });

    it('returns deep_reader when fragments >= 10 and avg per book >= 3', () => {
      expect(
        PersonaComputerService.computeArchetype(
          input({ totalFragments: 12, avgFragmentsPerBook: 4 }),
        ),
      ).toBe('deep_reader');
    });

    it('returns browser when fewer than 3 fragments', () => {
      expect(
        PersonaComputerService.computeArchetype(input({ totalFragments: 2 })),
      ).toBe('browser');
    });

    it('returns reader as default for moderate engagement', () => {
      expect(
        PersonaComputerService.computeArchetype(
          input({ totalFragments: 5, avgFragmentsPerBook: 2, socialAmplification: 0.1 }),
        ),
      ).toBe('reader');
    });

    it('browser threshold is strictly less than 3', () => {
      expect(
        PersonaComputerService.computeArchetype(input({ totalFragments: 3 })),
      ).not.toBe('browser');
    });
  });

  // ── computeCadence ────────────────────────────────────────────────────────

  describe('computeCadence', () => {
    it('returns irregular when activeDays is 0', () => {
      expect(PersonaComputerService.computeCadence(0, 0, 0)).toBe('irregular');
    });

    it('returns daily when activeDays >= 40', () => {
      expect(PersonaComputerService.computeCadence(42, 8, 30)).toBe('daily');
    });

    it('returns weekend when weekendDays / activeDays >= 0.6', () => {
      expect(PersonaComputerService.computeCadence(10, 7, 30)).toBe('weekend');
    });

    it('returns binge when <= 10 active days and avgMinutes >= 45', () => {
      expect(PersonaComputerService.computeCadence(8, 2, 60)).toBe('binge');
    });

    it('daily takes precedence over weekend ratio', () => {
      // 40 active days, all on weekends (impossible but tests priority)
      expect(PersonaComputerService.computeCadence(40, 40, 30)).toBe('daily');
    });

    it('returns irregular for scattered moderate usage', () => {
      expect(PersonaComputerService.computeCadence(12, 3, 25)).toBe('irregular');
    });
  });

  // ── computeCompletionRate ─────────────────────────────────────────────────

  describe('computeCompletionRate', () => {
    it('returns null when no progress rows', () => {
      expect(PersonaComputerService.computeCompletionRate([])).toBeNull();
    });

    it('returns 1 when all books read past 80%', () => {
      const rows = [
        { phrase_index: 90, total_phrases: 100 },
        { phrase_index: 85, total_phrases: 100 },
      ];
      expect(PersonaComputerService.computeCompletionRate(rows)).toBe(1);
    });

    it('returns 0 when no books past 80%', () => {
      const rows = [{ phrase_index: 50, total_phrases: 100 }];
      expect(PersonaComputerService.computeCompletionRate(rows)).toBe(0);
    });

    it('returns 0.5 when half the books are completed', () => {
      const rows = [
        { phrase_index: 85, total_phrases: 100 },
        { phrase_index: 30, total_phrases: 100 },
      ];
      expect(PersonaComputerService.computeCompletionRate(rows)).toBe(0.5);
    });

    it('handles books with 0 total phrases gracefully', () => {
      const rows = [{ phrase_index: 0, total_phrases: 0 }];
      expect(PersonaComputerService.computeCompletionRate(rows)).toBe(0);
    });

    it('counts 80% threshold as completed', () => {
      const rows = [{ phrase_index: 80, total_phrases: 100 }];
      expect(PersonaComputerService.computeCompletionRate(rows)).toBe(1);
    });
  });
});

// ── computeForUser integration ──────────────────────────────────────────────

describe('PersonaComputerService — computeForUser', () => {
  let service: PersonaComputerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonaComputerService,
        { provide: DataSource, useValue: mockDs },
        { provide: getRepositoryToken(UserPersona), useValue: mockPersonaRepo },
      ],
    }).compile();

    service = module.get(PersonaComputerService);

    mockPersonaRepo.create.mockImplementation((v) => v);
  });

  function setupDefaultQueryResponses() {
    mockDs.query
      // dominant themes
      .mockResolvedValueOnce([{ theme: 'amor', cnt: '5' }, { theme: 'muerte', cnt: '2' }])
      // social amplification
      .mockResolvedValueOnce([{ shares: '2', creates: '10' }])
      // preferred platforms
      .mockResolvedValueOnce([{ platform: 'instagram', cnt: '2' }])
      // reading stats
      .mockResolvedValueOnce([{ active_days: '20', weekend_days: '6', avg_minutes: '30' }])
      // progress rows
      .mockResolvedValueOnce([{ phrase_index: 90, total_phrases: 100 }])
      // top genres
      .mockResolvedValueOnce([{ category: 'classic', fragment_count: '5' }])
      // club discussions
      .mockResolvedValueOnce([{ cnt: '1' }])
      // fragment stats
      .mockResolvedValueOnce([{ total: '12', avg_per_book: '4' }])
      // upsert
      .mockResolvedValueOnce(undefined);
  }

  it('computes all fields from aggregated query results', async () => {
    setupDefaultQueryResponses();

    const persona = await service.computeForUser('user-1');

    expect(persona.dominantThemes).toEqual(['amor', 'muerte']);
    expect(persona.socialAmplification).toBeCloseTo(0.2);
    expect(persona.preferredPlatforms).toEqual(['instagram']);
    expect(persona.engagementArchetype).toBe('deep_reader');
    expect(persona.readingCadence).toBe('irregular');
    expect(persona.completionRate).toBe(1);
    expect(persona.topGenres).toEqual(['classic']);
    expect(persona.avgSessionMinutes).toBe(30);
  });

  it('sets socialAmplification to 0 when no fragment_created events', async () => {
    mockDs.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ shares: '0', creates: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ active_days: '5', weekend_days: '1', avg_minutes: '20' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cnt: '0' }])
      .mockResolvedValueOnce([{ total: '1', avg_per_book: '1' }])
      .mockResolvedValueOnce(undefined);

    const persona = await service.computeForUser('user-2');
    expect(persona.socialAmplification).toBe(0);
  });

  it('sets avgSessionMinutes to null when user has no reading stats', async () => {
    mockDs.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ shares: '0', creates: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ active_days: '0', weekend_days: '0', avg_minutes: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cnt: '0' }])
      .mockResolvedValueOnce([{ total: '0', avg_per_book: '0' }])
      .mockResolvedValueOnce(undefined);

    const persona = await service.computeForUser('user-3');
    expect(persona.avgSessionMinutes).toBeNull();
  });

  it('executes the upsert SQL with the correct userId', async () => {
    setupDefaultQueryResponses();

    await service.computeForUser('user-99');

    // The upsert is the 9th query call
    const upsertCall = mockDs.query.mock.calls[8];
    expect(upsertCall[1][0]).toBe('user-99');
  });
});
