import { MODEL_PATHS } from '../../../../src/knowledge/ai/model-paths';
import { ModelGatewayService } from '../../../../src/knowledge/ai/model-gateway.service';
import { ModelRouterService } from '../../../../src/knowledge/ai/model-router.service';
import { SimulatedProviderService } from '../../../../src/knowledge/ai/simulated-provider.service';
import { isVerifiedContext, sealContext } from '../../../../src/knowledge/ai/verified-context';
import { bookId, TEST_CONFIG, USER_A } from '../support/fixtures';

const PATH = 'research_session.turn' as const;
const ctx = (allowed = [bookId(1)]) =>
  sealContext({ pathId: PATH, invariant: MODEL_PATHS[PATH].invariant, userId: USER_A, allowedBookIds: allowed, items: [] });

function setup() {
  const sim = new SimulatedProviderService();
  const gw = new ModelGatewayService(new ModelRouterService([sim]), TEST_CONFIG);
  return { sim, gw };
}

describe('ModelGatewayService', () => {
  it('success reports usage and segments, never a model name in segments', async () => {
    const { gw } = setup();
    const r = await gw.invoke(PATH, ctx());
    expect(r).toMatchObject({ outcome: 'success', unitsReported: 1, provider: 'simulated', scopeViolation: false });
    expect(JSON.stringify(r.segments)).not.toMatch(/simulated-v1/);
    expect(r.segments.map((s) => s.origin)).toEqual(['library', 'synthesis']);
  });

  it('rejects an unsealed context (no declared invariant)', async () => {
    const { gw } = setup();
    const forged = { pathId: PATH, invariant: MODEL_PATHS[PATH].invariant, userId: USER_A, allowedBookIds: [], items: [] };
    await expect(gw.invoke(PATH, forged as any)).rejects.toThrow('context invariant');
  });

  it('rejects a context sealed for a different invariant', async () => {
    const { gw } = setup();
    const wrong = sealContext({ pathId: PATH, invariant: 'other', userId: USER_A, allowedBookIds: [], items: [] });
    await expect(gw.invoke(PATH, wrong)).rejects.toThrow('context invariant');
  });

  it('AC-14: a planner/tool call naming an unselected book is a scope violation; segments dropped', async () => {
    const { gw, sim } = setup();
    sim.enqueue({ kind: 'success', units: 4, toolCalls: [{ name: 'retrieve', bookId: bookId(9) }] });
    const r = await gw.invoke(PATH, ctx());
    expect(r).toMatchObject({ scopeViolation: true, segments: [], unitsReported: 4 });
  });

  it('a tool call naming an allowed book is accepted', async () => {
    const { gw, sim } = setup();
    sim.enqueue({ kind: 'success', toolCalls: [{ name: 'retrieve', bookId: bookId(1) }] });
    expect((await gw.invoke(PATH, ctx())).scopeViolation).toBe(false);
  });

  it('failure with known usage keeps the units; unknown usage is null', async () => {
    const { gw, sim } = setup();
    sim.enqueue({ kind: 'failure', units: 2 }, { kind: 'failure', units: null });
    expect(await gw.invoke(PATH, ctx())).toMatchObject({ outcome: 'failure', unitsReported: 2 });
    expect(await gw.invoke(PATH, ctx())).toMatchObject({ outcome: 'failure', unitsReported: null });
  });

  it('aborted stream → aborted with unknown usage', async () => {
    const { gw, sim } = setup();
    sim.enqueue({ kind: 'abort' });
    expect(await gw.invoke(PATH, ctx())).toMatchObject({ outcome: 'aborted', unitsReported: null });
  });

  it('a hanging provider times out with unknown usage', async () => {
    const { gw, sim } = setup();
    sim.enqueue({ kind: 'hang' });
    expect(await gw.invoke(PATH, ctx())).toMatchObject({ outcome: 'timeout', unitsReported: null });
  });

  it('a throwing provider → failure with unknown usage', async () => {
    const { gw, sim } = setup();
    sim.enqueue({ kind: 'throw' });
    expect(await gw.invoke(PATH, ctx())).toMatchObject({ outcome: 'failure', unitsReported: null });
  });

  it('invalid reported usage is treated as unknown', async () => {
    const { gw, sim } = setup();
    sim.enqueue({ kind: 'success', units: -3 });
    expect((await gw.invoke(PATH, ctx())).unitsReported).toBeNull();
  });

  it('runs the simulated beforeRespond hook', async () => {
    const { gw, sim } = setup();
    sim.beforeRespond = jest.fn(async () => undefined);
    await gw.invoke(PATH, ctx());
    expect(sim.beforeRespond).toHaveBeenCalled();
  });
});

describe('ModelRouterService — simulated providers only', () => {
  it('selects the simulated provider', () => {
    const sim = new SimulatedProviderService();
    expect(new ModelRouterService([sim]).select(PATH)).toBe(sim);
  });
  it('refuses a non-simulated provider', () => {
    const real = { id: 'real', modelKey: 'x', simulated: false, invoke: jest.fn() };
    expect(() => new ModelRouterService([real]).select(PATH)).toThrow('no simulated provider');
  });
  it('refuses an unregistered path', () => {
    expect(() => new ModelRouterService([new SimulatedProviderService()]).select('nope' as any)).toThrow('unregistered');
  });
});

describe('verified context', () => {
  it('is frozen and recognisable only when sealed', () => {
    const c = ctx();
    expect(isVerifiedContext(c)).toBe(true);
    expect(Object.isFrozen(c)).toBe(true);
    expect(isVerifiedContext({ ...c })).toBe(true); // symbol copied by spread is still a seal...
    expect(isVerifiedContext(JSON.parse(JSON.stringify(c)))).toBe(false); // ...but cannot be forged from data
    expect(isVerifiedContext(null)).toBe(false);
  });
});
