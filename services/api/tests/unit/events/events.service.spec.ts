import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsService } from '../../../src/events/events.service';
import { Event } from '../../../src/events/event.entity';

const mockRepo = { create: jest.fn(), save: jest.fn() };

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(Event), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe('emit', () => {
    it('saves an event record with the correct fields', async () => {
      const record = { id: 'ev-1' };
      mockRepo.create.mockReturnValue(record);
      mockRepo.save.mockResolvedValue(record);

      await service.emit('fragment_created', 'user-1', 'book-1', { fragmentId: 'frag-1' });

      expect(mockRepo.create).toHaveBeenCalledWith({
        eventType: 'fragment_created',
        userId: 'user-1',
        bookId: 'book-1',
        payload: { fragmentId: 'frag-1' },
      });
      expect(mockRepo.save).toHaveBeenCalledWith(record);
    });

    it('defaults payload to empty object when not provided', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({});

      await service.emit('book_viewed', 'user-1', 'book-1');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ payload: {} }),
      );
    });

    it('accepts null userId for unauthenticated events', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({});

      await service.emit('search_query', null, null, { query: 'quijote' });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null, bookId: null }),
      );
    });

    it('never throws when the database save fails', async () => {
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.emit('fragment_created', 'user-1', 'book-1', {}),
      ).resolves.toBeUndefined();
    });

    it('never throws when repo.create throws', async () => {
      mockRepo.create.mockImplementation(() => { throw new Error('repo broken'); });

      await expect(
        service.emit('fragment_created', 'user-1', 'book-1', {}),
      ).resolves.toBeUndefined();
    });
  });
});
