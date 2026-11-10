import { DataSource } from 'typeorm';
import { codePointSlice } from '../../../src/knowledge/retrieval/chunker';
import { SEARCH_CONFIG } from '../../../src/knowledge/retrieval/book-indexer.service';
import { estimateTokens } from '../../../src/knowledge/retrieval/retrieval.types';
import { createUser, insertRights, openDataSource } from './support/it-env';
import {
  BOTH_OPS, chunkRows, EN_TEXT, ES_TEXT, fixtureBook, insertBook, protectedChecksum, replaceText, RetrievalWiring, wireRetrieval,
} from './support/retrieval-env';

/** NEM-023 Checkpoints A + B on a disposable PostgreSQL 16 (S2 text from an in-process object-store fixture). */

const MIGRATION = 'CreateAiBookChunks1748300000075';
const LAST_TS = MIGRATION.slice(-13);
const lastMigration = async (ds: DataSource) => (await ds.query(`SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1`))[0].name;
async function revertNewerThan075(ds: DataSource) {
  for (let g = 0; g < 100; g++) {
    const [last] = await ds.query(`SELECT timestamp::bigint::text AS ts FROM migrations ORDER BY timestamp DESC LIMIT 1`);
    if (BigInt(last.ts) <= BigInt(LAST_TS)) return;
    await ds.undoLastMigration({ transaction: 'each' });
  }
  throw new Error('too many migrations after 075');
}
/** Whole public schema except ai_book_chunks, plus text-search configurations and extensions. */
async function schemaOutside075(ds: DataSource) {
  const columns = await ds.query(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> 'ai_book_chunks' ORDER BY table_name, ordinal_position`);
  const constraints = await ds.query(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> 'ai_book_chunks' ORDER BY conname`);
  const indexes = await ds.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename <> 'ai_book_chunks' ORDER BY indexname`);
  return JSON.stringify({ columns, constraints, indexes });
}
const configs = async (ds: DataSource) => (await ds.query(`SELECT cfgname FROM pg_ts_config WHERE cfgname LIKE 'noetia_%' ORDER BY cfgname`)).map((r: any) => r.cfgname);
const hasUnaccent = async (ds: DataSource) => (await ds.query(`SELECT count(*)::int AS n FROM pg_extension WHERE extname = 'unaccent'`))[0].n === 1;

describe('NEM-023 Checkpoint A — schema, S2 indexing, chunking, text identity, book-level permission', () => {
  let ds: DataSource;
  let w: RetrievalWiring;
  beforeAll(async () => { ds = await openDataSource(); w = wireRetrieval(ds); });
  afterAll(async () => ds?.destroy());

  it('migration 075: additive; runs down and up by name; nothing else changes; no row seeded', async () => {
    await revertNewerThan075(ds);
    expect(await lastMigration(ds)).toBe(MIGRATION);
    const before = await schemaOutside075(ds);
    expect(await configs(ds)).toEqual(['noetia_en', 'noetia_es', 'noetia_simple']);
    await ds.undoLastMigration({ transaction: 'each' });
    expect(await lastMigration(ds)).toBe('AddCompensationAdjustmentKey1748300000074');
    expect(await ds.query(`SELECT to_regclass('ai_book_chunks') AS t`)).toEqual([{ t: null }]);
    expect(await configs(ds)).toEqual([]);
    expect(await hasUnaccent(ds)).toBe(false);
    expect(await schemaOutside075(ds)).toBe(before);
    await ds.runMigrations({ transaction: 'each' });
    await revertNewerThan075(ds);
    expect(await lastMigration(ds)).toBe(MIGRATION);
    expect(await schemaOutside075(ds)).toBe(before);
    expect(Number((await ds.query(`SELECT count(*) FROM ai_book_chunks`))[0].count)).toBe(0);
    await ds.runMigrations({ transaction: 'each' });
    expect(await ds.showMigrations()).toBe(false);
  });

  it('S2 schema: no verbatim text column, no user column; constraints; one partial GIN per language; FK cascades from books', async () => {
    const cols = (await ds.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'ai_book_chunks' ORDER BY ordinal_position`));
    expect(cols.map((c: any) => c.column_name)).toEqual(['id', 'bookId', 'textHash', 'chunkIndex', 'charStart', 'charEnd', 'phraseIndexStart', 'phraseIndexEnd', 'chapterLabel', 'language', 'tsv', 'createdAt']);
    expect(cols.filter((c: any) => c.data_type === 'text')).toEqual([]);
    expect(cols.filter((c: any) => c.is_nullable === 'YES').map((c: any) => c.column_name)).toEqual(['phraseIndexStart', 'phraseIndexEnd', 'chapterLabel']);
    const idx = await ds.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ai_book_chunks' ORDER BY indexname`);
    for (const l of ['es', 'en', 'simple']) {
      expect(idx.find((i: any) => i.indexname === `IDX_ai_book_chunks_tsv_${l}`).indexdef).toMatch(new RegExp(`USING gin \\(tsv\\) WHERE \\(\\(language\\)::text = '${l}'::text\\)`));
    }
    expect(idx.find((i: any) => i.indexname === 'UQ_ai_book_chunks_set_index').indexdef).toMatch(/\("bookId", "textHash", "chunkIndex"\)/);
    const [fk] = await ds.query(`SELECT confrelid::regclass::text AS target, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'ai_book_chunks'::regclass AND contype = 'f'`);
    expect(fk).toEqual({ target: 'books', def: expect.stringMatching(/ON DELETE CASCADE/) });
    const b = await insertBook(ds);
    const bad = (sql: string) => expect(ds.query(sql, [b])).rejects.toThrow();
    await bad(`INSERT INTO ai_book_chunks ("bookId","textHash","chunkIndex","charStart","charEnd",language,tsv) VALUES ($1,'sha256:${'a'.repeat(64)}',0,5,5,'es','')`);
    await bad(`INSERT INTO ai_book_chunks ("bookId","textHash","chunkIndex","charStart","charEnd",language,tsv) VALUES ($1,'sha256:${'a'.repeat(64)}',0,0,5,'fr','')`);
    await bad(`INSERT INTO ai_book_chunks ("bookId","textHash","chunkIndex","charStart","charEnd",language,tsv) VALUES ($1,'not-a-hash',0,0,5,'es','')`);
    await bad(`INSERT INTO ai_book_chunks ("bookId","textHash","chunkIndex","charStart","charEnd",language,tsv,"phraseIndexStart") VALUES ($1,'sha256:${'a'.repeat(64)}',0,0,5,'es','',1)`);
  });

  it('unaccent is a trusted extension a non-superuser database owner can create', async () => {
    expect(await ds.query(`SELECT trusted FROM pg_available_extension_versions WHERE name = 'unaccent' LIMIT 1`)).toEqual([{ trusted: true }]);
    await ds.query(`DROP DATABASE IF EXISTS nem023_owner_test`);
    await ds.query(`DROP ROLE IF EXISTS nem023_owner`);
    await ds.query(`CREATE ROLE nem023_owner LOGIN PASSWORD 'test' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
    await ds.query(`CREATE DATABASE nem023_owner_test OWNER nem023_owner`);
    const owner = new DataSource({ type: 'postgres', host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: 'nem023_owner_test', username: 'nem023_owner', password: 'test' });
    await owner.initialize();
    try {
      expect(await owner.query(`SELECT rolsuper FROM pg_roles WHERE rolname = current_user`)).toEqual([{ rolsuper: false }]);
      await owner.query(`CREATE EXTENSION unaccent`);
      expect(await owner.query(`SELECT unaccent('canción niño') AS u`)).toEqual([{ u: 'cancion nino' }]);
    } finally {
      await owner.destroy();
      await ds.query(`DROP DATABASE nem023_owner_test`);
      await ds.query(`DROP ROLE nem023_owner`);
    }
  });

  it('§9.3 lexemes: accent folding (beyond core configs), stemming, stop words; simple folds without stemming', async () => {
    const v = async (cfg: string, t: string) => (await ds.query(`SELECT to_tsvector($1::regconfig, $2)::text AS v`, [cfg, t]))[0].v;
    const m = async (cfg: string, doc: string, q: string) => (await ds.query(`SELECT to_tsvector($1::regconfig, $2) @@ websearch_to_tsquery($1::regconfig, $3) AS m`, [cfg, doc, q]))[0].m;
    expect(await v('noetia_es', 'niño')).toBe(await v('noetia_es', 'nino'));
    expect(await v('spanish', 'niño')).not.toBe(await v('spanish', 'nino')); // what unaccent adds
    expect(await v('noetia_en', 'café')).toBe(await v('noetia_en', 'cafe'));
    expect(await v('english', 'café')).not.toBe(await v('english', 'cafe'));
    expect(await v('noetia_es', 'el de la que y')).toBe('');
    expect(await v('noetia_en', 'the of and to were')).toBe('');
    expect(await m('noetia_es', 'las canciones antiguas', 'CANCIÓN antigua')).toBe(true);
    expect(await m('noetia_es', 'corrían hacia la fuente', 'corrian')).toBe(true);
    expect(await m('noetia_en', 'children were running quickly', 'run quick')).toBe(true);
    expect(await v('noetia_simple', 'Çà Ñandú running')).toBe("'ca':1 'nandu':2 'running':3");
  });

  it('indexes a permitted book: stored tsv equals to_tsvector(config, MinIO chunk text); metadata NULL; offsets exact; idempotent', async () => {
    const book = await fixtureBook(ds, w, ES_TEXT);
    const r = await w.indexer.indexBook(book.id);
    expect(r).toMatchObject({ outcome: 'indexed', textHash: book.hash });
    const rows = await ds.query(`SELECT "chunkIndex", "charStart", "charEnd", language, "chapterLabel", "phraseIndexStart", "phraseIndexEnd", "textHash", tsv::text AS tsv FROM ai_book_chunks WHERE "bookId" = $1 ORDER BY "chunkIndex"`, [book.id]);
    expect(rows.length).toBe(r.chunks);
    expect(rows.length).toBeGreaterThan(2);
    for (const row of rows) {
      const text = codePointSlice(ES_TEXT, row.charStart, row.charEnd);
      expect(text).toBe(text.trim());
      const [{ v }] = await ds.query(`SELECT to_tsvector('noetia_es'::regconfig, $1)::text AS v`, [text]);
      expect(row.tsv).toBe(v);
      expect(row).toMatchObject({ language: 'es', chapterLabel: null, phraseIndexStart: null, phraseIndexEnd: null, textHash: book.hash });
    }
    expect(await w.indexer.indexBook(book.id)).toMatchObject({ outcome: 'exists' });
    expect(await chunkRows(ds, book.id)).toBe(rows.length);
  });

  it.each<[string, { ops?: string[]; over?: Record<string, unknown>; unbound?: boolean; unattested?: boolean }, string]>([
    ['unbound text identity', { unbound: true }, 'text_identity_unknown'],
    ['research_analysis only', { ops: ['research_analysis'] }, 'operation_not_permitted'],
    ['not attested', { unattested: true }, 'not_attested'],
    ['pending_review record', { over: { status: 'pending_review' } }, 'not_verified'],
    ['incomplete record', { over: { edition: null } }, 'incomplete_record'],
    ['review expired', { over: { reviewDate: '2026-02-01' } }, 'review_expired'],
  ])('default deny (%s): no chunks are created', async (_l, o, reason) => {
    const book = await fixtureBook(ds, w, ES_TEXT, { rights: false });
    await insertRights(ds, book.id, { textHash: book.hash, permittedOperations: o.ops ?? BOTH_OPS, ...o.over });
    if (o.unbound) w.textHash.delete(book.id);
    if (o.unattested) w.unattested.add(book.id);
    expect(await w.indexer.indexBook(book.id)).toMatchObject({ outcome: 'skipped_scope', reason });
    expect(await chunkRows(ds, book.id)).toBe(0);
  });

  it('scope and identity: unpublished / no text skipped; object bytes ≠ permitted hash → skipped; nothing written', async () => {
    const unpub = await insertBook(ds, { isPublished: false });
    expect(await w.indexer.indexBook(unpub)).toMatchObject({ outcome: 'skipped_scope', reason: 'not_published' });
    const notext = await insertBook(ds, { textFileKey: null });
    expect(await w.indexer.indexBook(notext)).toMatchObject({ outcome: 'skipped_scope', reason: 'no_stored_text' });
    const book = await fixtureBook(ds, w, ES_TEXT);
    w.store.put(book.key, `${ES_TEXT}\nEdited after verification.`);
    expect(await w.indexer.indexBook(book.id)).toMatchObject({ outcome: 'skipped_scope', reason: 'hash_mismatch' });
    expect(await chunkRows(ds, book.id)).toBe(0);
  });

  it('limits fail closed: chunks per book; index size budget (checked after the insert → rollback, no partial set)', async () => {
    const tight = wireRetrieval(ds, { maxChunksPerBook: 2 });
    const a = await fixtureBook(ds, tight, ES_TEXT);
    expect(await tight.indexer.indexBook(a.id)).toMatchObject({ outcome: 'skipped_limit', reason: 'too_many_chunks' });
    expect(await chunkRows(ds, a.id)).toBe(0);
    const [{ size }] = await ds.query(`SELECT pg_total_relation_size('ai_book_chunks')::bigint AS size`);
    const small = wireRetrieval(ds, { maxIndexBytes: Number(size) + 1 });
    const b = await fixtureBook(ds, small, ES_TEXT.repeat(30));
    expect(await small.indexer.indexBook(b.id)).toMatchObject({ outcome: 'skipped_limit', reason: 'index_size_budget' });
    expect(await chunkRows(ds, b.id)).toBe(0);
  });

  it('crash safety: a failure inside the indexing transaction leaves no partial set', async () => {
    const book = await fixtureBook(ds, w, ES_TEXT);
    const real = w.db.transaction.bind(w.db);
    const spy = jest.spyOn(w.db, 'transaction').mockImplementation(((fn: any) => real(async (m: any) => {
      await fn(m); // the full INSERT runs …
      throw new Error('simulated crash before commit');
    })) as any);
    await expect(w.indexer.indexBook(book.id)).rejects.toThrow('simulated crash');
    spy.mockRestore();
    expect(await chunkRows(ds, book.id)).toBe(0);
    expect(await w.indexer.indexBook(book.id)).toMatchObject({ outcome: 'indexed' }); // resumable
  });

  it('retention (D-7): current + ≤ 1 previous set; prune after the grace window; 30-day hard cap; purge removes all; delete cascades', async () => {
    const book = await fixtureBook(ds, w, ES_TEXT);
    await w.indexer.indexBook(book.id);
    const v2 = await replaceText(ds, w, book, `${ES_TEXT}\n\nSegunda edición.`);
    expect(await w.indexer.indexBook(book.id)).toMatchObject({ outcome: 'indexed', textHash: v2 });
    await replaceText(ds, w, book, `${ES_TEXT}\n\nTercera edición.`);
    expect(await w.indexer.indexBook(book.id)).toMatchObject({ outcome: 'skipped_limit', reason: 'retention_previous_set_pending' });
    const sets = async () => (await ds.query(`SELECT DISTINCT "textHash" FROM ai_book_chunks WHERE "bookId" = $1`, [book.id])).map((r: any) => r.textHash).sort();
    expect((await sets()).length).toBe(2);
    const [{ created }] = await ds.query(`SELECT max("createdAt") AS created FROM ai_book_chunks WHERE "bookId" = $1`, [book.id]);
    const at = (h: number) => new Date(new Date(created).getTime() + h * 3600_000);
    expect((await w.indexer.prune(at(23))).sets).toBe(0); // within the 24 h in-flight window
    expect(await sets()).toHaveLength(2);
    const longGrace = wireRetrieval(ds, { previousSetGraceHours: 100_000 });
    expect((await longGrace.indexer.prune(at(29 * 24))).sets).toBe(0);
    expect((await longGrace.indexer.prune(at(30 * 24 + 1))).sets).toBeGreaterThanOrEqual(1); // hard cap, not configurable
    expect(await sets()).toEqual([v2]); // the newest (current) set is never pruned
    expect(await w.indexer.purge(book.id)).toEqual({ sets: 1, rows: expect.any(Number) });
    expect(await chunkRows(ds, book.id)).toBe(0);
    const c = await fixtureBook(ds, w, EN_TEXT, { language: 'en' });
    await w.indexer.indexBook(c.id);
    await ds.query(`DELETE FROM book_ai_rights WHERE "bookId" = $1`, [c.id]);
    await ds.query(`DELETE FROM books WHERE id = $1`, [c.id]);
    expect(await chunkRows(ds, c.id)).toBe(0);
  });

  it('indexAll is sequential and resumable; it never writes sync maps, fragments, user_books, or rights records', async () => {
    const user = await createUser(ds);
    const book = await fixtureBook(ds, w, ES_TEXT);
    await ds.query(`INSERT INTO fragments ("userId", "bookId", text, note) VALUES ($1, $2, 'un fragmento inventado', 'una nota')`, [user, book.id]);
    await ds.query(`INSERT INTO sync_maps ("bookId", phrases) VALUES ($1, '[{"text":"x","start":0,"end":1}]')`, [book.id]);
    const before = await protectedChecksum(ds);
    const t1 = await w.indexer.indexAll();
    const t2 = await w.indexer.indexAll();
    expect(t1.indexed).toBeGreaterThanOrEqual(1);
    expect(t2.indexed).toBe(0); // resumable: every set already exists or is out of scope
    expect(await protectedChecksum(ds)).toEqual(before);
  });

  it('search configuration per language is used for stored tsv', async () => {
    const en = await fixtureBook(ds, w, EN_TEXT, { language: 'en-GB' });
    const fr = await fixtureBook(ds, w, 'Le café était fermé. Les enfants couraient vers la plage.', { language: 'fr' });
    await w.indexer.indexBook(en.id);
    await w.indexer.indexBook(fr.id);
    expect((await ds.query(`SELECT DISTINCT language FROM ai_book_chunks WHERE "bookId" = $1`, [en.id]))).toEqual([{ language: 'en' }]);
    const [row] = await ds.query(`SELECT language, "charStart", "charEnd", tsv::text AS tsv FROM ai_book_chunks WHERE "bookId" = $1 ORDER BY "chunkIndex" LIMIT 1`, [fr.id]);
    expect(row.language).toBe('simple');
    expect(row.tsv).toBe((await ds.query(`SELECT to_tsvector('${SEARCH_CONFIG.simple}'::regconfig, $1)::text AS v`, [codePointSlice('Le café était fermé. Les enfants couraient vers la plage.', row.charStart, row.charEnd)]))[0].v);
  });
});

describe('NEM-023 Checkpoint B — retrieval, SQL-level authorization, citations, revocation, budgets', () => {
  let ds: DataSource;
  let w: RetrievalWiring;
  let es: { id: string; key: string; hash: string };
  let en: { id: string; key: string; hash: string };
  let other: { id: string; key: string; hash: string };
  let user: string;
  beforeAll(async () => {
    ds = await openDataSource();
    w = wireRetrieval(ds);
    es = await fixtureBook(ds, w, ES_TEXT);
    en = await fixtureBook(ds, w, EN_TEXT, { language: 'en' });
    other = await fixtureBook(ds, w, `${ES_TEXT}\n\nOtro libro inventado con el mismo faro y la misma canción.`);
    for (const b of [es, en, other]) expect(await w.indexer.indexBook(b.id)).toMatchObject({ outcome: 'indexed' });
    user = await createUser(ds);
  });
  afterAll(async () => ds?.destroy());

  it('AC-1: only chunks of the allowed (bookId, textHash) pairs are returned, proven at SQL level', async () => {
    const r = await w.retrieval.retrieve({ allowed: [{ bookId: es.id, textHash: es.hash }], query: 'faro canción', topK: 20, budgetTokens: 8000 });
    expect(r.passages.length).toBeGreaterThan(0);
    expect(new Set(r.passages.map((p) => p.bookId))).toEqual(new Set([es.id]));
    // `other` contains the same words but is not allowed: never returned. A wrong hash for an allowed book returns nothing.
    const wrong = await w.retrieval.retrieve({ allowed: [{ bookId: other.id, textHash: es.hash }], query: 'faro', topK: 20, budgetTokens: 8000 });
    expect(wrong.passages).toEqual([]);
    expect(wrong.excluded.stale).toEqual([other.id]);
    // SQL-level proof: the ranking query itself (captured) yields only allowed pairs, before any post-processing.
    const spy = jest.spyOn(w.db, 'transaction');
    await w.retrieval.retrieve({ allowed: [{ bookId: es.id, textHash: es.hash }], query: 'faro', topK: 20, budgetTokens: 8000 });
    const rows = await spy.mock.results[0].value;
    spy.mockRestore();
    expect(rows.rows.every((x: any) => x.bookId === es.id && x.textHash === es.hash)).toBe(true);
  });

  it('AC-1 adversarial: SQL-meta and tsquery syntax in the query never error, leak, or widen scope', async () => {
    for (const q of [`'); DELETE FROM ai_book_chunks; --`, `faro | canción & !niño`, `"faro" OR 1=1`, `\\x00 %_ *`, `faro:* <-> mar`, `${'faro '.repeat(99)}`]) {
      const r = await w.retrieval.retrieve({ allowed: [{ bookId: en.id, textHash: en.hash }], query: q, topK: 20, budgetTokens: 8000 });
      expect(r.passages.every((p) => p.bookId === en.id)).toBe(true);
    }
    expect(await chunkRows(ds, es.id)).toBeGreaterThan(0);
  });

  it('AC-6 anchors: every passage equals codePointSlice(source, charStart, charEnd); the resolver returns the anchor while current', async () => {
    const r = await w.retrieval.retrieve({ allowed: [{ bookId: es.id, textHash: es.hash }, { bookId: en.id, textHash: en.hash }], query: 'maps or mapas or Madrid', topK: 20, budgetTokens: 8000 });
    expect(r.passages.length).toBeGreaterThan(1);
    for (const p of r.passages) {
      expect(p.text).toBe(codePointSlice(p.bookId === es.id ? ES_TEXT : EN_TEXT, p.charStart, p.charEnd));
      expect(await w.anchors.resolve(p.ref)).toEqual({ bookId: p.bookId, textHash: p.textHash, charStart: p.charStart, charEnd: p.charEnd, chapterLabel: null, phraseRange: null, anchor: `${p.textHash}:${p.charStart}-${p.charEnd}` });
    }
  });

  it('AC-7: accent-insensitive Spanish and English matching, stemming; ranking deterministic', async () => {
    const q = async (bookId: string, textHash: string, query: string) => (await w.retrieval.retrieve({ allowed: [{ bookId, textHash }], query, topK: 20, budgetTokens: 8000 })).passages;
    expect((await q(es.id, es.hash, 'NINO CANCION')).length).toBeGreaterThan(0);
    expect((await q(es.id, es.hash, 'corrian')).length).toBeGreaterThan(0);
    expect((await q(en.id, en.hash, 'cafe run')).length).toBeGreaterThan(0);
    const a = await q(es.id, es.hash, 'faro mapas');
    const b = await q(es.id, es.hash, 'faro mapas');
    expect(a.map((p) => [p.ref, p.rank])).toEqual(b.map((p) => [p.ref, p.rank]));
    for (let i = 1; i < a.length; i++) expect(a[i - 1].rank >= a[i].rank).toBe(true);
  });

  it('websearch semantics (documented): bare terms are ANDed; "or" widens; quotes require a phrase', async () => {
    const r = (query: string) => w.retrieval.retrieve({ allowed: [{ bookId: es.id, textHash: es.hash }, { bookId: en.id, textHash: en.hash }], query, topK: 20, budgetTokens: 8000 });
    expect((await r('mapas lighthouse')).passages).toEqual([]); // no single chunk holds both
    const either = (await r('mapas or lighthouse')).passages;
    expect(new Set(either.map((p) => p.bookId))).toEqual(new Set([es.id, en.id]));
    expect((await r('"canción antigua"')).passages.length).toBeGreaterThan(0);
    expect((await r('"antigua canción"')).passages).toEqual([]);
  });

  it('AC-7 cross-language limitation (documented): a Spanish query over an English book matches only shared tokens', async () => {
    const r = (query: string) => w.retrieval.retrieve({ allowed: [{ bookId: en.id, textHash: en.hash }], query, topK: 20, budgetTokens: 8000 });
    expect((await r('faro biblioteca canción')).passages).toEqual([]); // ES words for lighthouse/library/song: no match
    expect((await r('Madrid')).passages.length).toBeGreaterThan(0); // a shared token matches
  });

  it('AC-2 stale never served: after a text replacement the old set is excluded and old refs do not resolve', async () => {
    const s = await fixtureBook(ds, w, `${EN_TEXT}\n\nAn appendix about the harbour.`, { language: 'en' });
    await w.indexer.indexBook(s.id);
    const [old] = (await w.qcs.resolve(user, [s.id], 'lighthouse')).passages;
    expect(old).toBeDefined();
    await replaceText(ds, w, s, `${EN_TEXT}\n\nA revised appendix.`);
    const after = await w.qcs.resolve(user, [s.id], 'lighthouse');
    expect(after.items).toEqual([]);
    expect(after.excluded.stale).toEqual([s.id]);
    expect(await w.anchors.resolve(old.ref)).toBeNull();
    // A caller passing the OLD hash cannot get passages either: the MinIO object no longer matches it (S2).
    const direct = await w.retrieval.retrieve({ allowed: [{ bookId: s.id, textHash: old.textHash }], query: 'lighthouse', topK: 5, budgetTokens: 8000 });
    expect(direct.passages).toEqual([]);
    expect(direct.excluded.stale).toEqual([s.id]);
  });

  it('AC-3 hash authority: rewriting chunk rows cannot make an unpermitted book retrievable', async () => {
    const s = await fixtureBook(ds, w, ES_TEXT);
    await w.indexer.indexBook(s.id);
    const v2 = await replaceText(ds, w, s, `${ES_TEXT}\n\nNueva versión sin derechos.`, { rights: false });
    await ds.query(`UPDATE ai_book_chunks SET "textHash" = $2 WHERE "bookId" = $1`, [s.id, v2]); // tampered rows claim the current hash
    const out = await w.qcs.resolve(user, [s.id], 'faro');
    expect(out.items).toEqual([]);
    expect(out.excluded.indexNotPermitted).toEqual([s.id]);
  });

  it('AC-11 S2 fail closed: an object-store fault or a hash mismatch returns nothing for that book', async () => {
    w.store.failing.add(es.key);
    try {
      const r = await w.retrieval.retrieve({ allowed: [{ bookId: es.id, textHash: es.hash }, { bookId: en.id, textHash: en.hash }], query: 'Madrid', topK: 20, budgetTokens: 8000 });
      expect(r.passages.every((p) => p.bookId === en.id)).toBe(true);
      expect(r.excluded.unavailable).toEqual([es.id]);
    } finally {
      w.store.failing.delete(es.key);
    }
  });

  it('AC-4 / D-7 revocation: retrieval returns nothing immediately (chunks still present); purge then removes every row', async () => {
    const s = await fixtureBook(ds, w, ES_TEXT);
    await w.indexer.indexBook(s.id);
    expect((await w.qcs.candidatesFor(user, [s.id], 'faro')).length).toBeGreaterThan(0);
    await ds.query(`UPDATE book_ai_rights SET status = 'revoked' WHERE "bookId" = $1`, [s.id]);
    expect(await chunkRows(ds, s.id)).toBeGreaterThan(0);
    const out = await w.qcs.resolve(user, [s.id], 'faro');
    expect(out.items).toEqual([]);
    expect(out.excluded.indexNotPermitted).toEqual([s.id]);
    await w.indexer.purge(s.id);
    expect(await chunkRows(ds, s.id)).toBe(0);
  });

  it('AC-4 two authorizations: index-only books are never returned to users; research-only books are reported, not indexed', async () => {
    const idxOnly = await fixtureBook(ds, w, ES_TEXT, { ops: ['retrieval_indexing'] });
    expect(await w.indexer.indexBook(idxOnly.id)).toMatchObject({ outcome: 'indexed' });
    expect(await w.rights.eligibility(user, idxOnly.id, 'research_analysis')).toEqual({ eligible: false, reason: 'operation_not_permitted' });
    const researchOnly = await fixtureBook(ds, w, ES_TEXT, { ops: ['research_analysis'] });
    expect(await w.indexer.indexBook(researchOnly.id)).toMatchObject({ outcome: 'skipped_scope', reason: 'operation_not_permitted' });
    expect((await w.rights.eligibility(user, researchOnly.id, 'research_analysis')).eligible).toBe(true);
    const out = await w.qcs.resolve(user, [researchOnly.id], 'faro');
    expect(out.items).toEqual([]);
    expect(out.excluded.indexNotPermitted).toEqual([researchOnly.id]);
  });

  it('AC-9 budgets: the passage token total never exceeds the budget; smaller budgets truncate', async () => {
    for (const budget of [1, 40, 200, 8000]) {
      const r = await w.retrieval.retrieve({ allowed: [{ bookId: es.id, textHash: es.hash }, { bookId: en.id, textHash: en.hash }], query: 'faro or mapas or Madrid or lighthouse or maps', topK: 20, budgetTokens: budget });
      const total = r.passages.reduce((n, p) => n + estimateTokens(p.text), 0);
      expect(total).toBeLessThanOrEqual(budget);
      if (budget === 1) expect(r.truncated).toBe(true);
    }
  });

  it('AC-5 (Amendment 1): results carry no user content; protected tables are unchanged by retrieval', async () => {
    const before = await protectedChecksum(ds);
    const items = await w.qcs.candidatesFor(user, [es.id, en.id], 'faro or lighthouse');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.kind === 'chunk' && i.userId === undefined)).toBe(true);
    expect(await protectedChecksum(ds)).toEqual(before);
  });

  it('§9.3: the partial GIN indexes are usable by the ranking query (EXPLAIN, per language)', async () => {
    await ds.query('ANALYZE ai_book_chunks');
    for (const [lang, cfg] of [['es', 'noetia_es'], ['en', 'noetia_en']]) {
      const plan = (await ds.query(`EXPLAIN SELECT id FROM ai_book_chunks c WHERE c.language = '${lang}' AND c.tsv @@ websearch_to_tsquery('${cfg}'::regconfig, 'faro')`)).map((r: any) => r['QUERY PLAN']).join('\n');
      // With few rows the planner may still prefer a seq scan; force the comparison so the index is proven usable.
      const forced = (await ds.transaction(async (m) => {
        await m.query('SET LOCAL enable_seqscan = off');
        return m.query(`EXPLAIN SELECT id FROM ai_book_chunks c WHERE c.language = '${lang}' AND c.tsv @@ websearch_to_tsquery('${cfg}'::regconfig, 'faro')`);
      })).map((r: any) => r['QUERY PLAN']).join('\n');
      expect(`${plan}\n${forced}`).toMatch(new RegExp(`IDX_ai_book_chunks_tsv_${lang}`));
    }
  });
});
