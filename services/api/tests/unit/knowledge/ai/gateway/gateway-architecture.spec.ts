import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { SIMULATOR_DESCRIPTORS } from '../../../../../src/knowledge/ai/simulator/simulator-fixtures';
import { KnowledgeMetricsService } from '../../../../../src/knowledge/common/knowledge-metrics.service';
import { knowledgeConfigFromEnv } from '../../../../../src/knowledge/common/knowledge-config';
import { register } from 'prom-client';

/** NEM-022 §5.11, §9, §10: dark by default, no network or credentials, simulated only, no content in logs or metrics. */
const API = join(__dirname, '../../../../..');
const SRC = join(API, 'src');
const AI = join(SRC, 'knowledge/ai');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
});
const rel = (p: string) => relative(API, p).split('\\').join('/');
const NEW = [...walk(join(AI, 'gateway')), ...walk(join(AI, 'simulator'))];
const src = (f: string) => readFileSync(f, 'utf8');
const imports = (f: string) => [...src(f).matchAll(/from\s+'([^']+)'|require\('([^']+)'\)/g)].map((m) => m[1] ?? m[2]);

describe('NEM-022 Gateway v2 architecture and security', () => {
  it('dark: Gateway v2 exists only inside KnowledgeModule, which app.module loads only through the flag-gated registration', () => {
    const users = walk(SRC).filter((f) => !f.includes(`${join(SRC, 'knowledge')}/`) && /ai-gateway|simulator-v2|capability-router/.test(src(f)));
    expect(users.map(rel)).toEqual([]);
    const registration = src(join(SRC, 'knowledge/knowledge.registration.ts'));
    expect(registration).toMatch(/KNOWLEDGE_MODULE_ENABLED/);
    expect(src(join(SRC, 'knowledge/knowledge.module.ts'))).toMatch(/controllers: \[SessionsController\]/); // no new route
    expect(NEW.filter((f) => /@Controller\(|@Get\(|@Post\(/.test(src(f))).map(rel)).toEqual([]);
  });

  it('no SDK, HTTP client, socket, or credential read in the Gateway or simulator', () => {
    const net = NEW.filter((f) => imports(f).some((i) => /^(axios|node-fetch|undici|got|http|https|net|tls|dgram|ws|@nestjs\/axios)$/.test(i))
      || /\bfetch\(|XMLHttpRequest|process\.env/.test(src(f)));
    expect(net.map(rel)).toEqual([]);
    const sdk = NEW.filter((f) => imports(f).some((i) => /openai|anthropic|google|cohere|mistral|langchain|ollama|replicate|bedrock|vertex/i.test(i)));
    expect(sdk.map(rel)).toEqual([]);
  });

  it('only simulated providers are registered in the module, and every simulator descriptor is simulated', () => {
    expect(src(join(SRC, 'knowledge/knowledge.module.ts'))).toMatch(/SIMULATOR_DESCRIPTORS\.map\(\(d\) => new SimulatorV2Adapter\(d\)\)/);
    expect(SIMULATOR_DESCRIPTORS.every((d) => d.simulated)).toBe(true);
    expect(src(join(AI, 'gateway/capability-router.service.ts'))).toMatch(/only simulated provider adapters may be registered/);
  });

  it('no free-form prompt: instructions are defined only in the template registry', () => {
    const definers = walk(join(SRC, 'knowledge')).filter((f) => /instructions:\s*['`]/.test(src(f))).map(rel);
    expect(definers).toEqual(['src/knowledge/ai/gateway/instruction-templates.ts']);
  });

  it('no logging in the Gateway or simulator, and no content-bearing metric labels', () => {
    expect(NEW.filter((f) => /logger\.|console\./.test(src(f))).map(rel)).toEqual([]);
    const metrics = src(join(SRC, 'knowledge/common/knowledge-metrics.service.ts'));
    const labels = [...metrics.matchAll(/\['([a-z_]+)'\]\s*,?\s*\)/g)].map((m) => m[1]);
    expect(labels.every((l) => ['reason', 'tier', 'outcome'].includes(l))).toBe(true);
  });

  it('the Gateway never decides settle, hold, or release: no ledger action literals in gateway code', () => {
    const gw = walk(join(AI, 'gateway')).filter((f) => /'settle_partial_hold_remainder'|ledgerActionFor\(|'release'\s*:/.test(src(f)));
    expect(gw.map(rel)).toEqual([]);
  });
});

describe('NEM-022 metrics (§13) and configuration', () => {
  it('records gateway outcome, retry, and capability-unavailable counters with outcome-only labels', async () => {
    const m = new KnowledgeMetricsService();
    m.gatewayOutcomeInc('completed');
    m.gatewayRetryInc();
    m.capabilityUnavailableInc();
    const out = await register.metrics();
    expect(out).toMatch(/intelligence_gateway_outcome_total\{outcome="completed"\} [1-9]/);
    expect(out).toMatch(/intelligence_gateway_retry_total [1-9]/);
    expect(out).toMatch(/intelligence_capability_unavailable_total [1-9]/);
  });

  it('Gateway settings are read only when set, as non-negative integers; defaults apply where used', () => {
    expect(knowledgeConfigFromEnv({})).not.toHaveProperty('maxProviderAttempts');
    expect(knowledgeConfigFromEnv({
      INTELLIGENCE_MAX_PROVIDER_ATTEMPTS: '3', INTELLIGENCE_RETRY_BACKOFF_MS: '0', INTELLIGENCE_MAX_RETRY_DELAY_MS: '2000',
      INTELLIGENCE_ABORT_GRACE_MS: '50', INTELLIGENCE_TURN_MAX_OUTPUT_TOKENS: '512', INTELLIGENCE_TURN_MAX_TOOL_CALLS: '2',
    })).toMatchObject({ maxProviderAttempts: 3, retryBackoffMs: 0, maxRetryDelayMs: 2000, abortGraceMs: 50, turnMaxOutputTokens: 512, turnMaxToolCalls: 2 });
    for (const bad of ['-1', 'abc', '1.5', '', '99999999999999999999']) {
      expect(knowledgeConfigFromEnv({ INTELLIGENCE_MAX_PROVIDER_ATTEMPTS: bad })).not.toHaveProperty('maxProviderAttempts');
    }
  });
});
