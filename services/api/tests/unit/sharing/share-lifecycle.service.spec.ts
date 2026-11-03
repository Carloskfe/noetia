import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShareLifecycleService, cardKeyFromUrl } from '../../../src/sharing/share-lifecycle.service';
import { Share } from '../../../src/sharing/share.entity';
import { StorageService } from '../../../src/storage/storage.service';

const KEY = '11111111-2222-4333-8444-555555555555.png';
const IMG = `https://storage.noetia.app/images/${KEY}`;

describe('cardKeyFromUrl', () => {
  it('extracts the uuid key of a quote-card image', () => {
    expect(cardKeyFromUrl(IMG)).toBe(KEY);
  });

  it.each([null, undefined, '', 'https://x/images/../secret.png', 'https://x/books/' + KEY, 'https://x/images/not-a-uuid.png'])(
    'returns null for %p',
    (u) => expect(cardKeyFromUrl(u as string)).toBeNull(),
  );
});

describe('ShareLifecycleService', () => {
  const repo = { findOneBy: jest.fn(), find: jest.fn(), save: jest.fn() };
  const storage = { delete: jest.fn() };
  const manager = { query: jest.fn() };
  let service: ShareLifecycleService;

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.save.mockImplementation(async (x) => x);
    storage.delete.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        ShareLifecycleService,
        { provide: getRepositoryToken(Share), useValue: repo },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(ShareLifecycleService);
  });

  describe('revoke', () => {
    it('marks the share revoked and deletes its card image', async () => {
      const share = { id: 's1', createdById: 'u1', imageUrl: IMG, revokedAt: null };
      repo.findOneBy.mockResolvedValue(share);
      await service.revoke('s1', 'u1');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', revokedAt: expect.any(Date) }));
      expect(storage.delete).toHaveBeenCalledWith('images', KEY);
    });

    it("404s for another user's share and changes nothing", async () => {
      repo.findOneBy.mockResolvedValue({ id: 's1', createdById: 'u2', imageUrl: IMG, revokedAt: null });
      await expect(service.revoke('s1', 'u1')).rejects.toThrow(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('404s for an unknown share', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.revoke('nope', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('is idempotent for an already revoked share', async () => {
      repo.findOneBy.mockResolvedValue({ id: 's1', createdById: 'u1', imageUrl: IMG, revokedAt: new Date() });
      await service.revoke('s1', 'u1');
      expect(repo.save).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('still revokes when the image cleanup fails', async () => {
      repo.findOneBy.mockResolvedValue({ id: 's1', createdById: 'u1', imageUrl: IMG, revokedAt: null });
      storage.delete.mockRejectedValue(new Error('minio down'));
      await expect(service.revoke('s1', 'u1')).resolves.toBeUndefined();
      expect(repo.save).toHaveBeenCalled();
    });

    it('never deletes storage objects that are not quote cards', async () => {
      repo.findOneBy.mockResolvedValue({ id: 's1', createdById: 'u1', imageUrl: 'https://x/books/a.txt', revokedAt: null });
      await service.revoke('s1', 'u1');
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  describe('revokeForFragment', () => {
    it('revokes every live share of the fragment and removes their images', async () => {
      const k2 = '99999999-2222-4333-8444-555555555555.png';
      repo.find.mockResolvedValue([
        { id: 'a', imageUrl: IMG, revokedAt: null },
        { id: 'b', imageUrl: `https://storage.noetia.app/images/${k2}`, revokedAt: null },
      ]);
      await expect(service.revokeForFragment('f1')).resolves.toBe(2);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.every((s: Share) => s.revokedAt instanceof Date)).toBe(true);
      expect(storage.delete).toHaveBeenCalledWith('images', KEY);
      expect(storage.delete).toHaveBeenCalledWith('images', k2);
    });

    it('does nothing when the fragment has no live shares', async () => {
      repo.find.mockResolvedValue([]);
      await expect(service.revokeForFragment('f1')).resolves.toBe(0);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllForUser', () => {
    it("deletes the user's shares and shares of their fragments, then their images", async () => {
      manager.query.mockResolvedValue([[{ imageUrl: IMG }], 1]); // pg DELETE … RETURNING shape
      await expect(service.deleteAllForUser('u1', manager as never)).resolves.toBe(1);
      const [sql, params] = manager.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM shares');
      expect(sql).toContain('"createdById" = $1');
      expect(sql).toContain('"fragmentId" IN (SELECT id FROM fragments WHERE "userId" = $1)');
      expect(params).toEqual(['u1']);
      expect(storage.delete).toHaveBeenCalledWith('images', KEY);
    });

    it('accepts a plain row array result shape', async () => {
      manager.query.mockResolvedValue([{ imageUrl: IMG }]);
      await expect(service.deleteAllForUser('u1', manager as never)).resolves.toBe(1);
    });

    it('handles a user with no shares', async () => {
      manager.query.mockResolvedValue([[], 0]);
      await expect(service.deleteAllForUser('u1', manager as never)).resolves.toBe(0);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('propagates database errors (deletion must not silently skip shares)', async () => {
      manager.query.mockRejectedValue(new Error('db down'));
      await expect(service.deleteAllForUser('u1', manager as never)).rejects.toThrow('db down');
    });
  });
});
