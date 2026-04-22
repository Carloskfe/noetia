import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
}

export enum UserType {
  PERSONAL = 'personal',
  AUTHOR = 'author',
  EDITORIAL = 'editorial',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  provider: AuthProvider;

  @Column({ type: 'varchar', nullable: true })
  providerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'enum', enum: UserType, nullable: true })
  userType: UserType | null;

  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @Column({ type: 'simple-array', nullable: true })
  languages: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  interests: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastLoginAt: Date;
}
