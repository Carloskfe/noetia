/**
 * migrate-audio-to-minio.ts
 *
 * Brings EVERY book's audio into our own MinIO storage so the platform never
 * streams from a third party (archive.org / LibriVox). Supersedes the narrower
 * fix-all-m4b-audio.ts, which only handled archive.org `.m4b` stream keys.
 *
 * For every book whose audioStreamKey is missing or an external http(s) URL it:
 *   1. resolves the archive.org item id — directly from an archive.org key, or
 *      by scraping the book's LibriVox page for one,
 *   2. downloads the per-chapter MP3s (prefers 64 kb),
 *   3. uploads a single concatenated MP3 to MinIO via multipart (never holds
 *      more than ~25 MB in memory — one chapter + accumulator),
 *   4. sets audioStreamKey to the MinIO key so the API serves presigned URLs.
 *
 * Nothing is deleted; audioFileKey (the external "download" link) is left
 * untouched. Idempotent — books already on a MinIO key are skipped, so it is
 * safe to re-run after a partial run or a network failure.
 *
 * MP3 (not M4B) so expo-av can decode progressively from the first byte.
 *
 * Run on the server:
 *   docker compose --env-file .env.production -f docker-compose.server.yml \
 *     exec -T -e DB_HOST=db api node dist/ingestion/migrate-audio-to-minio.js
 *
 * Dry run (list what WOULD migrate, no downloads/writes):
 *   ... node dist/ingestion/migrate-audio-to-minio.js --dry-run
 *
 * Single book:
 *   ... node dist/ingestion/migrate-audio-to-minio.js "Doña Perfecta"
 */

import 'reflect-metadata';
import axios from 'axios';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';
import {
  needsMigration,
  pickChapterMp3s,
  archiveIdFromLibrivoxHtml,
  minioAudioKey,
  resolveAudioSource,
} from './audio-source-resolver';

const PART_MIN_BYTES = 10 * 1024 * 1024; // 10 MB — above S3's 5 MB part minimum
const MINIO_BUCKET = 'audio';
const UA = { 'User-Agent': 'Noetia/1.0 (audio-migration)' };

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

async function getHtml(url: string): Promise<string> {
  const { data } = await axios.get<string>(url, { timeout: 30_000, headers: UA });
  return data;
}

async function downloadChapter(identifier: string, filename: string): Promise<Buffer> {
  const url = `https://archive.org/download/${identifier}/${filename}`;
  const res = await axios.get<Buffer>(url, {
    responseType: 'arraybuffer',
    timeout: 120_000,
    headers: UA,
  });
  return Buffer.from(res.data);
}

/** Resolve a book to its ordered list of chapter MP3 filenames + archive id. */
async function resolveChapters(book: {
  audioStreamKey: string | null;
  audioFileKey: string | null;
}): Promise<{ identifier: string; chapters: string[] } | null> {
  const src = resolveAudioSource(book);
  if (!src) return null;

  let identifier: string;
  if (src.kind === 'archive') {
    identifier = src.identifier;
  } else {
    const page = await getHtml(src.pageUrl);
    const id = archiveIdFromLibrivoxHtml(page);
    if (!id) return null;
    identifier = id;
  }

  const listing = await getHtml(`https://archive.org/download/${identifier}/`);
  const chapters = pickChapterMp3s(listing);
  return chapters.length ? { identifier, chapters } : null;
}

async function multipartUpload(
  s3: S3Client,
  key: string,
  identifier: string,
  chapters: string[],
): Promise<number> {
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
    Bucket: MINIO_BUCKET, Key: key, ContentType: 'audio/mpeg',
  }));
  if (!UploadId) throw new Error('No UploadId');

  const parts: { PartNumber: number; ETag: string }[] = [];
  let accumulator = Buffer.alloc(0);
  let partNumber = 0;
  let totalBytes = 0;

  async function flushPart(force = false) {
    if (!accumulator.length) return;
    if (!force && accumulator.length < PART_MIN_BYTES) return;
    partNumber++;
    const { ETag } = await s3.send(new UploadPartCommand({
      Bucket: MINIO_BUCKET, Key: key, UploadId,
      PartNumber: partNumber, Body: accumulator, ContentLength: accumulator.length,
    }));
    if (!ETag) throw new Error(`No ETag for part ${partNumber}`);
    parts.push({ PartNumber: partNumber, ETag });
    process.stdout.write(` [part ${partNumber}: ${(accumulator.length / 1024 / 1024).toFixed(1)} MB]`);
    accumulator = Buffer.alloc(0);
  }

  try {
    for (let i = 0; i < chapters.length; i++) {
      process.stdout.write(`\n    ch${String(i + 1).padStart(3, '0')}: `);
      const buf = await downloadChapter(identifier, chapters[i]);
      totalBytes += buf.length;
      process.stdout.write(`${(buf.length / 1024).toFixed(0)} KB`);
      accumulator = Buffer.concat([accumulator, buf]);
      await flushPart();
    }
    await flushPart(true);
  } catch (err) {
    console.error('\n  Upload error — aborting multipart...');
    await s3.send(new AbortMultipartUploadCommand({ Bucket: MINIO_BUCKET, Key: key, UploadId })).catch(() => {});
    throw err;
  }

  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: MINIO_BUCKET, Key: key, UploadId, MultipartUpload: { Parts: parts },
  }));
  return totalBytes;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filterTitle = args.find((a) => !a.startsWith('--')) ?? null;

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'noetia',
    username: process.env.DB_USER ?? 'noetia',
    password: process.env.DB_PASS ?? 'changeme',
    synchronize: false,
  });
  await ds.initialize();

  const rows: { id: string; title: string; audioStreamKey: string | null; audioFileKey: string | null }[] =
    await ds.query(
      `SELECT id, title, "audioStreamKey", "audioFileKey"
       FROM books
       WHERE ("audioStreamKey" IS NULL OR "audioStreamKey" LIKE 'http%')
       ${filterTitle ? 'AND title = $1' : ''}
       ORDER BY title`,
      filterTitle ? [filterTitle] : [],
    );

  // Second guard in code (belt & suspenders with the SQL filter).
  const todo = rows.filter((b) => needsMigration(b.audioStreamKey));

  console.log(`\n=== migrate-audio-to-minio${dryRun ? ' (DRY RUN)' : ''}: ${todo.length} book(s) to migrate ===\n`);
  if (!todo.length) { console.log('Nothing to do — all books already on MinIO.'); await ds.destroy(); return; }

  const s3 = dryRun ? null : makeS3();
  const results: { title: string; status: 'ok' | 'skip' | 'error'; detail?: string }[] = [];

  for (const book of todo) {
    console.log(`\n── ${book.title}`);
    try {
      const resolved = await resolveChapters(book);
      if (!resolved) {
        console.log('   SKIP: no resolvable archive.org source (checked stream + LibriVox page).');
        results.push({ title: book.title, status: 'skip', detail: 'no source' });
        continue;
      }
      const key = minioAudioKey(book.title);
      console.log(`   archive id: ${resolved.identifier} · ${resolved.chapters.length} chapter(s) → ${key}`);

      if (dryRun) { results.push({ title: book.title, status: 'ok', detail: `${resolved.chapters.length} ch (dry run)` }); continue; }

      const totalBytes = await multipartUpload(s3!, key, resolved.identifier, resolved.chapters);
      await ds.query(`UPDATE books SET "audioStreamKey" = $1 WHERE id = $2`, [key, book.id]);
      console.log(`\n   ✓ ${(totalBytes / 1024 / 1024).toFixed(1)} MB uploaded, DB updated`);
      results.push({ title: book.title, status: 'ok', detail: `${(totalBytes / 1024 / 1024).toFixed(1)} MB` });
    } catch (err: any) {
      console.error(`\n   ERROR: ${err.message}`);
      results.push({ title: book.title, status: 'error', detail: err.message });
    }
  }

  await ds.destroy();

  console.log('\n\n═══ Summary ════════════════════════════════════════════');
  for (const r of results) {
    const icon = r.status === 'ok' ? '✅' : r.status === 'skip' ? '⏭️ ' : '❌';
    console.log(`${icon}  ${r.title}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  const ok = results.filter((r) => r.status === 'ok').length;
  const skip = results.filter((r) => r.status === 'skip').length;
  const err = results.filter((r) => r.status === 'error').length;
  console.log(`\n${ok} migrated · ${skip} skipped · ${err} error(s)`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal:', err.message ?? err);
  process.exit(1);
});
