import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

const API = join(__dirname, '../../../../..');
const KNOWLEDGE = join(API, 'src/knowledge');
const CONTRACT = join(KNOWLEDGE, 'ai/contract');

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
});
/** Every file (including JSON fixtures), unlike `walk`, which lists .ts files only. */
const walkAll = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walkAll(p) : [p];
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

  /**
   * D-2 (Product Architecture approved, 2026-11-09): the Phase-1-only guard ("no migration ≥ 073; no knowledge file
   * imports the contract") is replaced by these Phase 2 checks. The frozen contract source, its fixtures, and its golden
   * vectors are pinned by content digest at the v1 freeze baseline (697f8ea).
   */
  describe('Phase 2 boundaries (D-2)', () => {
    const MIGRATIONS = join(API, 'src/migrations');
    const LAST_HISTORICAL = BigInt(1748300000072);
    const stamp = (f: string) => BigInt(f.slice(0, 13));
    const migrationFiles = readdirSync(MIGRATIONS).filter((f) => /^\d{13}-.*\.ts$/.test(f));
    const digest = (files: string[]) => {
      const h = createHash('sha256');
      for (const f of [...files].sort((a, b) => (rel(a) < rel(b) ? -1 : 1))) {
        h.update(rel(f)); h.update('\0'); h.update(readFileSync(f)); h.update('\0');
      }
      return h.digest('hex');
    };
    /** Body of the migration's up() method (comments removed). */
    const upBody = (f: string) => {
      const src = stripComments(readFileSync(join(MIGRATIONS, f), 'utf8'));
      const start = src.indexOf('async up(');
      const end = src.indexOf('async down(');
      return start >= 0 && end > start ? src.slice(start, end) : '';
    };

    it('migrations ≥ 073 are additive only, and every historical migration (≤ 072) is byte-for-byte unchanged', () => {
      const historical = migrationFiles.filter((f) => stamp(f) <= LAST_HISTORICAL).map((f) => join(MIGRATIONS, f));
      expect(historical).toHaveLength(72);
      expect(digest(historical)).toBe('4d9726fb3670864edb0ceb1e4c4987b55d7a6705a83074e06189be480ae44efc');
      const destructive = /\bDROP\b|\bRENAME\b|\bALTER\s+COLUMN\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bUPDATE\s+\w+\s+SET\b|\bSET\s+DATA\s+TYPE\b/i;
      const offenders = migrationFiles.filter((f) => stamp(f) > LAST_HISTORICAL)
        .filter((f) => upBody(f) === '' || destructive.test(upBody(f))); // SQL lives in string literals, so strings are kept
      expect(offenders).toEqual([]);
      // Self-test: the rule rejects destructive statements and accepts additive ones.
      expect(destructive.test('ALTER TABLE ai_budget_ledger DROP COLUMN units')).toBe(true);
      expect(destructive.test('ALTER TABLE t ALTER COLUMN c TYPE text')).toBe(true);
      expect(destructive.test('ALTER TABLE ai_budget_ledger ADD COLUMN "reservedMicroUsd" bigint')).toBe(false);
    });

    /*
     * NEM-022 D-1 (Product Architecture approved, 2026-11-09): the two Phase-2-only guards ("contract integration
     * is limited to the ledger/metering layer" and "Gateway, router, and turn execution remain outside Phase 2")
     * are replaced by the NEM-022 boundaries below. Every other D-2 protection in this block is unchanged.
     */
    it('contract integration is limited to the ledger/metering layer and the Gateway layer (knowledge/ai)', () => {
      const users = walk(KNOWLEDGE).filter((f) => !f.startsWith(CONTRACT) && imports(f).some((i) => /ai\/contract|\.\/contract|\.\.\/contract/.test(i)));
      const allowed = (f: string) => f.startsWith(join(KNOWLEDGE, 'metering') + '/') || f.startsWith(join(KNOWLEDGE, 'ai') + '/');
      expect(users.filter((f) => !allowed(f)).map(rel)).toEqual([]);
      expect(users.some((f) => f.startsWith(join(KNOWLEDGE, 'ai', 'gateway') + '/'))).toBe(true); // the Gateway is on contract v1
    });

    it('sessions/* never imports the contract, the cost ledger, or pricing directly; turns reach them only through the Gateway', () => {
      const sessions = walk(join(KNOWLEDGE, 'sessions'));
      const offenders = sessions.filter((f) => imports(f).some((i) => /contract|cost-ledger|cost-config|cost-reconciliation|rate-card|budget-ledger/.test(i))).map(rel);
      expect(offenders).toEqual([]);
      // One accounting path per turn (D-2): the turn service uses the Gateway v2, not the legacy Gateway or ledger.
      const turn = readFileSync(join(KNOWLEDGE, 'sessions/turn.service.ts'), 'utf8');
      expect(imports(join(KNOWLEDGE, 'sessions/turn.service.ts'))).toContain('../ai/gateway/ai-gateway.service');
      expect(turn).not.toMatch(/model-gateway\.service|ModelGatewayService/);
    });

    it('no duplicate pricing calculation: outside the contract, no money primitive or per-million/bps arithmetic', () => {
      const primitives = /\b(?:roundCeiling|roundHalfUp|fromPicoSum|applyFactorBps|exactUsageSum|exactWorstCaseSum|canonicalModifierOrder|selectTier)\s*\(|\b1_?000_?000n\b|\b10_?000n\b|\bPER_MILLION\b|\bBPS_DENOMINATOR\b/;
      const offenders = walk(KNOWLEDGE).filter((f) => !f.startsWith(CONTRACT))
        .filter((f) => primitives.test(stripStrings(stripComments(readFileSync(f, 'utf8'))))).map(rel);
      expect(offenders).toEqual([]);
      expect(primitives.test('const micro = (tokens * rate) / 1_000_000n;')).toBe(true); // self-test
    });

    it('frozen contract source, fixtures, and golden vectors are unchanged since the v1 freeze (697f8ea)', () => {
      expect(contractFiles.length).toBeGreaterThan(0);
      expect(digest(walkAll(CONTRACT))).toBe('aabc0d142f2c3d45400f61efce7662f1bba94a1d8864164bd6db412d16d9d41d');
      const tests = walkAll(join(API, 'tests/unit/knowledge/ai/contract')).filter((f) => !f.endsWith('contract-architecture.spec.ts'));
      expect(digest(tests)).toBe('518dcac722f82effcbf38c0851249abfe596058de634eaf9845ba8c7773c4ee1');
    });
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
