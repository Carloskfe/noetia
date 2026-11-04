import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  OVERDUE_ATTEMPTS,
  PURGE_REQUEST_BUDGET_MS,
  ShareLifecycleService,
  cardKeyFromUrl,
} from '../../../src/sharing/share-lifecycle.service';
import { CardImageDeletion } from '../../../src/sharing/card-image-deletion.entity';
import { Share } from '../../../src/sharing/share.entity';
import { StorageService, StorageTimeoutError } from '../../../src/storage/storage.service';

const KEY = '11111111-2222-4333-8444-555555555555.png';
const KEY2 = '99999999-2222-4333-8444-555555555555.png';
const IMG = `https://storage.noetia.app/images/${KEY}`;
const IMG2 = `https://storage.noetia.app/images/${KEY2}`;

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
  const m = { findOneBy: jest.fn(), find: jest.fn(), update: jest.fn(), query: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const deletionRepo = { update: jest.fn(), delete: jest.fn(), find: jest.fn() };
  const storage = { delete: jest.fn() };
  let service: ShareLifecycleService;
  const outboxInserts = () =>
    m.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO card_image_deletions'));

  beforeEach(async () => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation(async (cb) => cb(m));
    m.update.mockResolvedValue(undefined);
    m.query.mockResolvedValue(undefined);
    deletionRepo.update.mockResolvedValue(undefined);
    deletionRepo.delete.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        ShareLifecycleService,
        { provide: getRepositoryToken(CardImageDeletion), useValue: deletionRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(ShareLifecycleService);
  });

  describe('revoke', () => {
    it('revokes and queues the image in one transaction, then deletes it and clears the queue', async () => {
      m.findOneBy.mockResolvedValue({ id: 's1', createdById: 'u1', imageUrl: IMG, revokedAt: null });
      await service.revoke('s1', 'u1');

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(m.update).toHaveBeenCalledWith(Share, { id: 's1' }, { revokedAt: expect.any(Date) });
      expect(outboxInserts()[0][1]).toEqual([[KEY]]);
      expect(storage.delete).toHaveBeenCalledWith('images', KEY);
      expect(deletionRepo.delete).toHaveBeenCalledWith({ key: KEY });
    });

    it('purges only after the transaction committed', async () => {
      const order: string[] = [];
      m.findOneBy.mockResolvedValue({ id: 's1', createdById: 'u1', imageUrl: IMG, revokedAt: null });
      dataSource.transaction.mockImplementation(async (cb) => { const r = await cb(m); order.push('commit'); return r; });
      storage.delete.mockImplementation(async () => { order.push('storage'); });
      await service.revoke('s1', 'u1');
      expect(order).toEqual(['commit', 'storage']);
    });

    it("404s for another user's share and changes nothing", async () => {
      m.findOneBy.mockResolvedValue({ id: 's1', createdById: 'u2', imageUrl: IMG, revokedAt: null });
      await expect(service.revoke('s1', 'u1')).rejects.toThrow(NotFoundException);
      expect(m.update).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('404s for an unknown share', async () => {
      m.findOneBy.mockResolvedValue(null);
      await expect(service.revoke('nope', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('is idempotent for an already revoked share', async () => {
      m.findOneBy.mockResolvedValue({ id: 's1', createdById: 'u1', imageUrl: IMG, revokedAt: new Date() });
      await service.revoke('s1', 'u1');
      expect(m.update).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('keeps the queued deletion (with the attempt recorded) when storage is down', async () => {
      m.findOneBy.mockResolvedValue({ id: 's1', createdById: 'u1', imageUrl: IMG, revokedAt: null });
      storage.delete.mockRejectedValue(Object.assign(new Error('secret detail'), { name: 'NetworkingError' }));
      await expect(service.revoke('s1', 'u1')).resolves.toBeUndefined();
      expect(m.update).toHaveBeenCalled();
      expect(deletionRepo.delete).not.toHaveBeenCalled();
      const [where, patch] = deletionRepo.update.mock.calls[0];
      expect(where).toEqual({ key: KEY });
      expect(patch.lastError).toBe('NetworkingError'); // error class only, never the message
      expect(typeof patch.attempts).toBe('function');
    });

    it('does not queue or delete storage objects that are not quote cards', async () => {
      m.findOneBy.mockResolvedValue({ id: 's1', createdById: 'u1', imageUrl: 'https://x/books/a.txt', revokedAt: null });
      await service.revoke('s1', 'u1');
      expect(outboxInserts()).toHaveLength(0);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('propagates a database failure (nothing revoked, nothing purged)', async () => {
      dataSource.transaction.mockRejectedValue(new Error('db down'));
      await expect(service.revoke('s1', 'u1')).rejects.toThrow('db down');
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  describe('revokeForFragment (inside the caller transaction)', () => {
    it('revokes every live share of the fragment and queues their images', async () => {
      m.find.mockResolvedValue([{ id: 'a', imageUrl: IMG }, { id: 'b', imageUrl: IMG2 }]);
      await expect(service.revokeForFragment('f1', m as never)).resolves.toEqual([KEY, KEY2]);
      expect(m.update).toHaveBeenCalledWith(Share, ['a', 'b'], { revokedAt: expect.any(Date) });
      expect(outboxInserts()[0][1]).toEqual([[KEY, KEY2]]);
      expect(storage.delete).not.toHaveBeenCalled(); // caller purges after commit
    });

    it('does nothing when the fragment has no live shares', async () => {
      m.find.mockResolvedValue([]);
      await expect(service.revokeForFragment('f1', m as never)).resolves.toEqual([]);
      expect(m.update).not.toHaveBeenCalled();
    });
  });

  describe('revokeForBook (inside the caller transaction, NEM-016 F2)', () => {
    it('revokes every live share of the book and queues their images', async () => {
      m.find.mockResolvedValue([{ id: 'a', imageUrl: IMG }, { id: 'b', imageUrl: IMG2 }]);
      await expect(service.revokeForBook('book-1', m as never)).resolves.toEqual([KEY, KEY2]);
      expect(m.update).toHaveBeenCalledWith(Share, ['a', 'b'], { revokedAt: expect.any(Date) });
      expect(outboxInserts()[0][1]).toEqual([[KEY, KEY2]]);
      expect(storage.delete).not.toHaveBeenCalled(); // caller purges after commit
    });

    it('selects only live shares of that book', async () => {
      m.find.mockResolvedValue([]);
      await service.revokeForBook('book-1', m as never);
      const [entity, opts] = m.find.mock.calls[0];
      expect(entity).toBe(Share);
      expect(opts.where.bookId).toBe('book-1');
      expect(opts.where.revokedAt).toBeDefined();
    });

    it('does nothing when the book has no live shares', async () => {
      m.find.mockResolvedValue([]);
      await expect(service.revokeForBook('book-1', m as never)).resolves.toEqual([]);
      expect(m.update).not.toHaveBeenCalled();
      expect(outboxInserts()).toEqual([]);
    });

    it('propagates database errors so the caller rolls back', async () => {
      m.find.mockRejectedValue(new Error('db down'));
      await expect(service.revokeForBook('book-1', m as never)).rejects.toThrow('db down');
    });
  });

  describe('deleteAllForUser (inside the caller transaction)', () => {
    it("deletes the user's shares and shares of their fragments, and queues their images", async () => {
      m.query.mockImplementation(async (sql: string) =>
        sql.includes('DELETE FROM shares') ? [[{ imageUrl: IMG }, { imageUrl: IMG }], 2] : undefined,
      );
      await expect(service.deleteAllForUser('u1', m as never)).resolves.toEqual([KEY]);
      const [sql, params] = m.query.mock.calls[0];
      expect(sql).toContain('"createdById" = $1');
      expect(sql).toContain('"fragmentId" IN (SELECT id FROM fragments WHERE "userId" = $1)');
      expect(params).toEqual(['u1']);
      expect(outboxInserts()[0][1]).toEqual([[KEY]]);
    });

    it('accepts a plain row array result shape', async () => {
      m.query.mockImplementation(async (sql: string) => (sql.includes('DELETE') ? [{ imageUrl: IMG }] : undefined));
      await expect(service.deleteAllForUser('u1', m as never)).resolves.toEqual([KEY]);
    });

    it('handles a user with no shares', async () => {
      m.query.mockResolvedValue([[], 0]);
      await expect(service.deleteAllForUser('u1', m as never)).resolves.toEqual([]);
      expect(outboxInserts()).toHaveLength(0);
    });

    it('propagates database errors so the caller rolls back', async () => {
      m.query.mockRejectedValue(new Error('db down'));
      await expect(service.deleteAllForUser('u1', m as never)).rejects.toThrow('db down');
    });
  });

  describe('purgeImages', () => {
    it('never throws, even if clearing the queue fails', async () => {
      deletionRepo.delete.mockRejectedValue(new Error('db'));
      await expect(service.purgeImages([KEY])).resolves.toBeUndefined();
    });

    it('never throws if recording the failed attempt fails', async () => {
      storage.delete.mockRejectedValue(new Error('s3'));
      deletionRepo.update.mockRejectedValue(new Error('db'));
      await expect(service.purgeImages([KEY])).resolves.toBeUndefined();
    });
  });

  describe('bounded purge when storage stalls (NEM-016 F1)', () => {
    const live = { id: 's1', createdById: 'u1', imageUrl: IMG, revokedAt: null };

    it('records a timeout by class name and keeps the row for the sweep', async () => {
      m.findOneBy.mockResolvedValue(live);
      storage.delete.mockRejectedValue(new StorageTimeoutError());
      await expect(service.revoke('s1', 'u1')).resolves.toBeUndefined();
      expect(m.update).toHaveBeenCalled(); // the revocation itself committed
      expect(deletionRepo.delete).not.toHaveBeenCalled();
      expect(deletionRepo.update.mock.calls[0][1].lastError).toBe('StorageTimeoutError');
    });

    it('stops at the first timeout: a stalled store would stall every key', async () => {
      storage.delete.mockRejectedValue(new StorageTimeoutError());
      await service.purgeImages([KEY, KEY2]);
      expect(storage.delete).toHaveBeenCalledTimes(1);
      expect(deletionRepo.update).toHaveBeenCalledTimes(1);
      expect(deletionRepo.delete).not.toHaveBeenCalled(); // KEY2's row stays queued
    });

    it('keeps going after an ordinary failure on one key', async () => {
      storage.delete.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(undefined);
      await service.purgeImages([KEY, KEY2]);
      expect(storage.delete).toHaveBeenCalledTimes(2);
      expect(deletionRepo.delete).toHaveBeenCalledWith({ key: KEY2 });
    });

    it('stops when the request budget runs out and leaves the rest queued', async () => {
      const now = jest.spyOn(Date, 'now');
      let t = 1_000;
      now.mockImplementation(() => t);
      storage.delete.mockImplementation(async () => { t += PURGE_REQUEST_BUDGET_MS; });
      await service.purgeImages([KEY, KEY2]);
      now.mockRestore();
      expect(storage.delete).toHaveBeenCalledTimes(1);
      expect(deletionRepo.delete).toHaveBeenCalledTimes(1);
      expect(deletionRepo.delete).not.toHaveBeenCalledWith({ key: KEY2 });
    });

    it('a repeated revocation during the outage does not touch storage again', async () => {
      m.findOneBy.mockResolvedValueOnce(live).mockResolvedValueOnce({ ...live, revokedAt: new Date() });
      storage.delete.mockRejectedValue(new StorageTimeoutError());
      await service.revoke('s1', 'u1');
      await service.revoke('s1', 'u1');
      expect(storage.delete).toHaveBeenCalledTimes(1);
      expect(outboxInserts()).toHaveLength(1);
    });

    it('recovers: the sweep deletes the image once storage is back', async () => {
      m.findOneBy.mockResolvedValue(live);
      storage.delete.mockRejectedValueOnce(new StorageTimeoutError());
      await service.revoke('s1', 'u1');
      expect(deletionRepo.delete).not.toHaveBeenCalled();
      deletionRepo.find.mockResolvedValue([{ key: KEY, attempts: 1 }]);
      storage.delete.mockResolvedValue(undefined);
      await service.retryPendingDeletions();
      expect(storage.delete).toHaveBeenLastCalledWith('images', KEY);
      expect(deletionRepo.delete).toHaveBeenCalledWith({ key: KEY });
    });

    it('the sweep has no time budget, but still stops at a timeout', async () => {
      deletionRepo.find.mockResolvedValue([{ key: KEY, attempts: 0 }, { key: KEY2, attempts: 0 }]);
      storage.delete.mockRejectedValue(new StorageTimeoutError());
      await expect(service.retryPendingDeletions()).resolves.toBeUndefined();
      expect(storage.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('discardImage (R1: a card that never became a share)', () => {
    beforeEach(() => { (dataSource as unknown as { manager: unknown }).manager = m; });

    it('queues the image, deletes it and clears the queue', async () => {
      await service.discardImage(IMG);
      expect(outboxInserts()[0][1]).toEqual([[KEY]]);
      expect(storage.delete).toHaveBeenCalledWith('images', KEY);
      expect(deletionRepo.delete).toHaveBeenCalledWith({ key: KEY });
    });

    it('leaves it queued for the sweep if storage is down, and never throws', async () => {
      storage.delete.mockRejectedValue(new StorageTimeoutError());
      await expect(service.discardImage(IMG)).resolves.toBeUndefined();
      expect(outboxInserts()).toHaveLength(1);
      expect(deletionRepo.delete).not.toHaveBeenCalled();
      expect(deletionRepo.update.mock.calls[0][1].lastError).toBe('StorageTimeoutError');
    });

    it('still deletes the image if queueing fails, and never throws', async () => {
      m.query.mockRejectedValue(new Error('db down'));
      await expect(service.discardImage(IMG)).resolves.toBeUndefined();
      expect(storage.delete).toHaveBeenCalledWith('images', KEY);
    });

    it('ignores anything that is not a card URL', async () => {
      await service.discardImage('https://example.com/other.png');
      expect(outboxInserts()).toEqual([]);
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  describe('retryPendingDeletions (scheduled sweep)', () => {
    it('retries queued deletions oldest first and clears the ones that succeed', async () => {
      deletionRepo.find.mockResolvedValue([{ key: KEY, attempts: 1 }, { key: KEY2, attempts: 0 }]);
      storage.delete.mockImplementation(async (_b: string, k: string) => { if (k === KEY2) throw new Error('down'); });
      await service.retryPendingDeletions();
      expect(deletionRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'ASC' }, take: 100 });
      expect(deletionRepo.delete).toHaveBeenCalledWith({ key: KEY });
      expect(deletionRepo.delete).not.toHaveBeenCalledWith({ key: KEY2 });
      expect(deletionRepo.update).toHaveBeenCalledWith({ key: KEY2 }, expect.any(Object));
    });

    it('reports overdue deletions loudly', async () => {
      const err = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      deletionRepo.find.mockResolvedValue([{ key: KEY, attempts: OVERDUE_ATTEMPTS }]);
      storage.delete.mockRejectedValue(new Error('down'));
      await service.retryPendingDeletions();
      expect(err).toHaveBeenCalledWith(expect.stringContaining('still public'));
    });

    it('does nothing when the queue is empty', async () => {
      deletionRepo.find.mockResolvedValue([]);
      await service.retryPendingDeletions();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('never throws if the sweep itself fails', async () => {
      deletionRepo.find.mockRejectedValue(new Error('db down'));
      await expect(service.retryPendingDeletions()).resolves.toBeUndefined();
    });
  });
});
