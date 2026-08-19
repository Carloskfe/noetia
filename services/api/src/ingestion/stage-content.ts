/**
 * NEM-006C — staging content CLI.
 *
 * Runs INSIDE the staging api container. Refuses to run anywhere else.
 *
 * Usage (staging host):
 *   node dist/ingestion/stage-content.js --dry-run
 *   node dist/ingestion/stage-content.js
 *   node dist/ingestion/stage-content.js --only "Niebla" --only "Dracula"
 *
 * Flags:
 *   --dry-run              inventory + resolve only; no DB or object writes
 *   --only "<title>"       restrict to one title (repeatable)
 *   --transcriptions <dir> VTT corpus root (default /app/transcriptions)
 *   --report <path>        report basename (default /app/staging-content-report)
 *
 * Normally invoked through scripts/seed-staging-content.sh, which also handles
 * the production→staging audio mirror and copies the report out of the container.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { User } from '../users/user.entity';
import { StorageModule } from '../storage/storage.module';
import { WhisperSyncService } from './whisper-sync.service';
import { PhraseSplitterService } from './phrase-splitter.service';
import { StagingContentService, assertStagingTarget } from './staging-content.service';

const AUDIO_BUCKET = 'audio';

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
  providers: [StagingContentService, WhisperSyncService, PhraseSplitterService],
})
class StageContentModule {}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  const only: string[] = [];
  args.forEach((a, i) => {
    if (a === '--only' && args[i + 1]) only.push(args[i + 1]);
  });
  return {
    dryRun: args.includes('--dry-run'),
    only,
    transcriptionsDir: get('--transcriptions', '/app/transcriptions'),
    reportPath: get('--report', '/app/staging-content-report'),
  };
}

function makeS3(): S3Client {
  const endpoint = process.env.MINIO_ENDPOINT ?? 'storage';
  const port = parseInt(process.env.MINIO_PORT ?? '9000', 10);
  const ssl = process.env.MINIO_USE_SSL === 'true';
  return new S3Client({
    endpoint: `${ssl ? 'https' : 'http'}://${endpoint}:${port}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    },
    forcePathStyle: true,
  });
}

async function bootstrap() {
  const { dryRun, only, transcriptionsDir, reportPath } = parseArgs();

  // §47 hard guard — before Nest, before any connection, before any write.
  assertStagingTarget({
    APP_ENV: process.env.APP_ENV,
    DB_NAME: process.env.DB_NAME,
    MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL,
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
  });

  if (!fs.existsSync(transcriptionsDir)) {
    console.error(
      `Transcriptions directory not found: ${transcriptionsDir}\n` +
        'Copy the corpus in first:  docker cp transcriptions <container>:/app/transcriptions',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(StageContentModule, {
    logger: ['error', 'warn'],
  });
  const service = app.get(StagingContentService);
  const s3 = makeS3();

  const audioObjectExists = async (key: string): Promise<boolean> => {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: AUDIO_BUCKET, Key: key }));
      return true;
    } catch {
      return false;
    }
  };

  const targets = service.listTargets(only);
  console.log(
    `\n=== NEM-006C staging content${dryRun ? ' (DRY RUN)' : ''}: ${targets.length} title(s) ===\n`,
  );

  const rows = [];
  let index = 0;
  for (const title of targets) {
    index++;
    const started = Date.now();
    const row = await service.stageBook(title, { transcriptionsDir, audioObjectExists, dryRun });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    const cov = row.syncCoverage == null ? '' : ` cov=${(row.syncCoverage * 100).toFixed(1)}%`;
    console.log(
      `[${String(index).padStart(3)}/${targets.length}] ${row.status.padEnd(22)} ${title}${cov} (${secs}s)` +
        (row.failureReason ? `\n        ↳ ${row.failureReason}` : ''),
    );
    rows.push(row);
  }

  const report = service.buildReport(rows, dryRun);
  fs.writeFileSync(`${reportPath}.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${reportPath}.md`, service.renderMarkdown(report));

  console.log('\n── Totals ─────────────────────────────────────────');
  for (const [k, v] of Object.entries(report.totals).sort()) console.log(`  ${k.padEnd(24)} ${v}`);
  console.log(`\nReport written: ${reportPath}.json / ${reportPath}.md\n`);

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
