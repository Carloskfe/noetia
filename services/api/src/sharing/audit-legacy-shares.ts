/**
 * NEM-016 legacy-share audit — READ ONLY. Prints a JSON report of share ids and
 * counts (no quote text or personal data). Writes nothing: every query runs in
 * a READ ONLY transaction that is rolled back.
 *
 * Requires explicit Product Owner authorization before running against
 * production. Self-contained: it builds its own entity-less connection from the
 * same DB_* variables, and only needs these compiled files plus the image's
 * node_modules: sharing/{audit-legacy-shares,legacy-share-audit,quote-integrity}.js,
 * books/book-eligibility.js, storage/storage.service.js.
 * See NEM-016 report §14.3 for the exact procedure.
 *   dev:  npx ts-node -r tsconfig-paths/register src/sharing/audit-legacy-shares.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { runLegacyShareAudit } from './legacy-share-audit';

export function auditDataSource(env: NodeJS.ProcessEnv = process.env): DataSource {
  return new DataSource({
    type: 'postgres',
    host: env.DB_HOST ?? 'db',
    port: parseInt(env.DB_PORT ?? '5432', 10),
    database: env.DB_NAME ?? 'noetia',
    username: env.DB_USER ?? 'noetia',
    password: env.DB_PASS ?? 'changeme',
    entities: [],
    synchronize: false,
    migrationsRun: false,
  });
}

async function main(): Promise<void> {
  const ds = auditDataSource();
  await ds.initialize();
  const qr = ds.createQueryRunner();
  const storage = new StorageService();
  try {
    await qr.query('START TRANSACTION READ ONLY');
    await qr.query(`SET LOCAL statement_timeout = '60s'`);
    const report = await runLegacyShareAudit(qr, async (bookId, textFileKey) => {
      const rows = await qr.query(`SELECT phrases FROM sync_maps WHERE "bookId" = $1`, [bookId]);
      const phrases: Array<{ text?: string }> | undefined = rows[0]?.phrases;
      if (phrases?.length) return phrases.map((p) => p.text ?? '').join(' ');
      return textFileKey ? storage.getText(textFileKey) : null;
    });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } finally {
    await qr.query('ROLLBACK').catch(() => undefined);
    await qr.release();
    await ds.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`audit failed: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
