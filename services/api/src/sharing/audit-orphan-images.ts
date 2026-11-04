/**
 * NEM-016 R3 — READ ONLY orphan card-image audit. Prints a JSON report and a
 * dry-run plan. It only lists objects and reads inside a READ ONLY transaction
 * that's rolled back. There is no delete mode.
 *
 * Needs explicit Product Owner authorization before running on staging or
 * production. See docs/operations/nem-016-orphan-card-images.md.
 *   node dist/sharing/audit-orphan-images.js [--min-age-hours=24]
 */
import 'reflect-metadata';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { auditDataSource } from './audit-legacy-shares';
import { DEFAULT_MIN_AGE_HOURS, runOrphanImageAudit, StorageObject } from './orphan-image-audit';

const BUCKET = 'images';

export function parseMinAgeHours(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith('--min-age-hours='));
  if (!arg) return DEFAULT_MIN_AGE_HOURS;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value < 0 || arg.endsWith('=')) throw new Error('--min-age-hours must be 0 or more');
  return value;
}

type Sender = Pick<S3Client, 'send'>;

/** Lists every object. ListObjectsV2 is the only storage command this tool can send. */
export async function listAllObjects(client: Sender, bucket = BUCKET): Promise<StorageObject[]> {
  const out: StorageObject[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const o of page.Contents ?? []) {
      if (o.Key && o.LastModified) out.push({ key: o.Key, lastModified: o.LastModified });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

function storageClient(env: NodeJS.ProcessEnv = process.env): S3Client {
  const useSsl = env.MINIO_USE_SSL === 'true';
  return new S3Client({
    endpoint: `${useSsl ? 'https' : 'http'}://${env.MINIO_ENDPOINT ?? 'storage'}:${env.MINIO_PORT ?? '9000'}`,
    region: 'us-east-1',
    credentials: { accessKeyId: env.MINIO_ACCESS_KEY ?? 'minioadmin', secretAccessKey: env.MINIO_SECRET_KEY ?? 'minioadmin' },
    forcePathStyle: true,
  });
}

async function main(): Promise<void> {
  const minAgeHours = parseMinAgeHours(process.argv.slice(2));
  const ds = auditDataSource();
  await ds.initialize();
  const qr = ds.createQueryRunner();
  const client = storageClient();
  try {
    await qr.query('START TRANSACTION READ ONLY');
    await qr.query(`SET LOCAL statement_timeout = '60s'`);
    const report = await runOrphanImageAudit(qr, () => listAllObjects(client), { now: new Date(), minAgeHours });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await qr.query('ROLLBACK').catch(() => undefined);
    await qr.release();
    await ds.destroy();
    client.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`audit failed: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
