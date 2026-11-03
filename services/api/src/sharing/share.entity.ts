import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import type { QuoteProvenance } from './quote-integrity.service';

/**
 * A public share landing page. Created when a user shares a fragment as a quote
 * card; the short `id` is the slug in the `/s/<id>` invite URL. Holds a snapshot
 * of what to render (quote, attribution, generated image) so the page never
 * needs the private fragment, plus `bookId` to drive the "read this book" CTA.
 */
@Entity('shares')
export class Share {
  /** Short URL-safe slug used in noetia.app/s/<id>. */
  @PrimaryColumn({ type: 'varchar', length: 16 })
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  bookId: string;

  @Column({ type: 'uuid', nullable: true })
  fragmentId: string | null;

  @Column({ type: 'text' })
  quote: string;

  @Column({ type: 'varchar' })
  author: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', nullable: true })
  citation: string | null;

  @Column({ type: 'varchar' })
  imageUrl: string;

  @Column({ type: 'varchar', nullable: true })
  platform: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'int', default: 0 })
  visitCount: number;

  /**
   * Set when the share is withdrawn (by its creator, by deleting the source
   * fragment, or by an admin). A revoked share is never served publicly and its
   * card image is removed from storage (SA-001 D07, NEM-016).
   */
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /**
   * sha256 of the creator + card configuration. Repeated Download / Copy link /
   * Publish clicks on the same card reuse one share instead of rendering a new
   * image each time (NEM-016, G8). Null for shares created before migration 068.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  configHash: string | null;

  /**
   * Where the quote was verified in the book source (SA-001 C1 traceability):
   * source kind, hash of the normalized source and the matched spans. Null for
   * shares created before migration 068.
   */
  @Column({ type: 'jsonb', nullable: true })
  quoteProvenance: QuoteProvenance | null;

  @CreateDateColumn()
  createdAt: Date;
}
