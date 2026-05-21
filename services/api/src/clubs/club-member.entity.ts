import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Club } from './club.entity';

export type ClubRole   = 'admin' | 'moderator' | 'member';
export type MemberStatus = 'active' | 'banned';

@Entity('club_members')
export class ClubMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clubId: string;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', default: 'member' })
  role: ClubRole;

  @Column({ type: 'varchar', default: 'active' })
  status: MemberStatus;

  @Column({ type: 'timestamptz', nullable: true })
  bannedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  bannedById: string | null;

  @Column({ type: 'boolean', default: true })
  notifNearbyComment: boolean;

  @Column({ type: 'boolean', default: true })
  notifNewBook: boolean;

  @Column({ type: 'boolean', default: true })
  notifMilestone: boolean;

  @Column({ type: 'boolean', default: true })
  notifSession: boolean;

  @Column({ type: 'boolean', default: false })
  notifConfigured: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;
}
