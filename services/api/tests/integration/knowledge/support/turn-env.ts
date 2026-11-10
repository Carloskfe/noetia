import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { KnowledgeMetricsService } from '../../../../src/knowledge/common/knowledge-metrics.service';
import { computeTextHash } from '../../../../src/knowledge/rights/text-hash';
import { AnchorResolver } from '../../../../src/knowledge/retrieval/anchor-resolver';
import { BookIndexer } from '../../../../src/knowledge/retrieval/book-indexer.service';
import { IndexingPermission } from '../../../../src/knowledge/retrieval/indexing-permission';
import { LexicalRetrievalService } from '../../../../src/knowledge/retrieval/lexical-retrieval.service';
import { QueryContextSource } from '../../../../src/knowledge/retrieval/query-context-source.service';
import { RetrievalMetricsService } from '../../../../src/knowledge/retrieval/retrieval-metrics.service';
import { DEFAULT_RETRIEVAL_CONFIG } from '../../../../src/knowledge/retrieval/retrieval.types';
import { ContextBuilderService } from '../../../../src/knowledge/sessions/context-builder.service';
import { TurnRecordStore } from '../../../../src/knowledge/sessions/turn-record.store';
import { TurnService } from '../../../../src/knowledge/sessions/turn.service';
import { insertRights, IT_CONFIG, wire } from './it-env';
import { BOTH_OPS, insertBook, MemoryObjectStore } from './retrieval-env';

/**
 * NEM-024 Checkpoint A harness: the accepted NEM-019/021/022 wiring (`wire`, unchanged) plus E5 retrieval and the
 * turn record, composed exactly as the module does. Simulated provider; fixture texts; local disposable DB only.
 * The rights port, the index permission, and the anchor resolver share ONE text-identity map (`fx.textHash`).
 */
export function wireTurns(ds: DataSource) {
  const w = wire(ds);
  const store = new MemoryObjectStore();
  const identity = { currentTextHash: async (b: string) => w.fx.textHash.get(b) ?? null };
  const authority = {
    attest: async (r: { verifier: string | null; bookId: string }) =>
      (r.verifier === 'fixture-verifier' && !w.fx.unattested.has(r.bookId) ? 'attested' as const : 'not_attested' as const),
  };
  const cfg = { ...DEFAULT_RETRIEVAL_CONFIG, chunkTargetChars: 300 };
  const metrics = new RetrievalMetricsService();
  const permission = new IndexingPermission(w.db, identity, authority);
  const indexer = new BookIndexer(w.db, permission, store, metrics, cfg);
  const lexical = new LexicalRetrievalService(w.db, store, metrics, cfg);
  const qcs = new QueryContextSource(permission, lexical, metrics, cfg);
  const anchors = new AnchorResolver(w.db, identity);
  const records = new TurnRecordStore(w.db, IT_CONFIG);
  const qturns = new TurnService(w.db, w.sessions, w.rights, new ContextBuilderService(new KnowledgeMetricsService()), w.gateway, IT_CONFIG,
    { candidates: async () => [] }, qcs, permission, anchors, records);
  return { ...w, store, permission, indexer, qcs, anchors, records, qturns };
}
export type TurnWiring = ReturnType<typeof wireTurns>;

/** A published, verified, indexed fixture book granting research_analysis + retrieval_indexing. */
export async function researchBook(ds: DataSource, t: TurnWiring, text: string, language = 'es') {
  const key = `texts/${randomUUID()}.txt`;
  const id = await insertBook(ds, { language, textFileKey: key });
  t.store.put(key, text);
  const hash = computeTextHash(Buffer.from(text, 'utf8'));
  t.fx.textHash.set(id, hash);
  await insertRights(ds, id, { textHash: hash, permittedOperations: BOTH_OPS });
  const r = await t.indexer.indexBook(id);
  if (r.outcome !== 'indexed') throw new Error(`fixture book not indexed: ${r.outcome}`);
  return { id, key, hash };
}

export const ledgerEntries = async (ds: DataSource, attemptKey: string) =>
  (await ds.query(`SELECT "entryType" FROM ai_budget_ledger WHERE "idempotencyKey" = $1 ORDER BY id`, [attemptKey])).map((r: { entryType: string }) => r.entryType);
export const turnRows = async (ds: DataSource, sessionId: string) =>
  ds.query(`SELECT id, "turnIndex", "keyHash", status, "failureReason", "reservationRelease", segments, settlement FROM ai_turns WHERE "sessionId" = $1 ORDER BY "createdAt", id`, [sessionId]);

/** A promise plus its resolver, for deterministic interleavings. */
export function gate() {
  let open!: () => void;
  const p = new Promise<void>((r) => { open = r; });
  return { p, open };
}
