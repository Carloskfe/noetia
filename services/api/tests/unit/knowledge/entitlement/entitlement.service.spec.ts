import { EntitlementService, flagKeyFor, rolloutBucket } from '../../../../src/knowledge/entitlement/entitlement.service';
import {
  QualifyingPlanAnswer,
  QualifyingPlanPort,
  UnboundQualifyingPlanPort,
} from '../../../../src/knowledge/entitlement/qualifying-plan.port';
import { FakeDb, mockMetrics, USER_A } from '../support/fixtures';

type Grant = { tier: string };

/**
 * Simulated prerequisite port for PO-026 fixtures. It only stands in for a
 * future adapter; the resolver's rule is simply "qualifying or deny".
 */
class FixturePlanPort implements QualifyingPlanPort {
  constructor(private readonly kind: string) {}
  async check(): Promise<QualifyingPlanAnswer> {
    switch (this.kind) {
      case 'individual':
      case 'duo':
      case 'family':
        return 'qualifying';
      case 'free':
      case 'token_package_only':
        return 'not_qualifying';
      case 'linked_member': // TT-15 open: no linked member is assumed to qualify
      default:
        return 'unknown';
    }
  }
}

function setup(opts: {
  plan?: QualifyingPlanPort;
  grants?: Grant[];
  policy?: { maxBooks: number; capabilities: string[] } | null;
  flag?: { enabled: boolean; rolloutPercent: number } | null;
}) {
  const db = new FakeDb();
  db.on(/FROM ai_grants/, () => opts.grants ?? [{ tier: 'noetia_plus' }]);
  db.on(/FROM ai_tier_policies/, (p) =>
    opts.policy === null
      ? []
      : [{ id: `pol-${p[0]}`, tier: p[0], version: '1', maxBooks: String(opts.policy?.maxBooks ?? (p[0] === 'noetia_x' ? 10 : 3)), capabilities: opts.policy?.capabilities ?? ['research_session'] }],
  );
  db.on(/FROM feature_flags/, () => (opts.flag === null ? [] : [opts.flag ?? { enabled: true, rolloutPercent: 100 }]));
  const metrics = mockMetrics();
  const svc = new EntitlementService(db as any, metrics, opts.plan ?? new FixturePlanPort('individual'));
  return { svc, db, metrics };
}

describe('EntitlementService (ADR-005 resolver)', () => {
  it('allows a qualifying subscriber with a Noetia+ grant, limit 3 from policy', async () => {
    const { svc } = setup({});
    const r = await svc.resolve(USER_A, 'research_session');
    expect(r).toMatchObject({ allowed: true, tier: 'noetia_plus', limits: { maxBooks: 3 } });
  });

  it('picks the highest active grant (NoetiaX → limit 10)', async () => {
    const { svc } = setup({ grants: [{ tier: 'noetia_plus' }, { tier: 'noetia_x' }, { tier: 'bogus' }] });
    expect(await svc.resolve(USER_A, 'research_session')).toMatchObject({ allowed: true, tier: 'noetia_x', limits: { maxBooks: 10 } });
  });

  describe('prerequisite (PO-026, AC-9, AC-10)', () => {
    it.each(['individual', 'duo', 'family'])('%s subscriber is allowed only when the port answers qualifying', async (kind) => {
      expect((await setup({ plan: new FixturePlanPort(kind) }).svc.resolve(USER_A, 'research_session')).allowed).toBe(true);
    });

    it.each(['free', 'token_package_only', 'linked_member'])('%s fixture is denied even with a grant', async (kind) => {
      const { svc, db } = setup({ plan: new FixturePlanPort(kind), grants: [{ tier: 'noetia_x' }] });
      expect(await svc.resolve(USER_A, 'research_session')).toEqual({ allowed: false, reason: 'prerequisite_missing' });
      expect(db.ran(/ai_grants/)).toHaveLength(0); // grants are never consulted before the prerequisite
    });

    it('unknown denies — the default unbound port (no production adapter)', async () => {
      const { svc, metrics } = setup({ plan: new UnboundQualifyingPlanPort() });
      expect(await svc.resolve(USER_A, 'research_session')).toEqual({ allowed: false, reason: 'prerequisite_missing' });
      expect(metrics.resolverDeniedInc).toHaveBeenCalledWith('prerequisite_missing');
    });

    it('a throwing port is treated as unknown and denies', async () => {
      const plan = { check: jest.fn().mockRejectedValue(new Error('down')) };
      expect(await setup({ plan }).svc.resolve(USER_A, 'research_session')).toEqual({ allowed: false, reason: 'prerequisite_missing' });
    });
  });

  describe('grants', () => {
    it('no active grant denies (expired/revoked grants are filtered in SQL)', async () => {
      const { svc, db } = setup({ grants: [] });
      expect(await svc.resolve(USER_A, 'research_session')).toEqual({ allowed: false, reason: 'no_entitlement' });
      const sql = db.ran(/ai_grants/)[0].sql;
      expect(sql).toMatch(/"revokedAt" IS NULL/);
      expect(sql).toMatch(/"expiresAt" IS NULL OR "expiresAt" > now\(\)/);
    });
  });

  describe('policy', () => {
    it('missing policy denies', async () => {
      expect(await setup({ policy: null }).svc.resolve(USER_A, 'research_session')).toEqual({ allowed: false, reason: 'policy_missing' });
    });
    it('capability not in tier denies', async () => {
      expect(await setup({}).svc.resolve(USER_A, 'highlight_intelligence')).toEqual({ allowed: false, reason: 'capability_not_in_tier' });
    });
    it('activePolicy returns null when no row exists', async () => {
      expect(await setup({ policy: null }).svc.activePolicy('noetia_plus')).toBeNull();
    });
  });

  describe('flags and rollout only restrict', () => {
    it('a missing flag denies', async () => {
      expect(await setup({ flag: null }).svc.resolve(USER_A, 'research_session')).toEqual({ allowed: false, reason: 'feature_disabled' });
    });
    it('a disabled flag denies', async () => {
      expect(await setup({ flag: { enabled: false, rolloutPercent: 100 } }).svc.resolve(USER_A, 'research_session')).toEqual({ allowed: false, reason: 'feature_disabled' });
    });
    it('rollout 0% denies', async () => {
      expect(await setup({ flag: { enabled: true, rolloutPercent: 0 } }).svc.resolve(USER_A, 'research_session')).toEqual({ allowed: false, reason: 'feature_disabled' });
    });
    it('rollout cannot grant: 100% rollout without a grant still denies', async () => {
      expect(await setup({ grants: [] }).svc.resolve(USER_A, 'research_session')).toEqual({ allowed: false, reason: 'no_entitlement' });
    });
    it('rollout cannot grant: 100% rollout without a qualifying plan still denies', async () => {
      expect(await setup({ plan: new FixturePlanPort('free') }).svc.resolve(USER_A, 'research_session')).toEqual({ allowed: false, reason: 'prerequisite_missing' });
    });
    it('flag key is namespaced per capability', () => {
      expect(flagKeyFor('research_session')).toBe('intelligence.research_session');
    });
    it('rollout bucket is deterministic and within 0–99', () => {
      const b = rolloutBucket(USER_A, 'intelligence.research_session');
      expect(b).toBe(rolloutBucket(USER_A, 'intelligence.research_session'));
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    });
  });
});
