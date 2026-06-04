import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type EngagementArchetype =
  | 'deep_reader'
  | 'social_sharer'
  | 'community'
  | 'browser'
  | 'reader';

export type ReadingCadence = 'daily' | 'weekend' | 'binge' | 'irregular';

@Entity('user_personas')
export class UserPersona {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  /** Top 5 themes by fragment frequency, ordered most → least */
  @Column({ type: 'jsonb', default: [] })
  dominantThemes: string[];

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  engagementArchetype: EngagementArchetype | null;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  readingCadence: ReadingCadence | null;

  /** Fraction of started books read past 80% (0–1). Null when no data. */
  @Column({ type: 'float', nullable: true })
  completionRate: number | null;

  /** fragment_shared events / fragment_created events */
  @Column({ type: 'float', default: 0 })
  socialAmplification: number;

  /** Platforms ordered by share frequency, e.g. ['instagram', 'linkedin'] */
  @Column({ type: 'jsonb', default: [] })
  preferredPlatforms: string[];

  /** Book categories ordered by fragment count, e.g. ['classic', 'personal-development'] */
  @Column({ type: 'jsonb', default: [] })
  topGenres: string[];

  /** Average minutes per active reading day (last 60 days) */
  @Column({ type: 'float', nullable: true })
  avgSessionMinutes: number | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'computed_at' })
  computedAt: Date;
}
