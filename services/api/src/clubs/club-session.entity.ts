import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Book } from '../books/book.entity';
import { User } from '../users/user.entity';
import { Club } from './club.entity';

export type SessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

@Entity('club_sessions')
export class ClubSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clubId: string;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column({ type: 'uuid' })
  bookId: string;

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookId' })
  book: Book;

  @Column({ type: 'uuid' })
  hostId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostId' })
  host: User;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'varchar', default: 'scheduled' })
  status: SessionStatus;

  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'int' })
  startPhraseIndex: number;

  @Column({ type: 'int' })
  endPhraseIndex: number;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
