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
  console.log('───────────────────────────────────────────────────\n');

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
