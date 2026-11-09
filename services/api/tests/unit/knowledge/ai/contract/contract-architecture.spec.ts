import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

const API = join(__dirname, '../../../../..');
const KNOWLEDGE = join(API, 'src/knowledge');
const CONTRACT = join(KNOWLEDGE, 'ai/contract');

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
});
const rel = (p: string) => relative(API, p).split('\\').join('/');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
/** Remove string literals so version strings or section numbers in messages are not mistaken for arithmetic. */
const stripStrings = (s: string) => s.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
const imports = (file: string) => [...readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'|require\('([^']+)'\)/g)].map((m) => m[1] ?? m[2]);
const contractFiles = walk(CONTRACT);

describe('NEM-021 contract v1 architecture', () => {
  it('lives in one module and imports nothing outside it (no services, framework, network, or SDK)', () => {
    const offenders = contractFiles.flatMap((f) => imports(f)
      .filter((i) => !i.startsWith('.') || !resolve(dirname(f), i).startsWith(CONTRACT))
      .map((i) => `${rel(f)} → ${i}`));
    expect(offenders).toEqual([]);
  });

  it('uses no floating-point operations on money or tokens (§9.2)', () => {
    const forbidden = /\bparseFloat\b|\.toFixed\(|\bMath\.(round|floor|ceil|pow|trunc)\b|\b\d+\.\d+\b/;
    const offenders = contractFiles.filter((f) => forbidden.test(stripStrings(stripComments(readFileSync(f, 'utf8'))))).map(rel);
    // Self-test: the scanner does catch float arithmetic.
    expect(forbidden.test(stripStrings('const x = price * 1.25;'))).toBe(true);
    expect(forbidden.test(stripStrings("const v = '1.0.0';"))).toBe(false);
    expect(offenders).toEqual([]);
  });

  it('no file outside the contract redefines a contract schema or implements pricing', () => {
    const types = /\b(?:interface|type|class|enum)\s+(CapabilityDescriptor|NormalizedUsage|TokenCounts|PricingSchema|UnitWeightSchema|RateTable|AttemptBounds|CacheIntent|AttemptOutcome|ErrorCategory|UsageCompleteness|ZeroUsageEvidence|OutcomeRule|LedgerAction|NoChargeDeclaration)\b/;
    const fns = /\bfunction\s+(priceUsage|worstCaseCost|worstCaseUnits|unitsForUsage|ledgerActionFor|selectTier|exactUsageSum|exactWorstCaseSum)\b/;
    const offenders = walk(KNOWLEDGE)
      .filter((f) => !f.startsWith(CONTRACT))
      .filter((f) => { const s = stripComments(readFileSync(f, 'utf8')); return types.test(s) || fns.test(s); })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('fixtures are marked as fixtures and carry no verification date (never real prices)', () => {
    for (const f of readdirSync(join(CONTRACT, 'fixtures')).filter((x) => x.startsWith('pricing-') || x.startsWith('unit-weights'))) {
      const j = JSON.parse(readFileSync(join(CONTRACT, 'fixtures', f), 'utf8'));
      expect({ f, isTestFixture: j.isTestFixture }).toEqual({ f, isTestFixture: true });
      if ('verifiedAt' in j) expect(j.verifiedAt).toBeNull();
    }
  });

  it('Phase 1 adds no migration and touches no NEM-019 runtime file (contract is not yet wired in)', () => {
    const migrations = readdirSync(join(API, 'src/migrations')).filter((m) => /^17483000000(7[3-9]|[89]\d)/.test(m));
    expect(migrations).toEqual([]);
    const users = walk(KNOWLEDGE).filter((f) => !f.startsWith(CONTRACT) && imports(f).some((i) => /ai\/contract|\.\/contract/.test(i))).map(rel);
    expect(users).toEqual([]);
  });

  describe('F-7 — only the designated validators can register configuration as validated', () => {
    const VALIDATED = join(CONTRACT, 'validated.ts');
    const src = stripComments(readFileSync(VALIDATED, 'utf8'));
    const sealers = [join(CONTRACT, 'capability.ts'), join(CONTRACT, 'pricing.ts'), join(CONTRACT, 'unit-weights.ts')];

    it('validated.ts exports no sealing primitive: only validateAndSeal (validates first), requireValidated, isValidated', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(VALIDATED);
      expect(Object.keys(mod).filter((k) => typeof mod[k] === 'function').sort()).toEqual(['isValidated', 'requireValidated', 'validateAndSeal']);
      expect(src).not.toMatch(/export\s+(?:function|const|let|var|class)\s+(?:seal|sealValidated|registry)\b/);
      expect(src).not.toMatch(/export\s*\{[^}]*\b(?:seal|sealValidated|registry)\b/);
    });

    it('the registry is written in exactly one place: the private seal(), reached only after the kind\'s own validator', () => {
      const writes = contractFiles.flatMap((f) => [...stripComments(readFileSync(f, 'utf8')).matchAll(/\bregistry\.set\(/g)].map(() => rel(f)));
      expect(writes).toEqual([rel(VALIDATED)]);
      expect(src).toMatch(/^const registry = new WeakMap/m);              // module-private, not exported
      const seal = src.slice(src.indexOf('function seal<'));
      expect(seal).toContain('registry.set(');
      expect([...src.matchAll(/\bfunction seal\b/g)]).toHaveLength(1);   // one definition, not exported
      expect([...src.matchAll(/\bseal\(/g)]).toHaveLength(1);           // exactly one call site
      const vas = src.slice(src.indexOf('export function validateAndSeal'), src.indexOf('function seal<'));
      expect(vas.indexOf('validate(value)')).toBeGreaterThan(-1);
      expect(vas.indexOf('validate(value)')).toBeLessThan(vas.indexOf('seal('));  // validation precedes sealing
      expect(vas).toMatch(/if \(!r\.ok\) throw/);
    });

    it('validateAndSeal is called only by the three assert* validators; nothing else in src imports validated.ts', () => {
      const allSrc = walk(join(API, 'src'));
      const callers = allSrc.filter((f) => f !== VALIDATED && /\bvalidateAndSeal\(/.test(stripComments(readFileSync(f, 'utf8')))).map(rel).sort();
      expect(callers).toEqual(sealers.map(rel).sort());
      for (const f of sealers) {
        const calls = [...stripComments(readFileSync(f, 'utf8')).matchAll(/export function (assert\w+)\(v: unknown\)[^{]*\{\s*return validateAndSeal\(/g)];
        expect(calls).toHaveLength(1);
      }
      const importers = allSrc.filter((f) => f !== VALIDATED && imports(f).some((i) => /(^|\/)validated$/.test(i))).map(rel).sort();
      expect(importers).toEqual([...sealers, join(CONTRACT, 'index.ts')].map(rel).sort());
      // The public entry point exposes the checks, never the sealing path.
      const index = stripComments(readFileSync(join(CONTRACT, 'index.ts'), 'utf8'));
      expect(index).not.toMatch(/validateAndSeal|\bseal\b|export \* from '\.\/validated'/);
    });
  });

  it('declares a version policy and schema version 1', () => {
    const v = readFileSync(join(CONTRACT, 'version.ts'), 'utf8');
    expect(v).toMatch(/CONTRACT_VERSION = '1\.0\.0'/);
    expect(v).toMatch(/SCHEMA_VERSION = 1 as const/);
  });
});
