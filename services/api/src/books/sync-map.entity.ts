import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Book } from './book.entity';

export interface SyncPhrase {
  index: number;
  text: string;
  startTime: number;
  endTime: number;
  type?: 'text' | 'heading' | 'paragraph-break';
  /** True when the phrase could not be matched in the audio (no corresponding
   *  content found — e.g. appendix, glossary, footnotes not read aloud).
   *  The reader skips these phrases during playback sync. */
  exception?: boolean;
}

export type SyncSource = 'auto' | 'srt' | 'vtt' | 'manual' | 'whisper';

@Entity('sync_maps')
export class SyncMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bookId: string;

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookId' })
  book: Book;

  @Column({ type: 'jsonb', default: [] })
  phrases: SyncPhrase[];

  @Column({ type: 'varchar', default: 'auto' })
  syncSource: SyncSource;

  /** Fraction of text phrases successfully aligned: aligned / total (0–1). NULL means not yet computed. */
  @Column({ type: 'float', nullable: true, default: null })
  syncCoverage: number | null;

  /** Raw count of phrases marked exception (not found in audio). NULL means not yet computed. */
  @Column({ type: 'integer', nullable: true, default: null })
  syncExceptions: number | null;

  /** Average confidence score of aligned phrases (0–1). NULL means not yet computed. */
  @Column({ type: 'float', nullable: true, default: null })
  syncAvgConfidence: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
