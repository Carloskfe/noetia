import { CanActivate, ExecutionContext, Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../../../src/auth/jwt-auth.guard';
import { knowledgeModules } from '../../../../src/knowledge/knowledge.registration';
import { TurnService } from '../../../../src/knowledge/sessions/turn.service';
import { USER_A } from '../support/fixtures';

/** NEM-024 Checkpoint A: the real KnowledgeModule wiring (flag on, fake DataSource; no network, no DB). */
class FakeJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    ctx.switchToHttp().getRequest().user = { id: USER_A };
    return true;
  }
}

describe('NEM-024 SessionsController + KnowledgeModule wiring (Checkpoint A)', () => {
  let app: INestApplication;
  let turns: TurnService;
  beforeAll(async () => {
    const ds = { query: jest.fn(async () => []), transaction: jest.fn() };
    @Global()
    @Module({ providers: [{ provide: DataSource, useValue: ds }], exports: [DataSource] })
    class FakeDbModule {}
    @Module({ imports: [FakeDbModule, ...knowledgeModules({ KNOWLEDGE_MODULE_ENABLED: 'true' })] })
    class TestAppModule {}
    const ref = await Test.createTestingModule({ imports: [TestAppModule] }).overrideGuard(JwtAuthGuard).useClass(FakeJwtGuard).compile();
    app = ref.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    turns = ref.get(TurnService);
  });
  afterAll(async () => app?.close());

  const post = async (path: string, body: unknown) => {
    const url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    const res = await fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };

  it('injects the NEM-024 dependencies into TurnService (retrieval facade, index permission, anchors, turn records)', () => {
    const t = turns as unknown as Record<string, unknown>;
    for (const k of ['retrieval', 'indexPermission', 'anchors', 'turnRecords']) expect({ k, present: t[k] !== undefined }).toEqual({ k, present: true });
  });

  it('deny-first: the capability guard denies an unentitled user before body validation; with a question, still denied by default', async () => {
    const sid = '20000000-0000-4000-8000-000000000001';
    // Guards run before pipes in Nest, so the deny-first entitlement answer comes before DTO validation
    // (the required `question` rule itself is proven in sessions.dto.spec.ts).
    const missing = await post(`/knowledge/sessions/${sid}/turns`, { idempotencyKey: 'client-key-0001' });
    expect(missing.status).toBe(403);
    const denied = await post(`/knowledge/sessions/${sid}/turns`, { idempotencyKey: 'client-key-0001', question: '¿Qué papel tiene el faro?' });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('prerequisite_missing');
  });
});
