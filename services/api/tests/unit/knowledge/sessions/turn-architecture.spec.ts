import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * NEM-024 Checkpoint B architecture evidence (F-3, additive; the NEM-023 B-1 test is unchanged): the history reader
 * token `TURN_BOOK_TEXT` stays inside the approved E6 wiring points and only exposes `BookTextPort.read`.
 */
const API = join(__dirname, '../../../..');
const SRC = join(API, 'src');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const rel = (p: string) => relative(API, p).split('\\').join('/');
const read = (p: string) => readFileSync(p, 'utf8');
const imports = (f: string) => [...read(f).matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
const all = walk(SRC);

describe('NEM-024 Checkpoint B — history reader boundary (F-3)', () => {
  it('TURN_BOOK_TEXT is referenced only by its definition (turn.service.ts) and the module binding', () => {
    expect(all.filter((f) => /TURN_BOOK_TEXT/.test(read(f))).map(rel).sort())
      .toEqual(['src/knowledge/knowledge.module.ts', 'src/knowledge/sessions/turn.service.ts']);
  });

  it('the module binds it to the existing E5 S2 adapter, by alias of the same provider (no new reader implementation)', () => {
    expect(read(join(SRC, 'knowledge/knowledge.module.ts'))).toMatch(/\{ provide: TURN_BOOK_TEXT, useExisting: StorageBookText \}/);
  });

  it('TurnService imports only the type and strict decoder from retrieval.types for it, and no storage or SDK code', () => {
    const turn = join(SRC, 'knowledge/sessions/turn.service.ts');
    expect(read(turn)).toMatch(/import \{ BookTextPort, decodeUtf8 \} from '\.\.\/retrieval\/retrieval\.types';/);
    expect(imports(turn).filter((i) => /storage|@aws-sdk|minio/i.test(i))).toEqual([]);
  });

  it('TurnService uses the reader only through BookTextPort.read, and only after re-validating rights and index permission', () => {
    const src = read(join(SRC, 'knowledge/sessions/turn.service.ts'));
    const uses = [...src.matchAll(/this\.bookText\.?(\w+)?/g)].map((m) => m[1]).filter(Boolean);
    expect([...new Set(uses)]).toEqual(['read']);
    const body = src.slice(src.indexOf('private async toViews'));
    expect(body.indexOf('this.rights.eligibility')).toBeGreaterThan(-1);
    expect(body.indexOf('this.indexPermission!.check')).toBeGreaterThan(-1);
    expect(body.indexOf('this.bookText.read')).toBeGreaterThan(body.indexOf('this.indexPermission!.check'));
  });

  it('no other sessions file imports from retrieval/ (the B-1 allow-list remains the only path)', () => {
    const sessions = walk(join(SRC, 'knowledge/sessions')).filter((f) => !f.endsWith('turn.service.ts'));
    expect(sessions.filter((f) => imports(f).some((i) => /retrieval\//.test(i))).map(rel)).toEqual([]);
  });
});
