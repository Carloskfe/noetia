import { register } from 'prom-client';
import { RetrievalMetricsService } from '../../../../src/knowledge/retrieval/retrieval-metrics.service';

const value = async (name: string, labels: Record<string, string> = {}) => {
  const m = await register.getSingleMetric(name)!.get();
  return m.values.find((v: any) => Object.entries(labels).every(([k, x]) => v.labels[k] === x) && (labels.le === undefined ? !('le' in v.labels) || true : true))?.value ?? 0;
};

describe('RetrievalMetricsService (§5.9)', () => {
  it('registers once and counts with fixed, content-free labels', async () => {
    const a = new RetrievalMetricsService();
    const b = new RetrievalMetricsService(); // re-uses the registered metrics
    const before = await value('intelligence_retrieval_total', { outcome: 'ok' });
    a.retrievalInc('ok');
    b.retrievalInc('ok');
    expect(await value('intelligence_retrieval_total', { outcome: 'ok' })).toBe(before + 2);
    a.excludedInc('stale', 3);
    a.excludedInc('unindexed', 0); // zero is a no-op
    expect(await value('intelligence_retrieval_excluded_total', { reason: 'stale' })).toBeGreaterThanOrEqual(3);
    a.indexBooksInc('indexed');
    expect(await value('intelligence_index_books_total', { outcome: 'indexed' })).toBeGreaterThanOrEqual(1);
    a.passagesObserve(4);
    const h = await register.getSingleMetric('intelligence_retrieval_passages')!.get();
    expect(h.values.find((v: any) => v.metricName === 'intelligence_retrieval_passages_count')!.value).toBeGreaterThanOrEqual(1);
    for (const name of ['intelligence_retrieval_total', 'intelligence_retrieval_excluded_total', 'intelligence_index_books_total']) {
      const labels = (await register.getSingleMetric(name)!.get()).values.flatMap((v: any) => Object.keys(v.labels));
      expect(labels.every((l: string) => ['outcome', 'reason'].includes(l))).toBe(true);
    }
  });
});
