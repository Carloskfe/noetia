import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('reading_stats')
@Index(['userId', 'date'], { unique: true })
export class ReadingStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  minutesRead: number;

  @Column({ type: 'int', default: 0 })
  phrasesRead: number;
}
