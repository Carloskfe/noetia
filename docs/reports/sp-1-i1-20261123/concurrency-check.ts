/* SP-1-I1 evidence script: one-off concurrency check against a DISPOSABLE local Postgres container (postgres:16-alpine, 127.0.0.1:55432). NOT a unit test; never point it at staging or production. Run from services/api after copying it there. */
import 'reflect-metadata';
import { DataSource, Not } from 'typeorm';
import { PushToken } from './src/push/push-token.entity';
import { PushService } from './src/push/push.service';

const T = 'ExponentPushToken[race-T]';
async function main() {
  const ds = new DataSource({ type: 'postgres', host: '127.0.0.1', port: 55432, username: 'postgres', password: 'sp1local', database: 'postgres', entities: [PushToken], poolSize: 12 } as any);
  await ds.initialize();
  // Exact DDL of migration 1714000000045-CreatePushTokens
  await ds.query(`DROP TABLE IF EXISTS "push_tokens"`);
  await ds.query(`CREATE TABLE "push_tokens" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL, "token" VARCHAR(255) NOT NULL, "platform" VARCHAR(20) NOT NULL DEFAULT 'unknown', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT "PK_push_tokens" PRIMARY KEY ("id"), CONSTRAINT "UQ_push_tokens_user_token" UNIQUE ("userId", "token"))`);
  await ds.query(`CREATE INDEX "idx_push_tokens_userId" ON "push_tokens"("userId")`);
  const repo = ds.getRepository(PushToken);
  const svc = new PushService(repo, {} as any);
  const users = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-00000000000${i}`);

  // Control: same transaction WITHOUT the advisory lock.
  const noLock = (userId: string) => repo.manager.transaction(async (em) => {
    await em.delete(PushToken, { token: T, userId: Not(userId) });
    await em.getRepository(PushToken).upsert({ userId, token: T, platform: 'ios' }, { conflictPaths: ['userId', 'token'] });
  });

  const ROUNDS = 200;
  const run = async (label: string, reg: (u: string) => Promise<unknown>) => {
    const dist: Record<number, number> = {};
    for (let r = 0; r < ROUNDS; r++) {
      await ds.query(`TRUNCATE "push_tokens"`);
      await reg(users[0]);
      await Promise.all(users.slice(1).map((u) => reg(u)));
      const [{ n }] = await ds.query(`SELECT count(DISTINCT "userId")::int AS n FROM push_tokens WHERE token = $1`, [T]);
      dist[n] = (dist[n] ?? 0) + 1;
    }
    console.log(`${label}: rounds=${ROUNDS} owners-distribution=${JSON.stringify(dist)}`);
  };
  await run('WITH advisory lock (PushService.registerToken)', (u) => svc.registerToken(u, T, 'ios'));
  await run('CONTROL without lock', noLock);

  // Multi-device + idempotency on real PG
  await ds.query(`TRUNCATE "push_tokens"`);
  await svc.registerToken(users[0], T, 'ios');
  await svc.registerToken(users[0], 'ExpoPushToken[A-tablet]', 'android');
  await svc.registerToken(users[1], T, 'ios');
  await svc.registerToken(users[1], T, 'ios');
  console.log('final rows:', JSON.stringify(await ds.query(`SELECT "userId", token, platform FROM push_tokens ORDER BY token`)));

  // Rollback on real PG: violate varchar(20) platform inside the transaction after the delete
  try { await svc.registerToken(users[2], T, 'x'.repeat(30)); } catch (e) { console.log('forced failure:', (e as Error).message.slice(0, 60)); }
  console.log('after rollback owners of T:', JSON.stringify(await ds.query(`SELECT "userId" FROM push_tokens WHERE token = $1`, [T])));
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
