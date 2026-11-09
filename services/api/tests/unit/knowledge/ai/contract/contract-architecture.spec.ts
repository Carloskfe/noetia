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

  it('declares a version policy and schema version 1', () => {
    const v = readFileSync(join(CONTRACT, 'version.ts'), 'utf8');
    expect(v).toMatch(/CONTRACT_VERSION = '1\.0\.0'/);
    expect(v).toMatch(/SCHEMA_VERSION = 1 as const/);
  });
});
