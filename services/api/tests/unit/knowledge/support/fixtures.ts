import { KnowledgeConfig } from '../../../../src/knowledge/common/knowledge-config';
import { KnowledgeMetricsService } from '../../../../src/knowledge/common/knowledge-metrics.service';

/** Invented identifiers only — no real users, books, or text. */
export const USER_A = '00000000-0000-4000-8000-00000000000a';
export const USER_B = '00000000-0000-4000-8000-00000000000b';
export const bookId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const TEST_CONFIG: KnowledgeConfig = {
  statementTimeoutMs: 5000,
  providerTimeoutMs: 50,
  overallUnresolvedUnitsBound: 1_000_000,
  admissionCacheTtlSeconds: 60,
};

export function mockMetrics(): jest.Mocked<KnowledgeMetricsService> {
  return {
    resolverDeniedInc: jest.fn(),
    limitRejectedInc: jest.fn(),
    scopeViolationInc: jest.fn(),
    budgetReservedInc: jest.fn(),
    budgetRejectedInc: jest.fn(),
    reservationExpiredInc: jest.fn(),
  } as unknown as jest.Mocked<KnowledgeMetricsService>;
}

type Handler = { re: RegExp; fn: (params: any[]) => any };

/**
 * Minimal SQL-routing fake for KnowledgeDbService / EntityManager. Each test
 * registers handlers by regex; an unmatched statement throws, so tests notice
 * unexpected queries.
 */
export class FakeDb {
  handlers: Handler[] = [];
  calls: { sql: string; params: any[] }[] = [];
  failNext: RegExp | null = null;

  on(re: RegExp, fn: (params: any[]) => any) {
    this.handlers.unshift({ re, fn });
    return this;
  }

  query = jest.fn(async (sql: string, params: any[] = []) => {
    this.calls.push({ sql, params });
    if (this.failNext && this.failNext.test(sql)) {
      this.failNext = null;
      throw new Error('simulated database failure');
    }
    if (/^SET LOCAL statement_timeout/.test(sql)) return [];
    const h = this.handlers.find((x) => x.re.test(sql));
    if (!h) throw new Error(`unexpected SQL: ${sql.slice(0, 80)}`);
    return h.fn(params);
  });

  transaction = jest.fn(async (fn: (m: any) => Promise<any>) => {
    await this.query('SET LOCAL statement_timeout = 5000');
    return fn({ query: this.query });
  });

  ran(re: RegExp) {
    return this.calls.filter((c) => re.test(c.sql));
  }
}
