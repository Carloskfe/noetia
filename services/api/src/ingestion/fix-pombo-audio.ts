/**
 * fix-pombo-audio.ts
 *
 * Downloads all 28 chapter 64 kb MP3 files for "Fábulas y Verdades" (Rafael Pombo)
 * from archive.org and streams them to MinIO using S3 multipart upload — one chapter
 * per part — so the API container's 512 MB memory limit is never approached.
 *
 * Root cause of the bug: the previous audioStreamKey pointed to a 255 MB M4B file
 * whose moov atom sits at the end. expo-av had to download the entire file before
 * playback could start, causing the ~1-minute wait on mobile.
 *
 * Run on the server after deploy:
 *   docker compose --env-file .env.production -f docker-compose.server.yml \
 *     exec -T -e DB_HOST=db api node dist/ingestion/fix-pombo-audio.js
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

const ARCHIVE_BASE = 'https://archive.org/download/fabulasyverdades_2412_librivox';
const CHAPTER_COUNT = 28;
const MINIO_BUCKET = 'audio';
const MINIO_KEY = 'books/fabulas-pombo.mp3';
const BOOK_TITLE = 'Fábulas y Verdades';

function chapterUrl(n: number): string {
  const num = String(n).padStart(2, '0');
  return `${ARCHIVE_BASE}/fabulasyverdades_${num}_pombo_64kb.mp3`;
}

async function downloadChapter(n: number): Promise<Buffer> {
  const url = chapterUrl(n);
  process.stdout.write(`  Chapter ${String(n).padStart(2, '0')}: `);
  const res = await axios.get<Buffer>(url, {
    responseType: 'arraybuffer',
    timeout: 120_000,
    headers: { 'User-Agent': 'Noetia/1.0 (audio-fix-script)' },
  });
  const buf = Buffer.from(res.data);
  console.log(`${(buf.length / 1024).toFixed(0)} KB`);
  return buf;
}

function makeS3Client(): S3Client {
  const endpoint = process.env.MINIO_ENDPOINT ?? 'storage';
  const port = parseInt(process.env.MINIO_PORT ?? '9000', 10);
  const useSsl = process.env.MINIO_USE_SSL === 'true';
  return new S3Client({
    endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    },
    forcePathStyle: true,
  });
}

async function main() {
  console.log(`\n=== fix-pombo-audio (multipart upload) ===\n`);

  const s3 = makeS3Client();

  // 1. Initiate multipart upload
  console.log(`Initiating multipart upload → ${MINIO_BUCKET}/${MINIO_KEY}`);
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
    Bucket: MINIO_BUCKET,
    Key: MINIO_KEY,
    ContentType: 'audio/mpeg',
  }));
  if (!UploadId) throw new Error('No UploadId returned');
  console.log(`UploadId: ${UploadId}\n`);

  // 2. Download each chapter and upload as a part (no full buffer in memory)
  const parts: { PartNumber: number; ETag: string }[] = [];
  let totalBytes = 0;

  try {
    for (let i = 1; i <= CHAPTER_COUNT; i++) {
      const buf = await downloadChapter(i);
      totalBytes += buf.length;

      const { ETag } = await s3.send(new UploadPartCommand({
        Bucket: MINIO_BUCKET,
        Key: MINIO_KEY,
        UploadId,
        PartNumber: i,
        Body: buf,
        ContentLength: buf.length,
      }));
      if (!ETag) throw new Error(`No ETag for part ${i}`);
      parts.push({ PartNumber: i, ETag });
      process.stdout.write(` ✓ part ${i} uploaded\n`);
    }
  } catch (err) {
    // Abort multipart upload on any failure to avoid orphaned parts in MinIO
    console.error('\nError during upload — aborting multipart upload...');
    await s3.send(new AbortMultipartUploadCommand({
      Bucket: MINIO_BUCKET, Key: MINIO_KEY, UploadId,
    })).catch(() => {});
    throw err;
  }

  // 3. Complete the multipart upload
  console.log(`\nCompleting multipart upload (${(totalBytes / 1024 / 1024).toFixed(1)} MB total)...`);
  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: MINIO_BUCKET,
    Key: MINIO_KEY,
    UploadId,
    MultipartUpload: { Parts: parts },
  }));
  console.log('Upload complete.');

  // 4. Update DB
  console.log(`\nUpdating audioStreamKey for "${BOOK_TITLE}" ...`);
  const ds = new DataSource({
    type: 'postgres',
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME     ?? 'noetia',
    username: process.env.DB_USER     ?? 'noetia',
    password: process.env.DB_PASS     ?? 'changeme',
    synchronize: false,
  });
  await ds.initialize();

  const result = await ds.query(
    `UPDATE books SET "audioStreamKey" = $1 WHERE title = $2 RETURNING id, title`,
    [MINIO_KEY, BOOK_TITLE],
  );

  if (result.length === 0) {
    console.error(`ERROR: No book found with title "${BOOK_TITLE}". Check the title in the DB.`);
    await ds.destroy();
    process.exit(1);
  }

  console.log(`Updated: ${result[0].id} — "${result[0].title}"`);
  console.log(`audioStreamKey → "${MINIO_KEY}"`);
  await ds.destroy();

  console.log('\n=== Done. Pombo audio fixed. ===\n');
}

main().catch((err) => {
  console.error('Fatal error:', err.message ?? err);
  process.exit(1);
});
