import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  bookId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  eventType: string;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
