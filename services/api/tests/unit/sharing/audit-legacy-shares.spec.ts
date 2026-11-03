import { auditDataSource } from '../../../src/sharing/audit-legacy-shares';

describe('auditDataSource', () => {
  it('builds an entity-less postgres connection from the DB_* variables (no migrations, no sync)', () => {
    const ds = auditDataSource({ DB_HOST: 'db', DB_PORT: '5433', DB_NAME: 'n', DB_USER: 'u', DB_PASS: 'p' } as NodeJS.ProcessEnv);
    const o = ds.options as unknown as Record<string, unknown>;
    expect(o).toMatchObject({ type: 'postgres', host: 'db', port: 5433, database: 'n', username: 'u', password: 'p', synchronize: false, migrationsRun: false });
    expect(o.entities).toEqual([]);
    expect(ds.isInitialized).toBe(false); // importing the module never connects
  });

  it('falls back to the same defaults as the app data source', () => {
    const o = auditDataSource({} as NodeJS.ProcessEnv).options as unknown as Record<string, unknown>;
    expect(o).toMatchObject({ host: 'db', port: 5432, database: 'noetia', username: 'noetia' });
  });
});
