import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/** NEM-023 §12 architecture and security checks (dark components; NEM-019 guards stay unchanged). */
const API = join(__dirname, '../../../..');
const SRC = join(API, 'src');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const rel = (p: string) => relative(API, p).split('\\').join('/');
const read = (p: string) => readFileSync(p, 'utf8');
const imports = (f: string) => [...read(f).matchAll(/from\s+'([^']+)'|require\('([^']+)'\)|import\('([^']+)'\)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
const all = walk(SRC);
const knowledge = all.filter((f) => rel(f).startsWith('src/knowledge/'));
const retrieval = knowledge.filter((f) => rel(f).startsWith('src/knowledge/retrieval/'));
const LEXICAL = ['src/knowledge/retrieval/lexical-retrieval.service.ts', 'src/knowledge/retrieval/book-indexer.service.ts'];

describe('NEM-023 architecture (§9.1, §9.2, §9.5, §9.6, §12)', () => {
  it('retrieval-technology isolation: tsvector / ts_rank / to_tsquery SQL only in the lexical implementation (and its migration)', () => {
    const tech = /\b(tsvector|ts_rank(_cd)?|websearch_to_tsquery|plainto_tsquery|to_tsquery|to_tsvector|ts_headline)\b/;
    const offenders = all.filter((f) => !rel(f).startsWith('src/migrations/') && [...read(f).matchAll(/`([^`]*)`/g)].some((m) => tech.test(m[1])));
    expect(offenders.map(rel).sort()).toEqual([...LEXICAL].sort());
  });

  it('a single computeTextHash definition; no other code builds a "sha256:" text identity', () => {
    const defs = all.filter((f) => /function\s+computeTextHash\b|computeTextHash\s*=/.test(read(f)));
    expect(defs.map(rel)).toEqual(['src/knowledge/rights/text-hash.ts']);
    const literal = knowledge.filter((f) => /['"`]sha256:['"`]/.test(read(f)));
    expect(literal.map(rel)).toEqual(['src/knowledge/rights/text-hash.ts']);
  });

  it('no turn or port wiring: nothing outside retrieval/ imports it; the module, TurnService, and ContextSourcePort are untouched', () => {
    const importers = all.filter((f) => !rel(f).startsWith('src/knowledge/retrieval/') && imports(f).some((i) => /retrieval\//.test(i)));
    expect(importers.map(rel)).toEqual([]);
    for (const f of ['knowledge/knowledge.module.ts', 'knowledge/sessions/turn.service.ts', 'knowledge/sessions/context-source.port.ts', 'app.module.ts']) {
      expect({ f, mentions: /retrieval\/|QueryContextSource|LexicalRetrieval|BookIndexer|IndexingPermission/.test(read(join(SRC, f))) }).toEqual({ f, mentions: false });
    }
    expect(read(join(SRC, 'knowledge/knowledge.module.ts'))).toMatch(/provide: CONTEXT_SOURCE_PORT, useClass: EmptyContextSource\b/);
    expect(read(join(SRC, 'knowledge/knowledge.module.ts'))).toMatch(/provide: TEXT_IDENTITY_PORT, useClass: UnboundTextIdentityPort\b/);
  });

  it('no Gateway call and no context sealing from retrieval (E6 owns turn wiring)', () => {
    expect(retrieval.filter((f) => /gateway\.invoke\(|sealContext\(|\.prepare\(/.test(read(f))).map(rel)).toEqual([]);
  });

  it('C-1: the indexer and IndexingPermission use no user identity, never call eligibility() or the ownership port', () => {
    for (const f of ['indexing-permission.ts', 'book-indexer.service.ts', 'index-command.ts'].map((x) => join(SRC, 'knowledge/retrieval', x))) {
      const s = read(f);
      expect({ f: rel(f), bad: /\.eligibility\(|OwnershipPort|OWNERSHIP_PORT|ownership\.check|userId|RightsService\b/.test(s.replace(/^\s*(\*|\/\/).*$/gm, '')) }).toEqual({ f: rel(f), bad: false });
    }
  });

  it('Amendment 1: retrieval never accesses fragments, sync_maps, user_books, or reader data, and writes only ai_book_chunks', () => {
    for (const f of retrieval) {
      const sql = [...read(f).matchAll(/`([^`]*)`/g)].map((m) => m[1]).join('\n');
      expect({ f: rel(f), bad: /\b(fragments|sync_maps|user_books|reading_progress|highlights?|notes)\b/.test(sql) }).toEqual({ f: rel(f), bad: false });
      const writes = [...sql.matchAll(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?(\w+)/gi)].map((m) => m[1]);
      expect({ f: rel(f), writes: writes.filter((t) => t !== 'ai_book_chunks') }).toEqual({ f: rel(f), writes: [] });
    }
  });

  it('privacy: no logger, console, or content in errors in retrieval/', () => {
    for (const f of retrieval) {
      const s = read(f);
      expect({ f: rel(f), logs: /\b(logger|console)\.(log|warn|error|debug|info)\(/.test(s) }).toEqual({ f: rel(f), logs: false });
      expect({ f: rel(f), leak: /new \w*Error\([^)]*(query|text|passage)\b[^)]*\)/.test(s.replace(/'[^']*'/g, "''")) }).toEqual({ f: rel(f), leak: false });
    }
  });

  it('no provider SDK, HTTP client, or fetch in retrieval/ (S2 reads go through BookTextPort → StorageService)', () => {
    const net = retrieval.filter((f) => imports(f).some((i) => /^(axios|node-fetch|undici|got|http|https|@nestjs\/axios|@aws-sdk\/.*)$/.test(i)) || /\bfetch\(/.test(read(f)));
    expect(net.map(rel)).toEqual([]);
    expect(retrieval.filter((f) => imports(f).some((i) => /storage\/storage\.service/.test(i))).map(rel).sort())
      .toEqual(['src/knowledge/retrieval/index-command.ts', 'src/knowledge/retrieval/storage-book-text.ts']);
  });

  it('S2 schema: migration 075 creates no verbatim text column and no user column on ai_book_chunks', () => {
    const m = read(join(SRC, 'migrations/1748300000075-CreateAiBookChunks.ts'));
    const table = /CREATE TABLE ai_book_chunks \(([\s\S]*?)\n\s*\)\s*`/.exec(m)![1];
    expect(table).not.toMatch(/^\s*"?(text|content|body|passage|snippet)"?\s+(text|varchar)/im);
    expect(table).not.toMatch(/"userId"|user_id/);
    expect(table).not.toMatch(/GENERATED/i);
  });
});
