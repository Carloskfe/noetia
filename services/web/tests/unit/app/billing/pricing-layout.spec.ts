import * as fs from 'fs';
import * as path from 'path';
import { metadata } from '@/app/(billing)/pricing/layout';

const WEB_ROOT = path.resolve(__dirname, '../../../..');

describe('pricing page metadata', () => {
  const texts = [
    String(metadata.description ?? ''),
    String(metadata.openGraph?.description ?? ''),
    String(metadata.title ?? ''),
    String(metadata.openGraph?.title ?? ''),
  ];

  it('is price-neutral so it cannot drift from the plans table', () => {
    for (const text of texts) {
      expect(text).not.toMatch(/\$\s?\d/);
      expect(text).not.toMatch(/\/\s?(mes|mo|month)\b/i);
    }
  });

  it('uses the approved Spanish plan names', () => {
    expect(metadata.description).toContain('Individual, Dúo y Familia');
    expect(texts.join(' ')).not.toMatch(/Dual Reader/);
  });
});

describe('customer-facing web source', () => {
  // Retired subscription prices and the legacy plan name must not reappear in
  // shipped UI copy, metadata or legal text. lib/plan-display.ts is excluded
  // because it intentionally recognises the legacy internal name.
  const STALE = [/9[.,]99\s*\/\s*(mes|mo)\b/, /\b(80|125|170)[.,]99\b/, /\b89[.,]00\b/, /\b135[.,]00\b/, /Dual Reader/];
  const ROOTS = ['app', 'components', 'lib'];
  const EXCLUDE = new Set([path.join('lib', 'plan-display.ts')]);

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(path.join(WEB_ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(rel);
      return /\.(ts|tsx)$/.test(entry.name) && !EXCLUDE.has(rel) ? [rel] : [];
    });
  }

  it('contains no retired subscription prices or legacy plan names', () => {
    const offenders = ROOTS.flatMap(sourceFiles).flatMap((rel) => {
      const text = fs.readFileSync(path.join(WEB_ROOT, rel), 'utf8');
      return STALE.filter((re) => re.test(text)).map((re) => `${rel}: ${re}`);
    });
    expect(offenders).toEqual([]);
  });
});
