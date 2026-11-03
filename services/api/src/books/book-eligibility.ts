import { Repository } from 'typeorm';
import { Book } from './book.entity';

/**
 * Quality gate: never surface a title we can't offer cleanly (incomplete /
 * no audio / poor sync produces errors in front of the user). An INGESTED
 * (free-library) book must have a Whisper sync map ≥ 90% coverage; if it was
 * culled below the gate it stays hidden — being isFree=false is NOT a pass
 * (that previously let culled books like Don Quijote leak into discovery).
 * Only genuine AUTHOR/publisher uploads (uploadedById set) bypass the gate —
 * authors manage their own quality through the admin flow.
 *
 * Single definition shared by discovery (GET /books) and public sharing
 * (NEM-016 S14) so the two can't drift apart.
 */
export function qualityGateSql(alias: string): string {
  return `(
      ${alias}."uploadedById" IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM sync_maps sm
        WHERE sm."bookId" = ${alias}.id
          AND sm."syncCoverage" >= 0.90
      )
    )`;
}

/**
 * True when a book may appear on public surfaces (share pages, share creation):
 * published and passing the quality gate.
 */
export async function isBookPubliclyEligible(
  bookRepo: Repository<Book>,
  bookId: string,
): Promise<boolean> {
  const count = await bookRepo
    .createQueryBuilder('book')
    .where('book.id = :bookId', { bookId })
    .andWhere('book.isPublished = :published', { published: true })
    .andWhere(qualityGateSql('book'))
    .getCount();
  return count > 0;
}
