import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum BookCategory {
  LEADERSHIP = 'leadership',
  PERSONAL_DEVELOPMENT = 'personal-development',
  BUSINESS = 'business',
  CLASSIC = 'classic',
}

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  author: string;

  @Column({ type: 'varchar', nullable: true })
  isbn: string | null;

  @Column({ type: 'varchar', default: 'es' })
  language: string;

  @Column({ type: 'enum', enum: BookCategory })
  category: BookCategory;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  coverUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  textFileKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  audioFileKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  audioStreamKey: string | null;

  @Column({ type: 'boolean', default: false })
  isFree: boolean;

  @Column({ type: 'boolean', default: false })
  isPublished: boolean;

  @Column({ type: 'uuid', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
