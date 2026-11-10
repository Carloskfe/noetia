import { BookIndexer } from './book-indexer.service';
import { isUuid } from './retrieval.types';

/**
 * NEM-023 §5.3 operator command (explicit, offline, manual; concurrency 1). NOT authorized against production:
 * production indexing is blocked by spec §14 (RB-1..RB-7). With the module's unbound text-identity and
 * verification-authority ports, `index` denies every book (default deny).
 *
 *   index <bookId|all>   build the current set for one book / every published book with stored text
 *   prune                remove superseded sets past the grace window (and always past the 30-day cap)
 *   purge <bookId>       revocation: remove every set for the book, immediately
 *
 * Output carries outcomes and counts only — never text, queries, or user data.
 */
export async function runIndexCommand(argv: readonly string[], indexer: Pick<BookIndexer, 'indexBook' | 'indexAll' | 'prune' | 'purge'>): Promise<{ code: number; output: string }> {
  const [cmd, arg] = argv;
  if (cmd === 'index' && arg === 'all') return { code: 0, output: JSON.stringify(await indexer.indexAll()) };
  if (cmd === 'index' && isUuid(arg)) {
    const r = await indexer.indexBook(arg);
    return { code: r.outcome === 'failed' ? 1 : 0, output: JSON.stringify(r) };
  }
  if (cmd === 'prune' && arg === undefined) return { code: 0, output: JSON.stringify(await indexer.prune()) };
  if (cmd === 'purge' && isUuid(arg)) return { code: 0, output: JSON.stringify(await indexer.purge(arg)) };
  return { code: 2, output: 'usage: index <bookId|all> | prune | purge <bookId>' };
}

/* istanbul ignore next — process entry point; composition only (unit-tested logic is above). */
async function main() {
  const [{ AppDataSource }, { StorageService }, { KnowledgeDbService }, { knowledgeConfigFromEnv }, ports, { IndexingPermission }, { RetrievalMetricsService }, { StorageBookText }, types] =
    await Promise.all([
      import('../../data-source'), import('../../storage/storage.service'), import('../common/knowledge-db.service'),
      import('../common/knowledge-config'), import('../rights/rights.ports'), import('./indexing-permission'),
      import('./retrieval-metrics.service'), import('./storage-book-text'), import('./retrieval.types'),
    ]);
  const ds = await AppDataSource.initialize();
  try {
    const db = new KnowledgeDbService(ds, knowledgeConfigFromEnv(process.env));
    // E3 binds the real text-identity and verification-authority adapters; until then both deny (spec §9.1, §14).
    const permission = new IndexingPermission(db, new ports.UnboundTextIdentityPort(), new ports.UnboundRightsVerificationAuthority());
    const indexer = new BookIndexer(db, permission, new StorageBookText(new StorageService()), new RetrievalMetricsService(), types.DEFAULT_RETRIEVAL_CONFIG);
    const { code, output } = await runIndexCommand(process.argv.slice(2), indexer);
    process.stdout.write(`${output}\n`);
    process.exitCode = code;
  } finally {
    await ds.destroy();
  }
}

/* istanbul ignore next */
if (require.main === module) {
  main().catch(() => {
    process.stderr.write('index command failed\n');
    process.exitCode = 1;
  });
}
