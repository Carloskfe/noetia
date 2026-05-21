import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

export type ClubType = 'public' | 'private' | 'author_event';

@Entity('clubs')
export class Club {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverUrl: string | null;

  @Column({ type: 'varchar', default: 'public' })
  type: ClubType;

  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'boolean', default: false })
  approvalRequired: boolean;

  @Column({ type: 'boolean', default: false })
  tokenRequired: boolean;

  @Column({ type: 'int', nullable: true })
  maxMembers: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
