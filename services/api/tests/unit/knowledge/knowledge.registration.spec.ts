import { CanActivate, ExecutionContext, Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import { isKnowledgeModuleEnabled, KNOWLEDGE_MODULE_FLAG, knowledgeModules } from '../../../src/knowledge/knowledge.registration';
import { USER_A } from './support/fixtures';

const MODULE_PATH = require.resolve('../../../src/knowledge/knowledge.module');

/** A real-shaped user: authenticated, but no plan adapter exists. */
class FakeJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    ctx.switchToHttp().getRequest().user = { id: USER_A };
    return true;
  }
}

function fakeDataSource() {
  const query = jest.fn(async (sql: string) => {
    if (/FROM ai_conversations/.test(sql)) return [];
    return [];
  });
  return { query, transaction: jest.fn() };
}

/** Minimal HTTP client over Node's built-in fetch (no new dependency). */
async function call(app: INestApplication, method: string, path: string, body?: unknown) {
  const url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const res = await fetch(url + path, {
    method: method.toUpperCase(),
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

async function bootApp(env: NodeJS.ProcessEnv): Promise<{ app: INestApplication; ds: ReturnType<typeof fakeDataSource> }> {
  const ds = fakeDataSource();
  @Global()
  @Module({ providers: [{ provide: DataSource, useValue: ds }], exports: [DataSource] })
  class FakeDbModule {}
  @Module({ imports: [FakeDbModule, ...knowledgeModules(env)] })
  class TestAppModule {}
  const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] })
    .overrideGuard(JwtAuthGuard).useClass(FakeJwtGuard)
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  return { app, ds };
}

describe('KnowledgeModule registration (§5.6, AC-1, AC-2)', () => {
  it('is off by default and for any value other than the exact string "true"', () => {
    expect(KNOWLEDGE_MODULE_FLAG).toBe('KNOWLEDGE_MODULE_ENABLED');
    for (const v of [undefined, '', 'false', 'TRUE', '1', 'yes', ' true']) {
      expect(isKnowledgeModuleEnabled({ KNOWLEDGE_MODULE_ENABLED: v })).toBe(false);
      expect(knowledgeModules({ KNOWLEDGE_MODULE_ENABLED: v })).toEqual([]);
    }
  });

  it('AC-1: with the flag off the module code is never required', () => {
    delete require.cache[MODULE_PATH];
    knowledgeModules({});
    expect(require.cache[MODULE_PATH]).toBeUndefined();
  });

  it('AC-1: with the flag off, no knowledge route exists', async () => {
    const { app } = await bootApp({});
    expect((await call(app, 'post', '/knowledge/sessions', {})).status).toBe(404);
    expect((await call(app, 'get', `/knowledge/sessions/${USER_A}`)).status).toBe(404);
    await app.close();
  });

  describe('flag on (tests only)', () => {
    let app: INestApplication;
    let ds: ReturnType<typeof fakeDataSource>;
    beforeAll(async () => {
      ({ app, ds } = await bootApp({ KNOWLEDGE_MODULE_ENABLED: 'true' }));
    });
    afterAll(async () => app.close());

    it('AC-2: a real user still gets prerequisite_missing (no plan adapter)', async () => {
      const res = await call(app, 'post', '/knowledge/sessions', { bookIds: [] });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'prerequisite_missing' });
    });

    it('AC-2: every "use" route denies with prerequisite_missing', async () => {
      const id = '30000000-0000-4000-8000-000000000001';
      for (const [method, path, body] of [
        ['post', `/knowledge/sessions/${id}/books`, { bookId: id }],
        ['delete', `/knowledge/sessions/${id}/books/${id}`, undefined],
        ['post', `/knowledge/sessions/${id}/fork`, { bookIds: [id] }],
        ['post', `/knowledge/sessions/${id}/turns`, { idempotencyKey: 'client-key-0001' }],
      ] as const) {
        const res = await call(app, method, path, body);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('prerequisite_missing');
      }
    });

    it('forged limit/tier/budget/plan/owned fields are ignored (stripped) and grant nothing', async () => {
      const res = await call(app, 'post', '/knowledge/sessions', { bookIds: [], limit: 10, tier: 'noetia_x', budget: 1e9, plan: 'family', owned: true });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('prerequisite_missing');
    });

    it('history route needs no entitlement but only shows the caller’s own sessions', async () => {
      const res = await call(app, 'get', '/knowledge/sessions/30000000-0000-4000-8000-000000000009');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('not_found');
      expect(ds.query.mock.calls.some(([sql, p]: any[]) => /"userId" = \$2/.test(sql) && p[1] === USER_A)).toBe(true);
    });

    it('guards run before validation: unentitled callers are denied first; malformed ids are rejected on history reads', async () => {
      expect((await call(app, 'get', '/knowledge/sessions/not-a-uuid')).status).toBe(400);
      expect((await call(app, 'post', '/knowledge/sessions', { bookIds: ['x'] })).status).toBe(403);
    });
  });
});
