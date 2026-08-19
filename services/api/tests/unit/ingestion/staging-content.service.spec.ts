import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Book } from '../../../src/books/book.entity';
import { SyncMap } from '../../../src/books/sync-map.entity';
import {
  StagingContentService,
  assertStagingTarget,
  SYNC_QUALITY_GATE,
} from '../../../src/ingestion/staging-content.service';
import { WhisperSyncService } from '../../../src/ingestion/whisper-sync.service';

const STAGING_ENV = {
  APP_ENV: 'staging',
  DB_NAME: 'noetia_staging',
  MINIO_PUBLIC_URL: 'https://storage.staging.noetia.app',
};

/** A catalogue title guaranteed to exist, used for the happy paths. */
const TITLE = 'Niebla';

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: TITLE,
    textFileKey: 'book-1.txt',
    audioStreamKey: null,
    ...overrides,
  } as Book;
}

async function buildService(over: {
  book?: Book | null;
  syncMap?: Partial<SyncMap> | null;
  syncBook?: jest.Mock;
  save?: jest.Mock;
}) {
  const save = over.save ?? jest.fn(async (b) => b);
  const module = await Test.createTestingModule({
    providers: [
      StagingContentService,
      {
        provide: getRepositoryToken(Book),
        useValue: { findOneBy: jest.fn(async () => over.book ?? null), save },
      },
      {
        provide: getRepositoryToken(SyncMap),
        useValue: { findOneBy: jest.fn(async () => over.syncMap ?? null) },
      },
      {
        provide: WhisperSyncService,
        useValue: { syncBook: over.syncBook ?? jest.fn(async () => ({})) },
      },
    ],
  }).compile();
  return { service: module.get(StagingContentService), save };
}

/** Temp transcriptions corpus so resolution is tested against a real filesystem. */
function makeCorpus(files: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nem006c-'));
  for (const f of files) {
    const full = path.join(dir, f);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, 'WEBVTT\n');
  }
  return dir;
}

describe('assertStagingTarget (NEM-006C §47 hard guard)', () => {
  it('accepts an unambiguously staging destination', () => {
    expect(() => assertStagingTarget(STAGING_ENV)).not.toThrow();
  });

  it('refuses a production destination', () => {
    expect(() =>
      assertStagingTarget({
        APP_ENV: 'production',
        DB_NAME: 'noetia',
        MINIO_PUBLIC_URL: 'https://storage.noetia.app',
      }),
    ).toThrow(/REFUSING TO RUN/);
  });

  it('fails closed when APP_ENV says staging but the database is production', () => {
    expect(() =>
      assertStagingTarget({ ...STAGING_ENV, DB_NAME: 'noetia' }),
    ).toThrow(/DB_NAME must contain "staging"/);
  });

  it('fails closed when the object store points at production', () => {
    expect(() =>
      assertStagingTarget({ ...STAGING_ENV, MINIO_PUBLIC_URL: 'https://storage.noetia.app' }),
    ).toThrow(/MINIO_PUBLIC_URL must contain "staging"/);
  });

  it('fails closed on missing environment rather than assuming staging', () => {
    expect(() => assertStagingTarget({})).toThrow(/REFUSING TO RUN/);
  });

  it('reports every failing signal, not just the first', () => {
    try {
      assertStagingTarget({});
      throw new Error('should have thrown');
    } catch (err: any) {
      expect(err.message).toContain('APP_ENV');
      expect(err.message).toContain('DB_NAME');
      expect(err.message).toContain('MINIO_PUBLIC_URL');
    }
  });
});

describe('StagingContentService.resolveTranscript', () => {
  it('prefers an explicit alias over the plain slug', async () => {
    const { service } = await buildService({});
    const dir = makeCorpus(['don-juan.merged.vtt', 'don-juan-tenorio.merged.vtt']);
    expect(path.basename(service.resolveTranscript('Don Juan Tenorio', dir)!)).toBe(
      'don-juan.merged.vtt',
    );
  });

  it('falls back to the slugged merged transcript', async () => {
    const { service } = await buildService({});
    const dir = makeCorpus(['niebla.merged.vtt']);
    expect(path.basename(service.resolveTranscript(TITLE, dir)!)).toBe('niebla.merged.vtt');
  });

  it('falls back to a per-chapter directory named as the title', async () => {
    const { service } = await buildService({});
    const dir = makeCorpus([path.join('Acts', 'acts_01.vtt'), path.join('Acts', 'acts_02.vtt')]);
    expect(path.basename(service.resolveTranscript('Acts', dir)!)).toBe('acts_01.vtt');
  });

  it('returns null when nothing matches', async () => {
    const { service } = await buildService({});
    expect(service.resolveTranscript('No Such Book', makeCorpus([]))).toBeNull();
  });
});

describe('StagingContentService.stageBook', () => {
  const audioPresent = jest.fn(async () => true);
  const audioAbsent = jest.fn(async () => false);

  it('marks a title COMPLETE when coverage passes the gate', async () => {
    const { service } = await buildService({
      book: makeBook(),
      syncMap: { syncCoverage: 0.95, phrases: [{}, {}] as any },
    });
    const row = await service.stageBook(TITLE, {
      transcriptionsDir: makeCorpus(['niebla.merged.vtt']),
      audioObjectExists: audioPresent,
      dryRun: false,
    });
    expect(row.status).toBe('COMPLETE');
    expect(row.syncCoverage).toBe(0.95);
    expect(row.phrases).toBe(2);
    expect(row.provenance).toBe('production-public-domain-mirror');
  });

  it('marks SYNC_BELOW_GATE rather than silently claiming success', async () => {
    const { service } = await buildService({
      book: makeBook(),
      syncMap: { syncCoverage: SYNC_QUALITY_GATE - 0.05, phrases: [] as any },
    });
    const row = await service.stageBook(TITLE, {
      transcriptionsDir: makeCorpus(['niebla.merged.vtt']),
      audioObjectExists: audioPresent,
      dryRun: false,
    });
    expect(row.status).toBe('SYNC_BELOW_GATE');
    expect(row.failureReason).toMatch(/gate/);
  });

  it('reports MISSING_AUDIO without attempting synchronization', async () => {
    const syncBook = jest.fn();
    const { service } = await buildService({ book: makeBook(), syncBook });
    const row = await service.stageBook(TITLE, {
      transcriptionsDir: makeCorpus(['niebla.merged.vtt']),
      audioObjectExists: audioAbsent,
      dryRun: false,
    });
    expect(row.status).toBe('MISSING_AUDIO');
    expect(syncBook).not.toHaveBeenCalled();
  });

  it('reports MISSING_VTT when audio exists but no transcript does', async () => {
    const { service } = await buildService({ book: makeBook() });
    const row = await service.stageBook(TITLE, {
      transcriptionsDir: makeCorpus([]),
      audioObjectExists: audioPresent,
      dryRun: false,
    });
    expect(row.status).toBe('MISSING_VTT');
  });

  it('excludes rights-pending titles before touching the database', async () => {
    const findOneBy = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        StagingContentService,
        { provide: getRepositoryToken(Book), useValue: { findOneBy, save: jest.fn() } },
        { provide: getRepositoryToken(SyncMap), useValue: { findOneBy: jest.fn() } },
        { provide: WhisperSyncService, useValue: { syncBook: jest.fn() } },
      ],
    }).compile();
    const row = await module.get(StagingContentService).stageBook('Magnifica Humanitas', {
      transcriptionsDir: makeCorpus([]),
      audioObjectExists: audioPresent,
      dryRun: false,
    });
    expect(row.status).toBe('RIGHTS_REVIEW_REQUIRED');
    expect(findOneBy).not.toHaveBeenCalled();
  });

  it('SKIPs a catalogue title with no staging book row', async () => {
    const { service } = await buildService({ book: null });
    const row = await service.stageBook(TITLE, {
      transcriptionsDir: makeCorpus(['niebla.merged.vtt']),
      audioObjectExists: audioPresent,
      dryRun: false,
    });
    expect(row.status).toBe('SKIPPED');
  });

  it('isolates a per-book failure into a report row instead of throwing', async () => {
    const { service } = await buildService({
      book: makeBook(),
      syncBook: jest.fn(async () => {
        throw new Error('aligner exploded');
      }),
    });
    const row = await service.stageBook(TITLE, {
      transcriptionsDir: makeCorpus(['niebla.merged.vtt']),
      audioObjectExists: audioPresent,
      dryRun: false,
    });
    expect(row.status).toBe('FAILED');
    expect(row.failureReason).toBe('aligner exploded');
  });

  it('writes nothing in dry-run mode', async () => {
    const syncBook = jest.fn();
    const save = jest.fn();
    const { service } = await buildService({ book: makeBook(), syncBook, save });
    const row = await service.stageBook(TITLE, {
      transcriptionsDir: makeCorpus(['niebla.merged.vtt']),
      audioObjectExists: audioPresent,
      dryRun: true,
    });
    expect(row.status).toBe('SKIPPED');
    expect(syncBook).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('is idempotent: an already-wired audio key is not re-saved', async () => {
    const save = jest.fn();
    const { service } = await buildService({
      book: makeBook({ audioStreamKey: 'books/niebla-audio.mp3' }),
      syncMap: { syncCoverage: 0.95, phrases: [] as any },
      save,
    });
    await service.stageBook(TITLE, {
      transcriptionsDir: makeCorpus(['niebla.merged.vtt']),
      audioObjectExists: audioPresent,
      dryRun: false,
    });
    expect(save).not.toHaveBeenCalled();
  });
});

describe('StagingContentService reporting', () => {
  it('counts outcomes and derives the reader-validatable total', async () => {
    const { service } = await buildService({});
    const rows = [
      { status: 'COMPLETE' },
      { status: 'COMPLETE' },
      { status: 'SYNC_BELOW_GATE' },
      { status: 'RIGHTS_REVIEW_REQUIRED' },
    ] as any;
    const report = service.buildReport(rows, false);
    expect(report.totals.attempted).toBe(4);
    expect(report.totals.COMPLETE).toBe(2);
    expect(report.totals.readerValidatable).toBe(2);
  });

  it('renders every title as a markdown row', async () => {
    const { service } = await buildService({});
    const report = service.buildReport(
      [
        {
          title: 'Zeta',
          language: 'es',
          status: 'COMPLETE',
          hasText: true,
          hasAudio: true,
          vttSource: 'zeta.merged.vtt',
          syncCoverage: 0.97,
          failureReason: null,
        },
        {
          title: 'Alpha',
          language: 'en',
          status: 'MISSING_VTT',
          hasText: true,
          hasAudio: true,
          vttSource: null,
          syncCoverage: null,
          failureReason: 'no committed transcript for this title',
        },
      ] as any,
      false,
    );
    const md = service.renderMarkdown(report);
    expect(md).toContain('| Alpha |');
    expect(md).toContain('| Zeta |');
    expect(md.indexOf('| Alpha |')).toBeLessThan(md.indexOf('| Zeta |'));
    expect(md).toContain('97.0%');
  });
});

describe('StagingContentService.listTargets', () => {
  it('returns the whole catalogue by default', async () => {
    const { service } = await buildService({});
    expect(service.listTargets().length).toBeGreaterThan(50);
  });

  it('restricts to the requested titles', async () => {
    const { service } = await buildService({});
    expect(service.listTargets([TITLE])).toEqual([TITLE]);
  });

  it('ignores titles that are not in the catalogue', async () => {
    const { service } = await buildService({});
    expect(service.listTargets(['Not A Real Book'])).toEqual([]);
  });
});
