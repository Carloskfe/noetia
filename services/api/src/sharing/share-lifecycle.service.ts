import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { StorageService, StorageTimeoutError } from '../storage/storage.service';
import { CardImageDeletion } from './card-image-deletion.entity';
import { Share } from './share.entity';

const CARD_BUCKET = 'images';
// image-gen stores every card as images/<uuid4>.png (image-gen/storage.py).
const CARD_KEY_RE = /\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png)$/i;
const RETRY_BATCH = 100;
/** Pending deletions older than this many attempts are reported on every sweep. */
export const OVERDUE_ATTEMPTS = 12;
/**
 * How long a waiting request may spend deleting images. Whatever isn't reached
 * stays queued for the sweep, so a large account can't hold a request open.
 */
export const PURGE_REQUEST_BUDGET_MS = 15_000;

/** Storage key of a quote-card image URL, or null if it isn't one of ours. */
export function cardKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = CARD_KEY_RE.exec(url);
  return m ? m[1] : null;
}

/**
 * Share revocation and deletion (SA-001 D07, NEM-016 S3/G9).
 *
 * Database changes and the image-deletion outbox row are written in ONE
 * transaction; the storage delete runs after commit and is retried by
 * `retryPendingDeletions` until it succeeds. So:
 *  - a revoked/deleted share is never served again (DB is authoritative), and
 *  - its card image is either deleted or queued — never silently forgotten.
 *
 * Lives in its own module with no dependency on fragments, books or users so
 * those modules can import it without a circular dependency.
 */
@Injectable()
export class ShareLifecycleService {
  private readonly logger = new Logger(ShareLifecycleService.name);

  constructor(
    @InjectRepository(CardImageDeletion) private readonly deletionRepo: Repository<CardImageDeletion>,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
  ) {}

  /**
   * Creator-initiated revocation. Idempotent. A share that doesn't exist or
   * belongs to someone else yields 404, so share ids can't be probed.
   */
  async revoke(shareId: string, userId: string): Promise<void> {
    const keys = await this.dataSource.transaction(async (m) => {
      const share = await m.findOneBy(Share, { id: shareId });
      if (!share || share.createdById !== userId) throw new NotFoundException();
      if (share.revokedAt) return [];
      await m.update(Share, { id: shareId }, { revokedAt: new Date() });
      return this.enqueue(m, [share.imageUrl]);
    });
    await this.purgeImages(keys);
  }

  /**
   * Revokes every live share made from a fragment, inside the caller's
   * transaction. Returns the image keys to pass to `purgeImages` after commit.
   */
  async revokeForFragment(fragmentId: string, m: EntityManager): Promise<string[]> {
    const live = await m.find(Share, { where: { fragmentId, revokedAt: IsNull() } });
    if (live.length === 0) return [];
    await m.update(Share, live.map((s) => s.id), { revokedAt: new Date() });
    return this.enqueue(m, live.map((s) => s.imageUrl));
  }

  /**
   * Revokes every live share of a book, inside the caller's transaction. Shares
   * have no foreign key to books, so deleting a book doesn't touch them by itself
   * (NEM-016 F2). Returns the image keys to pass to `purgeImages` after commit.
   */
  async revokeForBook(bookId: string, m: EntityManager): Promise<string[]> {
    const live = await m.find(Share, { where: { bookId, revokedAt: IsNull() } });
    if (live.length === 0) return [];
    await m.update(Share, live.map((s) => s.id), { revokedAt: new Date() });
    return this.enqueue(m, live.map((s) => s.imageUrl));
  }

  /**
   * Account deletion, inside the caller's transaction: hard-deletes every share
   * the user created plus any share of the user's fragments created by someone
   * else (possible before the S1 fix). Must run BEFORE the user row is deleted,
   * because fragments cascade away with it. Returns image keys for `purgeImages`.
   */
  async deleteAllForUser(userId: string, m: EntityManager): Promise<string[]> {
    const res: unknown = await m.query(
      `DELETE FROM shares
        WHERE "createdById" = $1
           OR "fragmentId" IN (SELECT id FROM fragments WHERE "userId" = $1)
        RETURNING "imageUrl"`,
      [userId],
    );
    // pg returns [rows, count] for DELETE … RETURNING through manager.query.
    const rows = (Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res) as Array<{ imageUrl: string }>;
    return this.enqueue(m, rows.map((r) => r.imageUrl));
  }

  /**
   * Deletes the given card images now. Success clears the outbox row; failure
   * records the attempt and leaves it for the retry sweep. Never throws.
   *
   * Stops at the first timeout (a stalled store would stall every key) or when
   * `budgetMs` runs out. Keys not reached keep their outbox rows for the sweep.
   */
  async purgeImages(keys: string[], budgetMs = PURGE_REQUEST_BUDGET_MS): Promise<void> {
    const stopAt = Date.now() + budgetMs;
    for (const key of keys) {
      if (Date.now() >= stopAt) {
        this.logger.warn('card image deletion budget used; the sweep will finish the rest');
        return;
      }
      try {
        await this.storage.delete(CARD_BUCKET, key); // idempotent: a missing key is success
      } catch (err) {
        await this.deletionRepo
          .update({ key }, {
            attempts: () => '"attempts" + 1',
            lastAttemptAt: new Date(),
            lastError: (err as Error)?.name?.slice(0, 64) ?? 'Error',
          } as never)
          .catch(() => undefined);
        this.logger.warn(`card image deletion deferred for key ${key}`);
        if (err instanceof StorageTimeoutError) return;
        continue;
      }
      await this.deletionRepo.delete({ key }).catch(() => {
        this.logger.warn(`card image ${key} deleted but outbox row not cleared; next sweep will retry`);
      });
    }
  }

  /** Retries queued deletions (storage outage, crash between commit and purge). */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryPendingDeletions(): Promise<void> {
    try {
      const pending = await this.deletionRepo.find({ order: { createdAt: 'ASC' }, take: RETRY_BATCH });
      if (pending.length === 0) return;
      // No request is waiting here, so only the timeout stop applies.
      await this.purgeImages(pending.map((p) => p.key), Number.POSITIVE_INFINITY);
      const overdue = pending.filter((p) => p.attempts + 1 >= OVERDUE_ATTEMPTS).length;
      if (overdue > 0) {
        this.logger.error(`${overdue} withdrawn card image(s) still public after ${OVERDUE_ATTEMPTS}+ attempts`);
      }
    } catch {
      this.logger.warn('card image deletion sweep failed; will retry');
    }
  }

  /** Queues card-image keys in the outbox within transaction `m`. */
  private async enqueue(m: EntityManager, urls: Array<string | null | undefined>): Promise<string[]> {
    const keys = [...new Set(urls.map(cardKeyFromUrl).filter((k): k is string => !!k))];
    if (keys.length > 0) {
      await m.query(
        `INSERT INTO card_image_deletions ("key") SELECT unnest($1::varchar[]) ON CONFLICT ("key") DO NOTHING`,
        [keys],
      );
    }
    return keys;
  }
}
