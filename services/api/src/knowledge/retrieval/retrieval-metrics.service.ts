import { Counter, Histogram, register } from 'prom-client';

function counter(name: string, help: string, labelNames: string[]): Counter<string> {
  return (register.getSingleMetric(name) as Counter<string>) ?? new Counter({ name, help, labelNames });
}
function histogram(name: string, help: string, buckets: number[]): Histogram<string> {
  return (register.getSingleMetric(name) as Histogram<string>) ?? new Histogram({ name, help, buckets });
}

export type RetrievalOutcome = 'ok' | 'empty' | 'invalid' | 'error';
export type RetrievalExclusionReason = 'stale' | 'unindexed' | 'unavailable' | 'index_not_permitted';
export type IndexOutcome = 'indexed' | 'skipped_scope' | 'skipped_limit' | 'exists' | 'failed';

/**
 * NEM-023 §5.9 metrics. Labels are fixed enumerations only: no query or passage text, no user id, no book id.
 * Kept separate from the NEM-019/021/022 `KnowledgeMetricsService` so accepted code is untouched.
 */
export class RetrievalMetricsService {
  private readonly retrieval = counter('intelligence_retrieval_total', 'Retrieval requests by outcome', ['outcome']);
  private readonly passages = histogram('intelligence_retrieval_passages', 'Passages returned per retrieval', [0, 1, 2, 4, 8, 12, 16, 20]);
  private readonly excluded = counter('intelligence_retrieval_excluded_total', 'Allowed books excluded from retrieval', ['reason']);
  private readonly indexBooks = counter('intelligence_index_books_total', 'Indexer outcomes per book', ['outcome']);

  retrievalInc(outcome: RetrievalOutcome) { this.retrieval.inc({ outcome }); }
  passagesObserve(n: number) { this.passages.observe(n); }
  excludedInc(reason: RetrievalExclusionReason, n = 1) { if (n > 0) this.excluded.inc({ reason }, n); }
  indexBooksInc(outcome: IndexOutcome) { this.indexBooks.inc({ outcome }); }
}
