import { ContextItem } from '../ai/verified-context';
import { IndexingPermission } from './indexing-permission';
import { RetrievalMetricsService } from './retrieval-metrics.service';
import { AllowedBookVersion, isUuid, Passage, RetrievalConfig, RetrievalExclusions, RetrievalPort } from './retrieval.types';
import { normalizeQuery } from './lexical-retrieval.service';

export interface QueryContextOptions {
  topK?: number;
  /** Total context-token budget for the returned items (≤ the retrieval maximum). */
  budgetTokens?: number;
}

export interface QueryContextResult {
  items: ContextItem[];
  passages: Passage[];
  /** Disclosed as facts, never hidden (product rule §7). */
  excluded: RetrievalExclusions & { indexNotPermitted: string[] };
  truncated: boolean;
}

/**
 * NEM-023 §5.7 / §9.2 — the E6 boundary. E6 calls `candidatesFor` AFTER the turn's existing user-level eligibility
 * step (unchanged `RightsService.eligibility` + the session set). E5 does not call it from any turn path, and it is
 * NOT bound to `ContextSourcePort` (`TurnService` is unchanged).
 *
 * For each allowed book it re-checks the book-level `IndexingPermission` (cached per request); that also resolves
 * the CURRENT hash through `TextIdentityPort` — never from chunk rows. A book that no longer passes is excluded
 * (`index_not_permitted`) and should be purged. Returns book passages only (`chunk` items; Amendment 1, B-1).
 */
export class QueryContextSource {
  constructor(
    private readonly permission: IndexingPermission,
    private readonly retrieval: RetrievalPort,
    private readonly metrics: RetrievalMetricsService,
    private readonly config: RetrievalConfig,
  ) {}

  async candidatesFor(userId: string, allowedBookIds: readonly string[], query: string, opts: QueryContextOptions = {}): Promise<ContextItem[]> {
    return (await this.resolve(userId, allowedBookIds, query, opts)).items;
  }

  async resolve(_userId: string, allowedBookIds: readonly string[], query: string, opts: QueryContextOptions = {}): Promise<QueryContextResult> {
    const empty = (indexNotPermitted: string[] = []): QueryContextResult => ({
      items: [], passages: [], excluded: { unindexed: [], stale: [], unavailable: [], indexNotPermitted }, truncated: false,
    });
    const books = [...new Set(allowedBookIds)].filter(isUuid).sort();
    if (books.length === 0 || normalizeQuery(query) === '') return empty();

    const decisions = new Map<string, Awaited<ReturnType<IndexingPermission['check']>>>();
    for (const b of books) if (!decisions.has(b)) decisions.set(b, await this.permission.check(b));
    const allowed: AllowedBookVersion[] = [];
    const notPermitted: string[] = [];
    for (const b of books) {
      const d = decisions.get(b)!;
      if (d.permitted) allowed.push({ bookId: b, textHash: d.textHash });
      else notPermitted.push(b);
    }
    this.metrics.excludedInc('index_not_permitted', notPermitted.length);
    if (allowed.length === 0) return empty(notPermitted);

    const budget = Math.min(opts.budgetTokens ?? this.config.defaultBudgetTokens, this.config.maxBudgetTokens);
    const r = await this.retrieval.retrieve({ allowed, query, topK: opts.topK ?? this.config.defaultTopK, budgetTokens: budget });
    const items: ContextItem[] = r.passages.map((p) => ({ kind: 'chunk', ref: p.ref, bookId: p.bookId, text: p.text }));
    return { items, passages: r.passages, excluded: { ...r.excluded, indexNotPermitted: notPermitted }, truncated: r.truncated };
  }
}
