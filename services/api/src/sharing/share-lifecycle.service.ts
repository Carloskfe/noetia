import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { Share } from './share.entity';

const CARD_BUCKET = 'images';
// image-gen stores every card as images/<uuid4>.png (image-gen/storage.py).
const CARD_KEY_RE = /\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png)$/i;

/** Storage key of a quote-card image URL, or null if it isn't one of ours. */
export function cardKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = CARD_KEY_RE.exec(url);
  return m ? m[1] : null;
}

/**
 * Share revocation and deletion (SA-001 D07, NEM-016 S3/G9).
 *
 * Lives in its own module with no dependency on fragments, books or users so
 * those modules can import it without a circular dependency.
 */
@Injectable()
export class ShareLifecycleService {
  private readonly logger = new Logger(ShareLifecycleService.name);

  constructor(
    @InjectRepository(Share) private readonly shareRepo: Repository<Share>,
    private readonly storage: StorageService,
  ) {}

  /**
   * Creator-initiated revocation. Idempotent. A share that doesn't exist or
   * belongs to someone else yields 404, so share ids can't be probed.
   */
  async revoke(shareId: string, userId: string): Promise<void> {
    const share = await this.shareRepo.findOneBy({ id: shareId });
    if (!share || share.createdById !== userId) throw new NotFoundException();
    if (share.revokedAt) return;
    share.revokedAt = new Date();
    await this.shareRepo.save(share);
    await this.removeImages([share.imageUrl]);
  }

  /** Revokes every live share made from a fragment (called when it's deleted). */
  async revokeForFragment(fragmentId: string): Promise<number> {
    const live = await this.shareRepo.find({ where: { fragmentId, revokedAt: IsNull() } });
    if (live.length === 0) return 0;
    const now = new Date();
    for (const s of live) s.revokedAt = now;
    await this.shareRepo.save(live);
    await this.removeImages(live.map((s) => s.imageUrl));
    return live.length;
  }

  /**
   * Account deletion: hard-deletes every share the user created, plus any share
   * of the user's fragments created by someone else (possible before the S1
   * ownership fix). Must run BEFORE the user row is deleted, because fragments
   * cascade away with it.
   */
  async deleteAllForUser(userId: string, manager: EntityManager): Promise<number> {
    const rows: Array<{ imageUrl: string }> = await manager.query(
      `DELETE FROM shares
        WHERE "createdById" = $1
           OR "fragmentId" IN (SELECT id FROM fragments WHERE "userId" = $1)
        RETURNING "imageUrl"`,
      [userId],
    );
    // pg returns [rows, count] for DELETE … RETURNING through manager.query.
    const deleted = Array.isArray(rows[0]) ? (rows[0] as Array<{ imageUrl: string }>) : rows;
    await this.removeImages(deleted.map((r) => r.imageUrl));
    return deleted.length;
  }

  /** Best-effort: a storage failure never blocks revocation or deletion. */
  private async removeImages(urls: Array<string | null | undefined>): Promise<void> {
    for (const url of urls) {
      const key = cardKeyFromUrl(url);
      if (!key) continue;
      try {
        await this.storage.delete(CARD_BUCKET, key);
      } catch {
        this.logger.warn(`card image cleanup failed for key ${key}`);
      }
    }
  }
}
