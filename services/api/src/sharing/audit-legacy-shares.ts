/**
 * NEM-016 legacy-share audit — READ ONLY. Prints a JSON report of share ids and
 * counts (no quote text or personal data). Writes nothing: every query runs in
 * a READ ONLY transaction that is rolled back.
 *
 * Requires explicit Product Owner authorization before running against
 * production. Usage (inside the api container):
 *   npx ts-node -r tsconfig-paths/register src/sharing/audit-legacy-shares.ts
 *   # prod image: node dist/sharing/audit-legacy-shares.js
 */
import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { StorageService } from '../storage/storage.service';
import { runLegacyShareAudit } from './legacy-share-audit';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
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
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  process.stderr.write(`audit failed: ${(err as Error).message}\n`);
  process.exit(1);
});
