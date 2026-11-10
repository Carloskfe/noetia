import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { KnowledgeDbService } from '../../../../src/knowledge/common/knowledge-db.service';
import { OwnershipAnswer } from '../../../../src/knowledge/rights/rights.ports';
import { RightsService } from '../../../../src/knowledge/rights/rights.service';
import { computeTextHash } from '../../../../src/knowledge/rights/text-hash';
import { AnchorResolver } from '../../../../src/knowledge/retrieval/anchor-resolver';
import { BookIndexer } from '../../../../src/knowledge/retrieval/book-indexer.service';
import { IndexingPermission, RETRIEVAL_INDEXING_OPERATION } from '../../../../src/knowledge/retrieval/indexing-permission';
import { LexicalRetrievalService } from '../../../../src/knowledge/retrieval/lexical-retrieval.service';
import { QueryContextSource } from '../../../../src/knowledge/retrieval/query-context-source.service';
import { RetrievalMetricsService } from '../../../../src/knowledge/retrieval/retrieval-metrics.service';
import { BookTextPort, DEFAULT_RETRIEVAL_CONFIG, RetrievalConfig } from '../../../../src/knowledge/retrieval/retrieval.types';
import { insertRights, IT_CONFIG } from './it-env';

/**
 * NEM-023 harness. The S2 object store is an in-process fake (spec §3: a local MinIO-compatible fixture); the
 * performance suite can swap in the real StorageService against a disposable local MinIO container.
 * Fixture texts are invented. No network, no provider, no production data.
 */
export class MemoryObjectStore implements BookTextPort {
  readonly objects = new Map<string, Uint8Array>();
  readonly failing = new Set<string>();
  reads = 0;
  put(key: string, text: string | Uint8Array) {
    this.objects.set(key, typeof text === 'string' ? Buffer.from(text, 'utf8') : text);
  }
  async read(key: string): Promise<Uint8Array> {
    this.reads++;
    if (this.failing.has(key)) throw new Error('fixture object store unavailable');
    const v = this.objects.get(key);
    if (!v) throw new Error('NoSuchKey');
    return v;
  }
}

export const BOTH_OPS = ['research_analysis', RETRIEVAL_INDEXING_OPERATION];

/** Invented Spanish fixture (several paragraphs; accents, ñ, stop words, inflections). */
export const ES_TEXT = [
  'Capítulo primero. El niño de la plaza.',
  'Érase una vez un niño que vivía cerca de la plaza mayor de una ciudad inventada. Cada mañana corría hacia la fuente y cantaba una canción antigua que nadie más recordaba.',
  'Los vecinos decían que la canción hablaba de un faro junto al mar, aunque la ciudad estaba lejos de cualquier costa. El niño no sabía leer, pero repetía cada verso con cuidado.',
  'Una tarde llegó un viajero desde Madrid con un cuaderno lleno de mapas. Escuchó las canciones del niño y anotó cada palabra, convencido de que describían un lugar real.',
  'Pasaron los años. El cuaderno del viajero terminó en una biblioteca, y los mapas mostraban un faro que ningún marinero había visto jamás.',
].join('\n\n');

/** Invented English fixture. */
export const EN_TEXT = [
  'Chapter One. The Lighthouse Keeper.',
  'The children were running quickly along the harbour towards the old café, where the lighthouse keeper told stories every evening.',
  'He spoke of a traveller from Madrid who carried a notebook full of maps, and of a song that nobody in the town could remember.',
  'Years later the notebook was found in a library. Its maps showed a lighthouse that no sailor had ever seen.',
].join('\n\n');

export async function insertBook(ds: DataSource, o: { language?: string; textFileKey?: string | null; isPublished?: boolean } = {}): Promise<string> {
  const [b] = await ds.query(
    `INSERT INTO books (title, author, category, language, "textFileKey", "isPublished") VALUES ($1, 'Fixture Author', 'classic', $2, $3, $4) RETURNING id`,
    [`Invented Retrieval Fixture ${randomUUID().slice(0, 8)}`, o.language ?? 'es', o.textFileKey === undefined ? `texts/${randomUUID()}.txt` : o.textFileKey, o.isPublished ?? true],
  );
  return b.id;
}

export function wireRetrieval(ds: DataSource, config: Partial<RetrievalConfig> = {}) {
  const textHash = new Map<string, string>();
  const ownership = new Map<string, OwnershipAnswer>();
  const unattested = new Set<string>();
  const store = new MemoryObjectStore();
  const db = new KnowledgeDbService(ds, IT_CONFIG);
  const identity = { currentTextHash: async (b: string) => textHash.get(b) ?? null };
  const authority = { attest: async (r: { verifier: string | null; bookId: string }) => (r.verifier === 'fixture-verifier' && !unattested.has(r.bookId) ? 'attested' as const : 'not_attested' as const) };
  const cfg = { ...DEFAULT_RETRIEVAL_CONFIG, chunkTargetChars: 300, ...config };
  const metrics = new RetrievalMetricsService();
  const permission = new IndexingPermission(db, identity, authority);
  const indexer = new BookIndexer(db, permission, store, metrics, cfg);
  const retrieval = new LexicalRetrievalService(db, store, metrics, cfg);
  const qcs = new QueryContextSource(permission, retrieval, metrics, cfg);
  const anchors = new AnchorResolver(db, identity);
  const rights = new RightsService(db, { check: async (u, b) => ownership.get(`${u}:${b}`) ?? 'unknown' }, identity, authority);
  return { db, store, textHash, ownership, unattested, permission, indexer, retrieval, qcs, anchors, rights, config: cfg, metrics };
}
export type RetrievalWiring = ReturnType<typeof wireRetrieval>;

/**
 * A published fixture book whose current text is `text`, stored in the fake object store, with a verified, attested
 * rights record for exactly that text hash granting `ops` (default: research_analysis + retrieval_indexing).
 */
export async function fixtureBook(ds: DataSource, w: RetrievalWiring, text: string, o: { language?: string; ops?: string[]; rights?: boolean } = {}) {
  const key = `texts/${randomUUID()}.txt`;
  const id = await insertBook(ds, { language: o.language ?? 'es', textFileKey: key });
  w.store.put(key, text);
  const hash = computeTextHash(Buffer.from(text, 'utf8'));
  w.textHash.set(id, hash);
  if (o.rights !== false) await insertRights(ds, id, { textHash: hash, permittedOperations: o.ops ?? BOTH_OPS });
  return { id, key, hash };
}

/** Replace a book's stored text (new object bytes, new current hash); optionally add a rights record for it. */
export async function replaceText(ds: DataSource, w: RetrievalWiring, book: { id: string; key: string }, text: string, o: { rights?: boolean } = {}) {
  w.store.put(book.key, text);
  const hash = computeTextHash(Buffer.from(text, 'utf8'));
  w.textHash.set(book.id, hash);
  if (o.rights !== false) await insertRights(ds, book.id, { textHash: hash, permittedOperations: BOTH_OPS });
  return hash;
}

export const chunkRows = async (ds: DataSource, bookId: string) =>
  Number((await ds.query(`SELECT count(*)::int AS n FROM ai_book_chunks WHERE "bookId" = $1`, [bookId]))[0].n);

/** Checksum of protected tables (Amendment 1: E5 neither reads nor writes them). */
export async function protectedChecksum(ds: DataSource) {
  const out: Record<string, string> = {};
  for (const t of ['fragments', 'sync_maps', 'user_books', 'book_ai_rights']) {
    const [{ md5 }] = await ds.query(`SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS md5 FROM ${t} x`);
    out[t] = md5;
  }
  return out;
}
