import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

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

  @CreateDateColumn()
  createdAt: Date;
}
