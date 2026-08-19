/**
 * NEM-006C — staging content orchestration.
 *
 * Takes an empty-ish staging environment to a reader-validatable one:
 * wires audio objects to books, rebuilds phrase-level sync maps from the VTT
 * corpus committed to the repository, and reports per-title outcomes.
 *
 * Design notes:
 *  - STAGING ONLY. `assertStagingTarget` fails closed: unless every signal says
 *    "staging", nothing runs. See NEM-006C §47.
 *  - State is derived from reality (DB + object store), never from a state file,
 *    so the run is idempotent and resumable for free (§13, §14).
 *  - One title's failure never aborts the run (§15); every outcome lands in the
 *    reconciliation report (§23).
 *  - Whisper is never re-run. The committed VTT corpus is the source (§3, §18).
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { CATALOGUE } from './catalogue';
import { minioAudioKey, titleSlug } from './audio-source-resolver';
import { WhisperSyncService } from './whisper-sync.service';

/** Coverage at or above which a title surfaces in the catalog (books.service.ts). */
export const SYNC_QUALITY_GATE = 0.9;

export type BookOutcome =
  | 'COMPLETE'
  | 'TEXT_ONLY'
  | 'SYNC_BELOW_GATE'
  | 'MISSING_VTT'
  | 'MISSING_AUDIO'
  | 'RIGHTS_REVIEW_REQUIRED'
  | 'FAILED'
  | 'SKIPPED';

export interface BookReportRow {
  title: string;
  author: string;
  language: string;
  status: BookOutcome;
  hasText: boolean;
  hasAudio: boolean;
  vttSource: string | null;
  syncCoverage: number | null;
  phrases: number | null;
  failureReason: string | null;
  provenance: 'repository' | 'production-public-domain-mirror' | 'none';
}

export interface StagingContentReport {
  generatedAt: string;
  dryRun: boolean;
  rows: BookReportRow[];
  totals: Record<string, number>;
}

/**
 * Titles whose committed VTT is not a plain slug of the title. Derived by
 * reconciling `transcriptions/` against `catalogue.ts` — see NEM-006C §6
 * ("do not assume every directory equals a valid current catalog title").
 * A wrong guess here is self-correcting: the ≥90% gate rejects a bad alignment.
 */
export const VTT_ALIASES: Record<string, string> = {
  'Don Juan Tenorio': 'don-juan',
  'Don Quijote de la Mancha — Vol. I': 'don-quijote-vol-1',
  'Don Quijote de la Mancha — Vol. II': 'don-quijote-vol-2',
  "Alice's Adventures in Wonderland": 'alices-adventures-in-wonderland',
  Leyendas: 'rimas-y-leyendas',
};

/** Catalogue entries deliberately excluded from staging until rights are settled. */
export const RIGHTS_PENDING_TITLES = new Set(['Magnifica Humanitas']);

export interface StagingGuardEnv {
  APP_ENV?: string;
  DB_NAME?: string;
  MINIO_PUBLIC_URL?: string;
  MINIO_ENDPOINT?: string;
}

/**
 * Fail-closed staging assertion (§47). Every signal must independently agree
 * that the destination is staging; ambiguity aborts. Deliberately does not
 * trust a single variable — APP_ENV alone is one `-e` flag away from a
 * catastrophic mistake.
 */
export function assertStagingTarget(env: StagingGuardEnv): void {
  const problems: string[] = [];

  if (env.APP_ENV !== 'staging') {
    problems.push(`APP_ENV must be "staging" (got ${JSON.stringify(env.APP_ENV ?? null)})`);
  }
  if (!env.DB_NAME || !/staging/i.test(env.DB_NAME)) {
    problems.push(`DB_NAME must contain "staging" (got ${JSON.stringify(env.DB_NAME ?? null)})`);
  }
  const publicUrl = env.MINIO_PUBLIC_URL ?? '';
  if (!/staging/i.test(publicUrl)) {
    problems.push(`MINIO_PUBLIC_URL must contain "staging" (got ${JSON.stringify(publicUrl || null)})`);
  }

  if (problems.length > 0) {
    throw new Error(
      'REFUSING TO RUN: destination is not unambiguously staging.\n  - ' +
        problems.join('\n  - ') +
        '\nNEM-006C authorizes staging writes only.',
    );
  }
}

@Injectable()
export class StagingContentService {
  private readonly logger = new Logger(StagingContentService.name);

  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(SyncMap) private readonly syncMapRepo: Repository<SyncMap>,
    private readonly whisperSync: WhisperSyncService,
  ) {}

  /**
   * Resolve the transcript for a title: alias first, then `<slug>.merged.vtt`,
   * then a per-chapter directory named exactly as the title.
   */
  resolveTranscript(title: string, transcriptionsDir: string): string | null {
    const alias = VTT_ALIASES[title];
    const candidates: string[] = [];
    if (alias) candidates.push(path.join(transcriptionsDir, `${alias}.merged.vtt`));
    candidates.push(path.join(transcriptionsDir, `${titleSlug(title)}.merged.vtt`));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }

    const dir = path.join(transcriptionsDir, title);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      const vtts = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.vtt'))
        .sort();
      if (vtts.length > 0) return path.join(dir, vtts[0]);
    }
    return null;
  }

  /**
   * Process one title. Never throws — every failure mode becomes a report row
   * so a single bad book cannot abort a full-catalog run (§15).
   */
  async stageBook(
    title: string,
    opts: {
      transcriptionsDir: string;
      audioObjectExists: (key: string) => Promise<boolean>;
      dryRun: boolean;
    },
  ): Promise<BookReportRow> {
    const entry = CATALOGUE.find((e) => e.title === title);
    const row: BookReportRow = {
      title,
      author: entry?.author ?? 'unknown',
      language: entry?.language ?? 'es',
      status: 'FAILED',
      hasText: false,
      hasAudio: false,
      vttSource: null,
      syncCoverage: null,
      phrases: null,
      failureReason: null,
      provenance: 'none',
    };

    try {
      if (RIGHTS_PENDING_TITLES.has(title)) {
        row.status = 'RIGHTS_REVIEW_REQUIRED';
        row.failureReason = 'rights pending — excluded from staging by policy';
        return row;
      }

      const book = await this.bookRepo.findOneBy({ title });
      if (!book) {
        row.status = 'SKIPPED';
        row.failureReason = 'no book row in staging (run seed-ingestion first)';
        return row;
      }
      row.hasText = Boolean(book.textFileKey);

      // ── Audio: keys are title slugs, so a prod mirror is portable across
      //    databases with different book UUIDs (audio-source-resolver.ts:53).
      const audioKey = minioAudioKey(title);
      const audioPresent = await opts.audioObjectExists(audioKey);
      row.hasAudio = audioPresent;
      if (audioPresent) {
        row.provenance = 'production-public-domain-mirror';
        if (!dryRunSkip(opts.dryRun) && book.audioStreamKey !== audioKey) {
          book.audioStreamKey = audioKey;
          await this.bookRepo.save(book);
        }
      }

      // ── Sync map from the committed VTT corpus.
      const transcript = this.resolveTranscript(title, opts.transcriptionsDir);
      if (!transcript) {
        row.status = audioPresent ? 'MISSING_VTT' : 'TEXT_ONLY';
        row.failureReason = 'no committed transcript for this title';
        return row;
      }
      row.vttSource = path.basename(transcript);
      if (row.provenance === 'none') row.provenance = 'repository';

      if (!audioPresent) {
        row.status = 'MISSING_AUDIO';
        row.failureReason = 'audio object absent in staging MinIO';
        return row;
      }

      if (opts.dryRun) {
        row.status = 'SKIPPED';
        row.failureReason = 'dry run — no writes';
        return row;
      }

      await this.whisperSync.syncBook(title, transcript);

      const syncMap = await this.syncMapRepo.findOneBy({ bookId: book.id });
      row.syncCoverage = syncMap?.syncCoverage ?? null;
      row.phrases = Array.isArray(syncMap?.phrases) ? syncMap!.phrases.length : null;
      row.status =
        (row.syncCoverage ?? 0) >= SYNC_QUALITY_GATE ? 'COMPLETE' : 'SYNC_BELOW_GATE';
      if (row.status === 'SYNC_BELOW_GATE') {
        row.failureReason = `coverage ${((row.syncCoverage ?? 0) * 100).toFixed(1)}% < ${
          SYNC_QUALITY_GATE * 100
        }% gate`;
      }
      return row;
    } catch (err: any) {
      row.status = 'FAILED';
      row.failureReason = err?.message ?? String(err);
      return row;
    }
  }

  /** Titles to process: the whole catalogue, or a caller-supplied subset. */
  listTargets(only?: string[]): string[] {
    const all = Array.from(new Set(CATALOGUE.map((e) => e.title)));
    if (!only || only.length === 0) return all;
    return all.filter((t) => only.includes(t));
  }

  buildReport(rows: BookReportRow[], dryRun: boolean): StagingContentReport {
    const totals: Record<string, number> = { attempted: rows.length };
    for (const row of rows) totals[row.status] = (totals[row.status] ?? 0) + 1;
    totals.readerValidatable = rows.filter((r) => r.status === 'COMPLETE').length;
    return { generatedAt: new Date().toISOString(), dryRun, rows, totals };
  }

  renderMarkdown(report: StagingContentReport): string {
    const lines: string[] = [];
    lines.push(`# Staging catalog reconciliation (NEM-006C)`);
    lines.push('');
    lines.push(`Generated: ${report.generatedAt}${report.dryRun ? ' · DRY RUN' : ''}`);
    lines.push('');
    lines.push('| Title | Lang | Text | Audio | VTT | Coverage | Status | Reason |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const r of [...report.rows].sort((a, b) => a.title.localeCompare(b.title))) {
      const cov = r.syncCoverage == null ? '—' : `${(r.syncCoverage * 100).toFixed(1)}%`;
      lines.push(
        `| ${r.title} | ${r.language} | ${r.hasText ? '✓' : '—'} | ${r.hasAudio ? '✓' : '—'} | ${
          r.vttSource ?? '—'
        } | ${cov} | ${r.status} | ${r.failureReason ?? ''} |`,
      );
    }
    lines.push('');
    lines.push('## Totals');
    lines.push('');
    for (const [k, v] of Object.entries(report.totals).sort()) lines.push(`- **${k}**: ${v}`);
    return lines.join('\n');
  }
}

/** Tiny helper kept separate so the dry-run branch reads clearly above. */
function dryRunSkip(dryRun: boolean): boolean {
  return dryRun;
}
