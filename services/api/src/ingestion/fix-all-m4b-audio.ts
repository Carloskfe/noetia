/**
 * fix-all-m4b-audio.ts
 *
 * Finds every book whose audioStreamKey is an archive.org M4B URL, downloads
 * the individual chapter 64 kb MP3s for that book, and uploads a single
 * concatenated MP3 to MinIO using multipart upload (≥10 MB parts, one chapter
 * at a time in memory). Finally updates the book's audioStreamKey to the
 * MinIO key so the API generates presigned URLs instead of pointing at M4B.
 *
 * Root cause: M4B moov atoms are at the end of the file — expo-av must download
 * the entire file before playback can start. MP3 supports progressive decoding
 * from the first byte.
 *
 * Constraints: API container has a 512 MB memory limit. This script never holds
 * more than ~25 MB at once (one chapter + accumulator) regardless of book size.
 *
 * Run on the server:
 *   docker compose --env-file .env.production -f docker-compose.server.yml \
 *     exec -T -e DB_HOST=db api node dist/ingestion/fix-all-m4b-audio.js
 *
 * To process a single book only:
 *   ... node dist/ingestion/fix-all-m4b-audio.js "Romeo y Julieta"
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

const PART_MIN_BYTES = 10 * 1024 * 1024; // 10 MB — safely above S3's 5 MB minimum
const MINIO_BUCKET = 'audio';

// ── helpers ──────────────────────────────────────────────────────────────────

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

function archiveIdentifier(m4bUrl: string): string {
  // https://archive.org/download/{IDENTIFIER}/{file}.m4b → IDENTIFIER
  const match = /archive\.org\/download\/([^/]+)\//.exec(m4bUrl);
  if (!match) throw new Error(`Cannot parse archive.org identifier from: ${m4bUrl}`);
  return match[1];
}

async function listChapterMp3s(identifier: string): Promise<string[]> {
  const url = `https://archive.org/download/${identifier}/`;
  const { data: html } = await axios.get<string>(url, {
    timeout: 30_000,
    headers: { 'User-Agent': 'Noetia/1.0 (audio-fix-script)' },
  });

  // Prefer 64kb files; fall back to 128kb; fall back to any .mp3 that isn't the full-book zip
  const all64  = [...html.matchAll(/href="([^"]+_64kb\.mp3)"/gi)].map(m => m[1]);
  const all128 = [...html.matchAll(/href="([^"]+_128kb\.mp3)"/gi)].map(m => m[1]);
  const allMp3 = [...html.matchAll(/href="([^"]+\.mp3)"/gi)]
    .map(m => m[1])
    .filter(f => !f.includes('_128kb') && !f.includes('_64kb'));

  const candidates = all64.length ? all64 : all128.length ? all128 : allMp3;
  if (!candidates.length) return [];

  // Sort by the first run of digits in the filename (chapter order)
  return candidates.sort((a, b) => {
    const na = parseInt(/\d+/.exec(a)?.[0] ?? '0', 10);
    const nb = parseInt(/\d+/.exec(b)?.[0] ?? '0', 10);
    return na - nb;
  });
}

async function downloadChapter(identifier: string, filename: string): Promise<Buffer> {
  const url = `https://archive.org/download/${identifier}/${filename}`;
  const res = await axios.get<Buffer>(url, {
    responseType: 'arraybuffer',
    timeout: 120_000,
    headers: { 'User-Agent': 'Noetia/1.0 (audio-fix-script)' },
  });
  return Buffer.from(res.data);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── upload ────────────────────────────────────────────────────────────────────

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
      PartNumber: partNumber,
      Body: accumulator,
      ContentLength: accumulator.length,
    }));
    if (!ETag) throw new Error(`No ETag for part ${partNumber}`);
    parts.push({ PartNumber: partNumber, ETag });
    process.stdout.write(` [part ${partNumber}: ${(accumulator.length / 1024 / 1024).toFixed(1)} MB]`);
    accumulator = Buffer.alloc(0);
  }

  try {
    for (let i = 0; i < chapters.length; i++) {
      const filename = chapters[i];
      process.stdout.write(`\n    ch${String(i + 1).padStart(3, '0')}: `);
      const buf = await downloadChapter(identifier, filename);
      totalBytes += buf.length;
      process.stdout.write(`${(buf.length / 1024).toFixed(0)} KB`);
      accumulator = Buffer.concat([accumulator, buf]);
      await flushPart();
    }
    await flushPart(true); // flush remainder as final part (any size allowed)
  } catch (err) {
    console.error('\n  Upload error — aborting multipart...');
    await s3.send(new AbortMultipartUploadCommand({
      Bucket: MINIO_BUCKET, Key: key, UploadId,
    })).catch(() => {});
    throw err;
  }

  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: MINIO_BUCKET, Key: key, UploadId,
    MultipartUpload: { Parts: parts },
  }));

  return totalBytes;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const filterTitle = process.argv[2] ?? null;

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

  const rows: { id: string; title: string; audioStreamKey: string }[] = await ds.query(
    `SELECT id, title, "audioStreamKey"
     FROM books
     WHERE "audioStreamKey" LIKE '%archive.org%' AND "audioStreamKey" LIKE '%.m4b'
     ${filterTitle ? `AND title = $1` : ''}
     ORDER BY title`,
    filterTitle ? [filterTitle] : [],
  );

  console.log(`\n=== fix-all-m4b-audio: ${rows.length} book(s) to process ===\n`);
  if (rows.length === 0) {
    console.log('Nothing to do.');
    await ds.destroy();
    return;
  }

  const s3 = makeS3();
  const results: { title: string; status: 'ok' | 'skip' | 'error'; detail?: string }[] = [];

  for (const book of rows) {
    console.log(`\n── ${book.title}`);
    console.log(`   M4B: ${book.audioStreamKey}`);

    try {
      const identifier = archiveIdentifier(book.audioStreamKey);
      console.log(`   Archive ID: ${identifier}`);

      const chapters = await listChapterMp3s(identifier);
      if (!chapters.length) {
        console.log('   SKIP: no chapter MP3s found in archive.org directory.');
        results.push({ title: book.title, status: 'skip', detail: 'no MP3s found' });
        continue;
      }
      console.log(`   Found ${chapters.length} chapter(s).`);

      const minioKey = `books/${slugify(book.title)}-audio.mp3`;
      console.log(`   MinIO key: ${minioKey}`);

      const totalBytes = await multipartUpload(s3, minioKey, identifier, chapters);
      console.log(`\n   Upload complete: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

      await ds.query(
        `UPDATE books SET "audioStreamKey" = $1 WHERE id = $2`,
        [minioKey, book.id],
      );
      console.log(`   DB updated ✓`);
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
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal:', err.message ?? err);
  process.exit(1);
});
