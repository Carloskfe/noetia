/**
 * fix-pombo-audio.ts
 *
 * Downloads all 28 chapter 64 kb MP3 files for "Fábulas y Verdades" (Rafael Pombo)
 * from archive.org, concatenates them into a single MP3, uploads to MinIO, and
 * updates the book's audioStreamKey in the database.
 *
 * Root cause of the bug: the current audioStreamKey pointed to a 255 MB M4B file
 * whose moov atom is at the end — expo-av had to download the entire file before
 * playback could start, causing the ~1-minute wait.
 *
 * Run on the server:
 *   docker compose --env-file .env.production -f docker-compose.server.yml \
 *     exec -T -e DB_HOST=db api \
 *     npx ts-node -r tsconfig-paths/register src/ingestion/fix-pombo-audio.ts
 */

import 'reflect-metadata';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';

const ARCHIVE_BASE = 'https://archive.org/download/fabulasyverdades_2412_librivox';
const CHAPTER_COUNT = 28;
const MINIO_KEY = 'books/fabulas-pombo.mp3';
const BOOK_TITLE = 'Fábulas y Verdades';

function chapterUrl(n: number): string {
  const num = String(n).padStart(2, '0');
  return `${ARCHIVE_BASE}/fabulasyverdades_${num}_pombo_64kb.mp3`;
}

async function downloadChapter(n: number): Promise<Buffer> {
  const url = chapterUrl(n);
  process.stdout.write(`  Chapter ${String(n).padStart(2, '0')}: ${url} ... `);
  const res = await axios.get<Buffer>(url, {
    responseType: 'arraybuffer',
    timeout: 120_000,
    headers: { 'User-Agent': 'Noetia/1.0 (audio-fix-script)' },
  });
  console.log(`${(res.data.length / 1024).toFixed(0)} KB`);
  return Buffer.from(res.data);
}

async function main() {
  console.log(`\n=== fix-pombo-audio: downloading ${CHAPTER_COUNT} chapters ===\n`);

  // 1. Download all chapters
  const chunks: Buffer[] = [];
  for (let i = 1; i <= CHAPTER_COUNT; i++) {
    const buf = await downloadChapter(i);
    chunks.push(buf);
  }

  const combined = Buffer.concat(chunks);
  console.log(`\nTotal size: ${(combined.length / 1024 / 1024).toFixed(1)} MB`);

  // 2. Upload to MinIO
  console.log(`\nUploading to MinIO → audio/${MINIO_KEY} ...`);
  const endpoint = process.env.MINIO_ENDPOINT ?? 'storage';
  const port = parseInt(process.env.MINIO_PORT ?? '9000', 10);
  const useSsl = process.env.MINIO_USE_SSL === 'true';

  const s3 = new S3Client({
    endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    },
    forcePathStyle: true,
  });

  await s3.send(new PutObjectCommand({
    Bucket: 'audio',
    Key: MINIO_KEY,
    Body: combined,
    ContentType: 'audio/mpeg',
  }));
  console.log('Upload complete.');

  // 3. Update DB
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
  console.log(`audioStreamKey set to: "${MINIO_KEY}"`);
  await ds.destroy();

  console.log('\n=== Done. Pombo audio fix applied. ===\n');
}

main().catch((err) => {
  console.error('Fatal error:', err.message ?? err);
  process.exit(1);
});
