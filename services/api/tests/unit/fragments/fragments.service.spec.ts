import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { FragmentsService } from '../../../src/fragments/fragments.service';
import { Fragment } from '../../../src/fragments/fragment.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOneBy: jest.fn(),
  remove: jest.fn(),
});

const makeFragment = (overrides: Partial<Fragment> = {}): Fragment =>
  ({
    id: 'frag-1',
    userId: 'user-1',
    bookId: 'book-1',
    startPhraseIndex: null,
    endPhraseIndex: null,
    text: 'hello world',
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Fragment;

describe('FragmentsService', () => {
  let service: FragmentsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FragmentsService,
        { provide: getRepositoryToken(Fragment), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(FragmentsService);
    repo = module.get(getRepositoryToken(Fragment));
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and saves a fragment with bookId and text only', async () => {
      const fragment = makeFragment();
      repo.create.mockReturnValue(fragment);
      repo.save.mockResolvedValue(fragment);

      const result = await service.create('user-1', {
        bookId: 'book-1',
        text: 'hello world',
      });

      expect(repo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        bookId: 'book-1',
        text: 'hello world',
      });
      expect(result).toEqual(fragment);
    });

    it('does not pass phrase indices to the repository', async () => {
      const fragment = makeFragment();
      repo.create.mockReturnValue(fragment);
      repo.save.mockResolvedValue(fragment);

      await service.create('user-1', { bookId: 'book-1', text: 'some text' });

      expect(repo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ startPhraseIndex: expect.anything() }),
      );
    });
  });

  // ── findByUserAndBook ──────────────────────────────────────────────────────

  describe('findByUserAndBook', () => {
    it('returns fragments ordered by createdAt ASC', async () => {
      const fragments = [makeFragment(), makeFragment({ id: 'frag-2' })];
      repo.find.mockResolvedValue(fragments);

      const result = await service.findByUserAndBook('user-1', 'book-1');

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', bookId: 'book-1' },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(fragments);
    });

    it('returns empty array when no fragments', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.findByUserAndBook('user-1', 'book-1');
      expect(result).toEqual([]);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates note for owner', async () => {
      const fragment = makeFragment();
      const updated = { ...fragment, note: 'my note' };
      repo.findOneBy.mockResolvedValue(fragment);
      repo.save.mockResolvedValue(updated);

      const result = await service.update('frag-1', 'user-1', { note: 'my note' });

      expect(result.note).toBe('my note');
    });

    it('throws ForbiddenException for non-owner', async () => {
      repo.findOneBy.mockResolvedValue(makeFragment({ userId: 'other-user' }));

      await expect(service.update('frag-1', 'user-1', { note: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when fragment not found', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.update('frag-1', 'user-1', { note: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes fragment for owner', async () => {
      const fragment = makeFragment();
      repo.findOneBy.mockResolvedValue(fragment);
      repo.remove.mockResolvedValue(undefined);

      await service.remove('frag-1', 'user-1');

      expect(repo.remove).toHaveBeenCalledWith(fragment);
    });

    it('throws ForbiddenException for non-owner', async () => {
      repo.findOneBy.mockResolvedValue(makeFragment({ userId: 'other-user' }));

      await expect(service.remove('frag-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when fragment not found', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.remove('frag-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── combine ────────────────────────────────────────────────────────────────

  describe('combine', () => {
    it('combines two fragments by joining their texts with " … "', async () => {
      const frag1 = makeFragment({ id: 'f1', text: 'hello' });
      const frag2 = makeFragment({ id: 'f2', text: 'world' });
      const combined = makeFragment({ id: 'f3', text: 'hello … world' });

      repo.findOneBy.mockResolvedValueOnce(frag1).mockResolvedValueOnce(frag2);
      repo.create.mockReturnValue(combined);
      repo.save.mockResolvedValue(combined);
      repo.remove.mockResolvedValue(undefined);

      const result = await service.combine('user-1', ['f1', 'f2']);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'hello … world' }),
      );
      expect(repo.remove).toHaveBeenCalledWith([frag1, frag2]);
      expect(result).toEqual(combined);
    });

    it('combines three fragments in order with " … " separators', async () => {
      const frag1 = makeFragment({ id: 'f1', text: 'first' });
      const frag2 = makeFragment({ id: 'f2', text: 'second' });
      const frag3 = makeFragment({ id: 'f3', text: 'third' });
      const combined = makeFragment({ id: 'f4', text: 'first … second … third' });

      repo.findOneBy
        .mockResolvedValueOnce(frag1)
        .mockResolvedValueOnce(frag2)
        .mockResolvedValueOnce(frag3);
      repo.create.mockReturnValue(combined);
      repo.save.mockResolvedValue(combined);
      repo.remove.mockResolvedValue(undefined);

      await service.combine('user-1', ['f1', 'f2', 'f3']);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'first … second … third' }),
      );
    });

    it('does not include phrase indices in the combined fragment', async () => {
      const frag1 = makeFragment({ id: 'f1', text: 'hello' });
      const frag2 = makeFragment({ id: 'f2', text: 'world' });
      const combined = makeFragment({ id: 'f3', text: 'hello … world' });

      repo.findOneBy.mockResolvedValueOnce(frag1).mockResolvedValueOnce(frag2);
      repo.create.mockReturnValue(combined);
      repo.save.mockResolvedValue(combined);
      repo.remove.mockResolvedValue(undefined);

      await service.combine('user-1', ['f1', 'f2']);

      expect(repo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ startPhraseIndex: expect.anything() }),
      );
    });

    it('throws UnprocessableEntityException with fewer than 2 IDs', async () => {
      await expect(service.combine('user-1', ['f1'])).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws UnprocessableEntityException with empty array', async () => {
      await expect(service.combine('user-1', [])).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws ForbiddenException when fragment belongs to different user', async () => {
      const frag1 = makeFragment({ id: 'f1' });
      const frag2 = makeFragment({ id: 'f2', userId: 'other-user' });

      repo.findOneBy.mockResolvedValueOnce(frag1).mockResolvedValueOnce(frag2);

      await expect(service.combine('user-1', ['f1', 'f2'])).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when fragment not found', async () => {
      repo.findOneBy.mockResolvedValueOnce(makeFragment()).mockResolvedValueOnce(null);

      await expect(service.combine('user-1', ['f1', 'f2'])).rejects.toThrow(ForbiddenException);
    });

    it('throws UnprocessableEntityException when fragments span different books', async () => {
      const frag1 = makeFragment({ id: 'f1', bookId: 'book-1' });
      const frag2 = makeFragment({ id: 'f2', bookId: 'book-2' });

      repo.findOneBy.mockResolvedValueOnce(frag1).mockResolvedValueOnce(frag2);

      await expect(service.combine('user-1', ['f1', 'f2'])).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
