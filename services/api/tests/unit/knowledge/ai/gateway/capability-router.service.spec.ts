import { assertCapabilityDescriptor } from '../../../../../src/knowledge/ai/contract';
import { FIXTURE_DESCRIPTORS } from '../../../../../src/knowledge/ai/contract/fixtures';
import { CapabilityRouterService } from '../../../../../src/knowledge/ai/gateway/capability-router.service';
import { GatewayRequest } from '../../../../../src/knowledge/ai/gateway/gateway.types';
import { renderEnvelope } from '../../../../../src/knowledge/ai/gateway/instruction-templates';
import { RAW_SIMULATOR_DESCRIPTORS, SIMULATOR_DESCRIPTORS } from '../../../../../src/knowledge/ai/simulator/simulator-fixtures';
import { SimulatorV2Adapter } from '../../../../../src/knowledge/ai/simulator/simulator-v2';
import { sealContext } from '../../../../../src/knowledge/ai/verified-context';

const [STANDARD, LONG] = SIMULATOR_DESCRIPTORS;
const ctx = sealContext({ pathId: 'research_session.turn', invariant: 'research_session_context', userId: 'u', allowedBookIds: ['b'], items: [] });
const req = (over: Partial<GatewayRequest> = {}): GatewayRequest => ({
  pathId: 'research_session.turn', context: ctx, templateId: 'research_session.turn.v1', requiredCapabilities: ['research_session'],
  output: { mode: 'text' }, maxOutputTokens: 100, cacheIntent: { mode: 'none' }, turnKey: 'turn:r',
  budget: { userId: 'u', tier: 'noetia_plus', capability: 'research_session', sessionId: null }, ...over,
});
const env = renderEnvelope('research_session.turn.v1', ctx);
const variant = (over: object) => assertCapabilityDescriptor({ ...JSON.parse(JSON.stringify(RAW_SIMULATOR_DESCRIPTORS[0])), ...over });

describe('CapabilityRouterService (simulated-only allowlist, capability negotiation)', () => {
  it('refuses to register a non-simulated adapter: flag, descriptor, or an unsealed descriptor', () => {
    const sim = new SimulatorV2Adapter(STANDARD);
    expect(() => new CapabilityRouterService([Object.assign(Object.create(sim), { simulated: false })])).toThrow('only simulated');
    expect(() => new CapabilityRouterService([new SimulatorV2Adapter(variant({ simulated: false }))])).toThrow('only simulated');
    expect(() => new CapabilityRouterService([Object.assign(Object.create(sim), { descriptor: { ...STANDARD } })])).toThrow('only simulated');
    expect(() => new CapabilityRouterService([sim, new SimulatorV2Adapter(FIXTURE_DESCRIPTORS[0])])).not.toThrow();
  });

  it('selects the first adapter whose descriptor satisfies the request and reports the count and conservative estimate', () => {
    const a = new SimulatorV2Adapter(STANDARD);
    const b = new SimulatorV2Adapter(LONG);
    const n = new CapabilityRouterService([a, b]).negotiate(req(), env);
    expect(n).toMatchObject({ ok: true, adapter: a, countedInputTokens: a.countTokens(env, { mode: 'text' }) });
    const onlyLong = new CapabilityRouterService([b]).negotiate(req(), env);
    expect(onlyLong.ok && onlyLong.reservedInputTokens).toBeGreaterThan(onlyLong.ok ? onlyLong.countedInputTokens : 0); // 1.1× estimate
  });

  it.each([
    ['an unserved model path', req({ pathId: 'other.path' as any })],
    ['a missing capability', req({ requiredCapabilities: ['research_session', 'web_search'] })],
    ['an output bound above the model maximum', req({ maxOutputTokens: 64_001 })],
    ['a non-integer output bound', req({ maxOutputTokens: 1.5 })],
    ['an unsupported cache lifetime', req({ cacheIntent: { mode: 'write', lifetime: '30m' } })],
  ])('capability_unavailable for %s', (_l, r) => {
    expect(new CapabilityRouterService([new SimulatorV2Adapter(STANDARD)]).negotiate(r, env)).toEqual({ ok: false, error: 'capability_unavailable' });
  });

  it('feature requirements: structured output, streaming, citations', () => {
    const plain = variant({ features: { ...RAW_SIMULATOR_DESCRIPTORS[0].features, structuredOutput: false, streaming: false, citations: false } });
    const r = new CapabilityRouterService([new SimulatorV2Adapter(plain)]);
    expect(r.negotiate(req({ output: { mode: 'structured', schema: { type: 'object' } } }), env).ok).toBe(false);
    expect(r.negotiate(req({ requiredFeatures: { streaming: true } }), env).ok).toBe(false);
    expect(r.negotiate(req({ requiredFeatures: { citations: true } }), env).ok).toBe(false);
    expect(r.negotiate(req(), env).ok).toBe(true);
    expect(new CapabilityRouterService([new SimulatorV2Adapter(STANDARD)]).negotiate(req({ cacheIntent: { mode: 'uncertain', lifetime: '1h' }, requiredFeatures: { streaming: true, citations: true } }), env).ok).toBe(true);
  });

  it('context_too_large when every capable model is too small for the counted input; a larger one is chosen if registered', () => {
    const tiny = new SimulatorV2Adapter(variant({ maxContextTokens: 10 }));
    expect(new CapabilityRouterService([tiny]).negotiate(req(), env)).toEqual({ ok: false, error: 'context_too_large' });
    const big = new SimulatorV2Adapter(STANDARD);
    expect(new CapabilityRouterService([tiny, big]).negotiate(req(), env)).toMatchObject({ ok: true, adapter: big });
  });

  it('with no adapters at all, everything is capability_unavailable', () => {
    expect(new CapabilityRouterService([]).negotiate(req(), env)).toEqual({ ok: false, error: 'capability_unavailable' });
  });
});
