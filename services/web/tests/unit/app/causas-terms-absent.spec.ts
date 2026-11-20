// Regression (PO publication-boundary decision, 2026-11-18): the unfinished Causas program terms must not ship in the
// web app. The draft lives only in repository documentation, labelled NOT APPROVED / NOT IN EFFECT.
import fs from 'fs';
import path from 'path';

const WEB = path.resolve(__dirname, '../../..');
const SOURCE_DIRS = ['app', 'components', 'lib'];
const DRAFT_DOC = path.resolve(WEB, '../../docs/reports/public-site-ecosystem-20261112/causas-alignment-20261118/causas-program-terms-draft.md');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
  });
}

describe('Causas draft program terms are not published by the web app', () => {
  it('has no /causas/terms route in the app directory', () => {
    expect(fs.existsSync(path.join(WEB, 'app/causas/terms'))).toBe(false);
    expect(fs.readdirSync(path.join(WEB, 'app/causas'))).toEqual(['page.tsx']);
  });

  it('has no draft legal module', () => {
    expect(fs.existsSync(path.join(WEB, 'lib/legal/causas-program-terms-draft.ts'))).toBe(false);
  });

  it('has no link, import or reference to the draft anywhere in app, components or lib', () => {
    const offenders = SOURCE_DIRS.flatMap((d) => sourceFiles(path.join(WEB, d)))
      .filter((f) => /causas\/terms|causas-program-terms|CAUSAS_TERMS/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(WEB, f));
    expect(offenders).toEqual([]);
  });

  it('keeps the full draft in repository documentation, labelled NOT APPROVED / NOT IN EFFECT', () => {
    const doc = fs.readFileSync(DRAFT_DOC, 'utf8');
    expect(doc.split('\n').slice(0, 4).join('\n')).toMatch(/NOT APPROVED/);
    expect(doc).toMatch(/NOT IN EFFECT/);
    expect(doc).toMatch(/NO APROBADO/);
    expect(doc).toMatch(/NO VIGENTE/);
    for (const rule of [/2,22% de los ingresos netos elegibles/, /2\.22% of eligible net receipts/, /calculated and settled monthly/, /Noetia absorbs that cost/]) {
      expect(doc).toMatch(rule);
    }
  });
});
