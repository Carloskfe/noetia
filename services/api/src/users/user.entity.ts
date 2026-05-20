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

export enum HostingTier {
  BASIC = 'basic',
  STARTER = 'starter',
  PRO = 'pro',
}

export const HOSTING_TIER_LIMITS: Record<HostingTier, number> = {
  [HostingTier.BASIC]: 1,
  [HostingTier.STARTER]: 3,
  [HostingTier.PRO]: 12,
};

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

  @Column({ type: 'varchar', nullable: true })
  stripeCustomerId: string | null;

  @Column({ type: 'enum', enum: HostingTier, default: HostingTier.BASIC })
  hostingTier: HostingTier;

  @Column({ type: 'boolean', default: true })
  emailConfirmed: boolean;

  @Column({ type: 'varchar', length: 5, default: 'es' })
  uiLanguage: string;

  @Column({ type: 'boolean', default: false })
  isAdmin: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}
