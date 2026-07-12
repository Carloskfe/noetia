/**
 * Reports sync quality for all free books and optionally culls those below threshold.
 *
 * Usage:
 *   docker compose exec api npx ts-node -r tsconfig-paths/register \
 *     src/ingestion/sync-quality-report.ts
 *
 * Options:
 *   --threshold 0.90   Minimum syncCoverage to pass (default: 0.90 — the project
 *                      standard; see CLAUDE.md §Sync Quality Status)
 *   --cull             Set isFree=false on books that FAIL or have no sync data
 *   --all              Include non-free books in the report
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { User } from '../users/user.entity';

function parseArgs(): { threshold: number; cull: boolean; all: boolean } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    threshold: parseFloat(get('--threshold') ?? '0.90'),
    cull: args.includes('--cull'),
    all: args.includes('--all'),
  };
}

@Injectable()
class ReportService {
  constructor(
    @InjectRepository(Book)    private readonly bookRepo: Repository<Book>,
    @InjectRepository(SyncMap) private readonly syncMapRepo: Repository<SyncMap>,
  ) {}

  async run(threshold: number, cull: boolean, all: boolean): Promise<void> {
    const where = all ? {} : { isFree: true };
    const books = await this.bookRepo.find({ where, order: { language: 'ASC', title: 'ASC' } });

    const syncMaps = await this.syncMapRepo.find();
    const mapByBook = new Map(syncMaps.map((m) => [m.bookId, m]));

    let pass = 0;
    let fail = 0;
    let noSync = 0;
    const toCull: Book[] = [];

    const col = (s: string, w: number) => s.padEnd(w).slice(0, w);

    console.log('\n' + '─'.repeat(108));
    console.log(
      col('Title', 40) +
      col('Lang', 5) +
      col('Source', 10) +
      col('Coverage', 10) +
      col('Exceptions', 12) +
      col('AvgConf', 9) +
      'Status',
    );
    console.log('─'.repeat(108));

    for (const book of books) {
      const sm = mapByBook.get(book.id);

      if (!sm || sm.syncSource === 'auto') {
        noSync++;
        const row =
          col(book.title, 40) +
          col(book.language ?? 'es', 5) +
          col(sm?.syncSource ?? 'none', 10) +
          col('—', 10) +
          col('—', 12) +
          col('—', 9) +
          'NO SYNC';
        console.log(row);
        if (cull) toCull.push(book);
        continue;
      }

      if (sm.syncCoverage === null) {
        noSync++;
        const row =
          col(book.title, 40) +
          col(book.language ?? 'es', 5) +
          col(sm.syncSource, 10) +
          col('?', 10) +
          col('?', 12) +
          col('?', 9) +
          'NOT COMPUTED — re-run seed-sync-whisper';
        console.log(row);
        continue;
      }

      const coveragePct  = (sm.syncCoverage * 100).toFixed(1) + '%';
      const avgConfPct   = sm.syncAvgConfidence !== null ? (sm.syncAvgConfidence * 100).toFixed(1) + '%' : '—';
      const exceptions   = sm.syncExceptions !== null ? String(sm.syncExceptions) : '—';
      const passes       = sm.syncCoverage >= threshold;

      if (passes) pass++; else { fail++; if (cull) toCull.push(book); }

      const status = passes ? `PASS (≥${(threshold * 100).toFixed(0)}%)` : `FAIL (<${(threshold * 100).toFixed(0)}%)`;
      console.log(
        col(book.title, 40) +
        col(book.language ?? 'es', 5) +
        col(sm.syncSource, 10) +
        col(coveragePct, 10) +
        col(exceptions, 12) +
        col(avgConfPct, 9) +
        status,
      );
    }

    console.log('─'.repeat(108));
    console.log(`\nSummary: ${pass} PASS  |  ${fail} FAIL  |  ${noSync} no sync`);
    console.log(`Threshold: ${(threshold * 100).toFixed(0)}% coverage\n`);

    if (cull && toCull.length > 0) {
      console.log(`Culling ${toCull.length} book(s) — setting isFree=false:\n`);
      for (const book of toCull) {
        book.isFree = false;
        await this.bookRepo.save(book);
        console.log(`  ✗ ${book.title}`);
      }
      console.log('');
    } else if (cull) {
      console.log('All free books pass — nothing culled.\n');
    }
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host:     config.get('DB_HOST', 'localhost'),
        port:     config.get<number>('DB_PORT', 5432),
        database: config.get('DB_NAME', 'noetia'),
        username: config.get('DB_USER', 'noetia'),
        password: config.get('DB_PASS', 'changeme'),
        entities: [Book, SyncMap, User],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([Book, SyncMap]),
  ],
  providers: [ReportService],
})
class ReportModule {}

async function bootstrap() {
  const { threshold, cull, all } = parseArgs();

  const app = await NestFactory.createApplicationContext(ReportModule, {
    logger: ['error', 'warn'],
  });

  const service = app.get(ReportService);
  await service.run(threshold, cull, all);
  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
