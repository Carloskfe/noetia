import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Book } from '../books/book.entity';
import { User } from '../users/user.entity';
import { Club } from './club.entity';

export type PollStatus = 'open' | 'closed';

@Entity('club_polls')
export class ClubPoll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clubId: string;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'varchar', length: 255 })
  question: string;

  @Column({ type: 'varchar', default: 'open' })
  status: PollStatus;

  @Column({ type: 'timestamptz' })
  closesAt: Date;

  @Column({ type: 'uuid', nullable: true })
  winnerOptionId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity('club_poll_options')
export class ClubPollOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pollId: string;

  @ManyToOne(() => ClubPoll, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pollId' })
  poll: ClubPoll;

  @Column({ type: 'uuid' })
  bookId: string;

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookId' })
  book: Book;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity('club_poll_votes')
export class ClubPollVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pollId: string;

  @ManyToOne(() => ClubPoll, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pollId' })
  poll: ClubPoll;

  @Column({ type: 'uuid' })
  optionId: string;

  @ManyToOne(() => ClubPollOption, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'optionId' })
  option: ClubPollOption;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
