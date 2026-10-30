import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';

/**
 * Creates an isolated, fully-migrated PostgreSQL database for one test file.
 *
 * Uses the real migrations (not `synchronize`) so the schema — including the
 * UNIQUE ("userId","bookId") ownership constraint — matches production.
 * Refuses to run unless INTEGRATION_DATABASE_URL points at a loopback host, so a
 * misconfigured env can never reach a shared or production server.
 */
export async function createTestDatabase(): Promise<{ dataSource: DataSource; drop: () => Promise<void> }> {
  const raw = process.env.INTEGRATION_DATABASE_URL;
  if (!raw) {
    throw new Error('INTEGRATION_DATABASE_URL is not set — see jest.integration.config.js');
  }
  const url = new URL(raw);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`Refusing to run integration tests against non-loopback host ${url.hostname}`);
  }

  const dbName = `nem_it_${randomBytes(6).toString('hex')}`;
  const base = {
    type: 'postgres' as const,
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };

  const admin = new DataSource({ ...base, database: url.pathname.slice(1) || 'postgres' });
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.destroy();

  const dataSource = new DataSource({
    ...base,
    database: dbName,
    entities: [__dirname + '/../../../src/**/*.entity.ts'],
    migrations: [__dirname + '/../../../src/migrations/*.ts'],
    synchronize: false,
    // Enough connections for the concurrency tests to run truly in parallel.
    extra: { max: 20 },
    logging: false,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();

  return {
    dataSource,
    drop: async () => {
      await dataSource.destroy();
      const cleanup = new DataSource({ ...base, database: url.pathname.slice(1) || 'postgres' });
      await cleanup.initialize();
      await cleanup.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      await cleanup.destroy();
    },
  };
}
