import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MODEL_PATHS } from '../../../src/knowledge/ai/model-paths';
import { CAPABILITY_METADATA } from '../../../src/knowledge/entitlement/capability.guard';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import { SessionsController } from '../../../src/knowledge/sessions/sessions.controller';

const API = join(__dirname, '../../..');
const SRC = join(API, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}
const rel = (p: string) => relative(API, p).split('\\').join('/');
const imports = (file: string) => [...readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'|require\('([^']+)'\)/g)].map((m) => m[1] ?? m[2]);
const knowledgeFiles = walk(join(SRC, 'knowledge'));

describe('NEM-019 architecture boundaries (AC-16, AC-17, AC-18, AC-12a, §10)', () => {
  it('AC-16: reader, library, books, fragments, token, subscription, and codes modules never import knowledge/*', () => {
    const guarded = ['books', 'library', 'fragments', 'subscriptions', 'codes', 'gifts', 'users', 'stats', 'clubs'];
    const offenders = guarded
      .flatMap((d) => (existsSync(join(SRC, d)) ? walk(join(SRC, d)) : []))
      .filter((f) => imports(f).some((i) => /knowledge/.test(i)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('only app.module.ts (via knowledge.registration) references knowledge/* outside the module', () => {
    const outside = walk(SRC).filter((f) => !f.includes(`${join(SRC, 'knowledge')}`) && imports(f).some((i) => /knowledge\//.test(i)));
    expect(outside.map(rel)).toEqual(['src/app.module.ts']);
    expect(imports(join(SRC, 'app.module.ts')).filter((i) => /knowledge/.test(i))).toEqual(['./knowledge/knowledge.registration']);
  });

  it('knowledge.registration.ts imports nothing from knowledge/* statically', () => {
    const src = readFileSync(join(SRC, 'knowledge/knowledge.registration.ts'), 'utf8');
    expect(src).not.toMatch(/^import .* from '\.\//m);
  });

  it('AC-16/17: knowledge/* imports no token, subscription, plan, Stripe, or user-plan code', () => {
    const forbidden = /(subscriptions|codes|gifts|stripe|token|plans?|library|fragments|users)\//i;
    const offenders = knowledgeFiles.filter((f) => imports(f).some((i) => i.startsWith('.') && forbidden.test(i) && !/auth\/jwt-auth\.guard/.test(i)));
    expect(offenders.map(rel)).toEqual([]);
    expect(knowledgeFiles.filter((f) => imports(f).includes('stripe')).map(rel)).toEqual([]);
  });

  it('AC-10/17: knowledge SQL touches no token, plan, subscription, user_books, or fragments table (no shared path, no write to book plans)', () => {
    const tables = /\b(token_ledger|token_packages|plans|subscriptions|user_books|fragments|reading_progress|sync_maps)\b/;
    const offenders = knowledgeFiles.filter((f) => [...readFileSync(f, 'utf8').matchAll(/`([^`]*)`/g)].some((m) => /\b(SELECT|INSERT|UPDATE|DELETE)\b/.test(m[1]) && tables.test(m[1])));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('knowledge/* contains no *.entity.ts (the app entity glob must not pick anything up while dark)', () => {
    expect(knowledgeFiles.filter((f) => f.endsWith('.entity.ts')).map(rel)).toEqual([]);
  });

  it('AC-18: no provider SDK in package.json and no outbound HTTP client in knowledge/*', () => {
    const pkg = JSON.parse(readFileSync(join(API, 'package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /openai|anthropic|@google\/generative|cohere|mistral|langchain|ollama|replicate|together-ai|groq/i.test(d))).toEqual([]);
    const net = knowledgeFiles.filter((f) => imports(f).some((i) => /^(axios|node-fetch|undici|got|http|https|@nestjs\/axios)$/.test(i)) || /\bfetch\(/.test(readFileSync(f, 'utf8')));
    expect(net.map(rel)).toEqual([]);
  });

  describe('AC-12a / B-3: every path to a model declares a context invariant with a proving test', () => {
    it('every registered path has an invariant, an existing source, and an existing test that names the invariant', () => {
      for (const [id, p] of Object.entries(MODEL_PATHS)) {
        expect(p.invariant).toBeTruthy();
        expect(existsSync(join(API, p.source))).toBe(true);
        const testFile = join(API, p.test);
        expect(existsSync(testFile)).toBe(true);
        const t = readFileSync(testFile, 'utf8');
        expect(t).toContain(id);
        expect(t).toContain(p.invariant);
      }
    });

    it('no file calls the Gateway unless it is a registered model path', () => {
      const callers = knowledgeFiles
        .filter((f) => /gateway\.invoke\(/.test(readFileSync(f, 'utf8')))
        .map(rel);
      const registered = Object.values(MODEL_PATHS).map((p) => p.source);
      expect(callers.filter((c) => !registered.includes(c as any))).toEqual([]);
      expect(callers.length).toBeGreaterThan(0);
    });

    it('only Context Builders may seal a context', () => {
      const sealers = knowledgeFiles.filter((f) => /sealContext\(/.test(readFileSync(f, 'utf8'))).map(rel);
      expect(sealers.sort()).toEqual(['src/knowledge/ai/verified-context.ts', 'src/knowledge/sessions/context-builder.service.ts']);
    });

    it('a deliberately unregistered caller would fail the check (self-test)', () => {
      const fake = ['src/knowledge/sessions/turn.service.ts', 'src/knowledge/rogue.ts'];
      const registered = Object.values(MODEL_PATHS).map((p) => p.source as string);
      expect(fake.filter((c) => !registered.includes(c))).toEqual(['src/knowledge/rogue.ts']);
    });
  });

  describe('§10: every knowledge route has JwtAuthGuard and a declared capability', () => {
    const controllers = [SessionsController];
    it('every controller is guarded by JwtAuthGuard', () => {
      for (const c of controllers) {
        const guards = Reflect.getMetadata(GUARDS_METADATA, c) ?? [];
        expect(guards).toContain(JwtAuthGuard);
      }
    });
    it('every route handler declares a capability', () => {
      for (const c of controllers) {
        const proto = c.prototype as unknown as Record<string, unknown>;
        const handlers = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor' && Reflect.getMetadata(PATH_METADATA, proto[n] as object) !== undefined);
        expect(handlers.length).toBeGreaterThan(0);
        for (const h of handlers) {
          expect({ h, decl: Reflect.getMetadata(CAPABILITY_METADATA, proto[h] as object) }).toEqual({ h, decl: expect.objectContaining({ capability: expect.any(String) }) });
        }
      }
    });
    it('every controller in knowledge/* is in the checked list', () => {
      const found = knowledgeFiles.filter((f) => /@Controller\(/.test(readFileSync(f, 'utf8'))).map(rel);
      expect(found).toEqual(['src/knowledge/sessions/sessions.controller.ts']);
    });
  });

  it('neutral naming: no "plus" in knowledge file names or exported class names', () => {
    expect(knowledgeFiles.filter((f) => /plus/i.test(rel(f)))).toEqual([]);
    const classes = knowledgeFiles.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/export class (\w+)/g)].map((m) => m[1]));
    expect(classes.filter((c) => /plus/i.test(c))).toEqual([]);
  });

  it('no log statement in knowledge/* includes user ids, keys, or content', () => {
    const logs = knowledgeFiles.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/logger\.(log|warn|error|debug)\(([^;]*)\)/g)].map((m) => m[2]));
    for (const l of logs) expect(l).not.toMatch(/userId|idempotencyKey|text|prompt|bookId/);
  });
});
