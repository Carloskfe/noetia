/**
 * Diagnose Escucha Activa sync drift for a book, WITHOUT re-writing its sync map.
 *
 * Answers the question "why is the audio N phrases behind the highlight?" by
 * re-locating each phrase's true spoken onset from the committed Whisper VTT and
 * comparing it against the sync map the DB actually serves. See sync-diagnostics.ts.
 *
 * Usage (inside the api container):
 *   docker compose exec api npx ts-node -r tsconfig-paths/register \
 *     src/ingestion/diagnose-sync.ts \
 *     --book "Marianela" \
 *     --transcript /app/transcriptions/marianela.merged.vtt
 *
 * Add --stored to diagnose the map currently in the DB (default); add
 * --realign to instead diagnose what the CURRENT aligner would produce from the
 * VTT (use this to check whether an aligner change fixes the offset before
 * re-seeding).
 */

import 'reflect-metadata';
import { readFile } from 'fs/promises';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { SyncMap, SyncPhrase } from '../books/sync-map.entity';
import { User } from '../users/user.entity';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';
import { PhraseSplitterService } from './phrase-splitter.service';
import { parseWhisperFile } from './whisper-parser';
import { alignPhrases } from './phrase-aligner';
import { diagnoseSync } from './sync-diagnostics';

@Injectable()
class DiagnoseRunner {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(SyncMap) private readonly syncMapRepo: Repository<SyncMap>,
    private readonly storage: StorageService,
    private readonly splitter: PhraseSplitterService,
  ) {}

  async run(title: string, transcript: string, realign: boolean) {
    const book = await this.bookRepo.findOneBy({ title });
    if (!book) throw new Error(`Book not found: "${title}"`);

    const content = await readFile(transcript, 'utf-8');
    const timedWords = parseWhisperFile(content, transcript);

    let phrases: SyncPhrase[];
    if (realign) {
      if (!book.textFileKey) throw new Error(`Book has no stored text: "${title}"`);
      const rawText = await this.storage.getText(book.textFileKey);
      const split = this.splitter.split(rawText);
      phrases = alignPhrases(split, timedWords).phrases;
    } else {
      const map = await this.syncMapRepo.findOneBy({ bookId: book.id });
      if (!map || !map.phrases?.length) {
        throw new Error(`No stored sync map for "${title}" — run with --realign instead.`);
      }
      phrases = map.phrases;
    }

    return diagnoseSync(phrases, timedWords, { book: title });
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get('DB_NAME', 'noetia'),
        username: config.get('DB_USER', 'noetia'),
        password: config.get('DB_PASS', 'changeme'),
        entities: [Book, SyncMap, User],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([Book, SyncMap]),
    StorageModule,
  ],
  providers: [DiagnoseRunner, PhraseSplitterService],
})
class DiagnoseModule {}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function bootstrap() {
  const book = arg('--book');
  const transcript = arg('--transcript');
  const realign = process.argv.includes('--realign');
  if (!book || !transcript) {
    console.error(
      'Usage: diagnose-sync.ts --book "Title" --transcript path/to/file.vtt [--realign]',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(DiagnoseModule, {
    logger: ['error', 'warn'],
  });
  const d = await app.get(DiagnoseRunner).run(book, transcript, realign);

  const verdict = d.editionCoverage < 0.6
    ? 'EDITION MISMATCH — stored text differs from the recording; fix the text first'
    : d.constantOffset && Math.abs(d.medianDeltaPhrases) >= 1
      ? `CONSTANT OFFSET — highlight runs ${d.medianDeltaPhrases > 0 ? 'AHEAD of' : 'BEHIND'} the audio by ~${Math.abs(d.medianDeltaPhrases)} phrase(s)`
      : !d.constantOffset
        ? 'ACCUMULATING DRIFT — offset grows across the book'
        : 'OK — no material offset detected';

  console.log('\n── Sync diagnostics ───────────────────────────────');
  console.log(`Book:              ${d.book}  (${realign ? 're-aligned from VTT' : 'stored DB map'})`);
  console.log(`Text phrases:      ${d.textPhrases}`);
  console.log(`Whisper words:     ${d.timedWords}`);
  console.log(`Edition coverage:  ${(d.editionCoverage * 100).toFixed(1)}%  (text tokens present in audio)`);
  console.log(`Leading extra:     ${d.leadingExtraWords} words / ${d.leadingExtraSeconds}s before phrase 0`);
  console.log(`Anchors located:   ${d.measured}`);
  console.log(`Median offset:     ${d.medianDeltaSeconds}s  ≈ ${d.medianDeltaPhrases} phrase(s)`);
  console.log(`Drift slope:       ${d.driftSlope}s/phrase  (${d.constantOffset ? 'constant' : 'growing'})`);
  console.log(`\nVERDICT: ${verdict}`);
  console.log('───────────────────────────────────────────────────');

  // ── Drift profile (--profile) ──────────────────────────────────────────────
  // Separates an anchor-noise ARTIFACT (isolated anchors mis-located to a
  // repeated/versed line — median ≈ 0 in every part of the book, a few wild
  // outliers) from REAL drift (offset ramps across the book). Only the latter
  // needs per-book text/transcription work; the former plays fine.
  if (process.argv.includes('--profile')) {
    const located = d.samples.filter((s) => s.deltaSeconds !== null) as
      Array<typeof d.samples[number] & { deltaSeconds: number }>;
    const n = located.length;
    const med = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const third = Math.max(1, Math.floor(n / 3));
    const t1 = located.slice(0, third);
    const t2 = located.slice(third, 2 * third);
    const t3 = located.slice(2 * third);
    const m1 = med(t1.map((s) => s.deltaSeconds));
    const m2 = med(t2.map((s) => s.deltaSeconds));
    const m3 = med(t3.map((s) => s.deltaSeconds));
    const OUT = 30; // seconds
    const outliers = located.filter((s) => Math.abs(s.deltaSeconds) > OUT);
    const spread = Math.max(Math.abs(m1), Math.abs(m2), Math.abs(m3));

    console.log('── Drift profile ──────────────────────────────────');
    console.log(`Offset by position:  first ${m1.toFixed(1)}s · middle ${m2.toFixed(1)}s · last ${m3.toFixed(1)}s`);
    console.log(`Outliers (|Δ|>${OUT}s): ${outliers.length} / ${n} anchors`);
    for (const o of outliers.slice(0, 8)) {
      console.log(`   phrase ${o.index}: Δ ${o.deltaSeconds.toFixed(1)}s  (confidence ${o.confidence})`);
    }
    const artifact = spread < 5 && outliers.length > 0 && outliers.length < n * 0.25;
    console.log(
      `→ ${artifact
        ? 'Looks like ANCHOR-NOISE ARTIFACT — median ≈ 0 across the book, isolated outliers. Likely plays fine; safe to reseed for the onset fix.'
        : 'Thirds diverge / many outliers — looks like REAL drift. Needs per-book text/transcription work; a reseed from this VTT will not fix it.'}`,
    );
    console.log('───────────────────────────────────────────────────');
  }
  console.log();

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
