import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type GiftCardStatus = 'sent' | 'claimed' | 'expired';

@Entity('gift_cards')
export class GiftCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  buyerUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  buyerEmail: string | null;

  @Column({ type: 'varchar', length: 255 })
  recipientEmail: string;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  occasion: string | null;

  @Column({ type: 'int' })
  tokenCount: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  claimToken: string;

  @Column({ type: 'varchar', default: 'sent' })
  status: GiftCardStatus;

  @Column({ type: 'uuid', nullable: true })
  claimedByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 255 })
  stripeSessionId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
