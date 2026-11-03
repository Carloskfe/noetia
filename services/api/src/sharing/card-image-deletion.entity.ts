import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Outbox of quote-card images that must be removed from the public `images/`
 * bucket (NEM-016). A row is written in the same transaction that revokes or
 * deletes the share, so a storage outage can never leave a withdrawn card
 * public without a pending retry. Holds only the random object key — no
 * personal data.
 */
@Entity('card_image_deletions')
export class CardImageDeletion {
  /** Object key in the images bucket: `<uuid4>.png`. */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  /** Error class name only (never a message, which could carry details). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  lastError: string | null;
}
