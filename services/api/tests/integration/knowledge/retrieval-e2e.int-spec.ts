import { DataSource } from 'typeorm';
import { RAW_FIXTURE_UNIT_WEIGHTS } from '../../../src/knowledge/ai/contract/fixtures';
import { AiGatewayService } from '../../../src/knowledge/ai/gateway/ai-gateway.service';
import { GatewayRequest } from '../../../src/knowledge/ai/gateway/gateway.types';
import { VerifiedContext } from '../../../src/knowledge/ai/verified-context';
import { CapabilityRouterService } from '../../../src/knowledge/ai/gateway/capability-router.service';
import { RAW_SIMULATOR_PRICING, SIMULATOR_DESCRIPTORS } from '../../../src/knowledge/ai/simulator/simulator-fixtures';
import { SimStep, SimulatorV2Adapter } from '../../../src/knowledge/ai/simulator/simulator-v2';
import { KnowledgeMetricsService } from '../../../src/knowledge/common/knowledge-metrics.service';
import { ContextBuilderService } from '../../../src/knowledge/sessions/context-builder.service';
import { budgetPolicy, IT_CONFIG, openDataSource } from './support/it-env';
import { addActivePricing, CAP, CostWiring, newUser, resetCostState, setGlobalPolicy, wireCost } from './support/cost-env';
import { EN_TEXT, ES_TEXT, fixtureBook, RetrievalWiring, wireRetrieval } from './support/retrieval-env';

/**
 * NEM-023 AC-8 / AC-9 in TEST CODE only: user-level eligibility (unchanged RightsService) → QueryContextSource →
 * unchanged Context Builder → accepted Gateway v2 + simulator v2 → NEM-021 cost ledger. No TurnService or
 * ContextSourcePort change; E6 owns the real wiring.
 */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('NEM-023 end to end (test code): eligibility → retrieval → Context Builder → Gateway citations → ledger', () => {
  let ds: DataSource;
  let c: CostWiring;
  let w: RetrievalWiring;
  let books: { id: string }[];
  beforeAll(async () => {
    ds = await openDataSource();
    c = wireCost(ds);
    w = wireRetrieval(ds);
    await resetCostState(ds);
    await budgetPolicy(ds, 'noetia_plus', CAP, { allowanceUnits: 1_000_000_000, maxUnresolvedUnits: 1_000_000_000 });
    for (const raw of RAW_SIMULATOR_PRICING) await addActivePricing(c, clone(raw));
    await c.costConfig.activateUnitWeightSchema(await c.costConfig.addUnitWeightSchema(clone(RAW_FIXTURE_UNIT_WEIGHTS)));
    await setGlobalPolicy(c, 1_000_000_000_000n);
    books = [await fixtureBook(ds, w, ES_TEXT), await fixtureBook(ds, w, EN_TEXT, { language: 'en' })];
    for (const b of books) await w.indexer.indexBook(b.id);
  });
  afterAll(async () => { await resetCostState(ds); await ds?.destroy(); });

  function gateway(steps: SimStep[] = []) {
    const sim = new SimulatorV2Adapter(SIMULATOR_DESCRIPTORS[0], { seed: 'nem023' });
    sim.enqueue(...steps);
    return new AiGatewayService(new CapabilityRouterService([sim]), c.costLedger, new KnowledgeMetricsService(), IT_CONFIG);
  }

  /** What E6 will do: eligibility first (unchanged NEM-019 resolver), then retrieval for the eligible books only. */
  async function turnContext(userId: string, query: string, budgetTokens = 6000) {
    const eligible: string[] = [];
    for (const b of books) if ((await w.rights.eligibility(userId, b.id, 'research_analysis')).eligible) eligible.push(b.id);
    const items = await w.qcs.candidatesFor(userId, eligible, query, { budgetTokens });
    return { eligible, items, context: new ContextBuilderService(new KnowledgeMetricsService()).build(userId, eligible, items) };
  }

  const request = (context: VerifiedContext, userId: string, turnKey: string): GatewayRequest => ({
    pathId: 'research_session.turn', templateId: 'research_session.turn.v1', requiredCapabilities: ['research_session'],
    context, output: { mode: 'text' }, maxOutputTokens: 256, cacheIntent: { mode: 'none' }, turnKey,
    budget: { userId, tier: 'noetia_plus', capability: CAP, sessionId: null }, nonTokenUnitBounds: { tool_call: 1 },
  });

  it('AC-8: library segments cite retrieved chunk refs and pass the NEM-022 citation policy; settled once', async () => {
    const u = await newUser(ds);
    const { items, context } = await turnContext(u, 'faro or lighthouse');
    expect(items.length).toBeGreaterThan(0);
    const gw = gateway();
    const r = await gw.invoke(await gw.prepare(request(context, u, 'turn:nem023-e2e')));
    expect(r).toMatchObject({ outcome: 'completed', settlement: 'settled', scopeViolation: false });
    const library = r.segments.filter((s) => s.origin === 'library');
    expect(library.length).toBeGreaterThan(0);
    const refs = new Set(items.map((i) => i.ref));
    for (const s of library) for (const cit of s.citations) {
      expect(refs.has(cit.ref)).toBe(true);
      expect(cit.kind).toBe('chunk');
      expect(books.map((b) => b.id)).toContain(cit.bookId);
      expect(await w.anchors.resolve(cit.ref)).not.toBeNull();
    }
  });

  it('AC-8: a citation to a non-retrieved ref is a scope violation; no text is released', async () => {
    const u = await newUser(ds);
    const { context } = await turnContext(u, 'faro or lighthouse');
    const gw = gateway([{ kind: 'citation_error' }]);
    const r = await gw.invoke(await gw.prepare(request(context, u, 'turn:nem023-e2e-violation')));
    expect(r).toMatchObject({ scopeViolation: true, segments: [] });
  });

  it('AC-8: books failing user-level eligibility never reach retrieval or the context', async () => {
    const u = await newUser(ds);
    await ds.query(`UPDATE book_ai_rights SET status = 'revoked' WHERE "bookId" = $1`, [books[1].id]);
    try {
      const { eligible, items } = await turnContext(u, 'faro or lighthouse');
      expect(eligible).toEqual([books[0].id]);
      expect(items.every((i) => i.bookId === books[0].id)).toBe(true);
    } finally {
      await ds.query(`UPDATE book_ai_rights SET status = 'verified' WHERE "bookId" = $1`, [books[1].id]);
    }
  });

  it('AC-9: the context budget bounds the NEM-021 reservation (a smaller budget never reserves more)', async () => {
    const u = await newUser(ds);
    const reserved: bigint[] = [];
    for (const budget of [40, 400, 6000]) {
      const { items, context } = await turnContext(u, 'faro or mapas or Madrid or lighthouse or maps', budget);
      const gw = gateway();
      const p = await gw.prepare(request(context, u, `turn:nem023-budget-${budget}`));
      reserved.push(p.firstReservation.reservedMicroUsd);
      expect(items.reduce((n, i) => n + Math.ceil(Buffer.byteLength(i.text ?? '', 'utf8') / 3), 0)).toBeLessThanOrEqual(budget);
      await gw.release(p);
    }
    expect(reserved[0] <= reserved[1] && reserved[1] <= reserved[2]).toBe(true);
    expect(reserved[0] < reserved[2]).toBe(true);
  });
});
