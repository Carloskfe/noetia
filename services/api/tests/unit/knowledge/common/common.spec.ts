import { register } from 'prom-client';
import { IntelligenceDenied } from '../../../../src/knowledge/common/intelligence-denied.error';
import { knowledgeConfigFromEnv } from '../../../../src/knowledge/common/knowledge-config';
import { KnowledgeDbService } from '../../../../src/knowledge/common/knowledge-db.service';
import { KnowledgeMetricsService } from '../../../../src/knowledge/common/knowledge-metrics.service';
import { TEST_CONFIG } from '../support/fixtures';

describe('IntelligenceDenied', () => {
  it('carries a code and a safe message with the mapped status', () => {
    const e = new IntelligenceDenied('limit_reached');
    expect(e.getStatus()).toBe(422);
    expect(e.getResponse()).toEqual({ code: 'limit_reached', message: 'This session has reached its book limit.' });
  });

  it('no customer-visible message names a model or says "Basic"', () => {
    const reasons = ['prerequisite_missing', 'no_entitlement', 'policy_missing', 'capability_not_in_tier', 'feature_disabled',
      'not_found', 'session_locked', 'session_read_only', 'limit_reached', 'duplicate_book', 'book_ineligible',
      'no_eligible_books', 'budget_exhausted', 'budget_unavailable', 'unresolved_reservations', 'scope_violation',
      'duplicate_turn', 'set_changed', 'turn_failed', 'invalid_request'] as const;
    for (const r of reasons) {
      const msg = JSON.stringify(new IntelligenceDenied(r).getResponse());
      expect(msg).not.toMatch(/basic|simulated|gpt|claude|model/i);
    }
  });
});

describe('knowledgeConfigFromEnv', () => {
  it('uses safe operational defaults and leaves the overall bound unset (fail closed)', () => {
    expect(knowledgeConfigFromEnv({})).toEqual({ statementTimeoutMs: 5000, providerTimeoutMs: 30000, overallUnresolvedUnitsBound: undefined, admissionCacheTtlSeconds: 60 });
  });
  it('parses explicit values and ignores invalid ones', () => {
    const c = knowledgeConfigFromEnv({
      INTELLIGENCE_STATEMENT_TIMEOUT_MS: '1500', INTELLIGENCE_PROVIDER_TIMEOUT_MS: 'abc',
      INTELLIGENCE_OVERALL_UNRESOLVED_UNITS_BOUND: '0', INTELLIGENCE_ADMISSION_CACHE_TTL_SECONDS: '-5',
    });
    expect(c).toEqual({ statementTimeoutMs: 1500, providerTimeoutMs: 30000, overallUnresolvedUnitsBound: 0, admissionCacheTtlSeconds: 60 });
    expect(knowledgeConfigFromEnv({ INTELLIGENCE_OVERALL_UNRESOLVED_UNITS_BOUND: '-1' }).overallUnresolvedUnitsBound).toBeUndefined();
  });
});

describe('KnowledgeDbService', () => {
  it('applies a statement timeout inside every transaction', async () => {
    const m = { query: jest.fn().mockResolvedValue([]) };
    const ds = { query: jest.fn().mockResolvedValue([{ a: 1 }]), transaction: jest.fn((fn: any) => fn(m)) };
    const db = new KnowledgeDbService(ds as any, { ...TEST_CONFIG, statementTimeoutMs: 1234.7 });
    expect(await db.transaction(async () => 'ok')).toBe('ok');
    expect(m.query).toHaveBeenCalledWith('SET LOCAL statement_timeout = 1234');
    expect(await db.query('SELECT 1', [])).toEqual([{ a: 1 }]);
  });
});

describe('KnowledgeMetricsService (§13)', () => {
  it('registers the six counters once and increments them without content labels', async () => {
    const a = new KnowledgeMetricsService();
    const b = new KnowledgeMetricsService(); // second instance reuses registered metrics
    a.resolverDeniedInc('prerequisite_missing');
    b.limitRejectedInc('noetia_plus');
    a.scopeViolationInc();
    a.budgetReservedInc();
    a.budgetRejectedInc('noetia_x');
    a.reservationExpiredInc();
    const text = await register.metrics();
    for (const name of ['intelligence_resolver_denied_total', 'intelligence_session_limit_rejected_total',
      'intelligence_scope_violation_total', 'intelligence_budget_reserved_total',
      'intelligence_budget_rejected_total', 'intelligence_reservation_expired_total']) {
      expect(text).toContain(name);
    }
    expect(text).toContain('intelligence_resolver_denied_total{reason="prerequisite_missing"} 1');
  });
});
