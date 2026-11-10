import { readFileSync } from 'fs';
import { join } from 'path';

/** NEM-021 Phase 2 architecture rules for the cost-aware ledger (§9, §9.1, §9.2, §10). */
const METERING = join(__dirname, '../../../../src/knowledge/metering');
const COST_FILES = ['cost-ledger.service.ts', 'cost-config.service.ts', 'cost-reconciliation-job.service.ts', 'attempt-key.ts'];
const src = (f: string) => readFileSync(join(METERING, f), 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const sqlOf = (f: string) => [...src(f).matchAll(/`([^`]*)`/g)].map((m) => m[1]);

describe('NEM-021 Phase 2 cost-ledger architecture', () => {
  it('no floating-point operation on money or tokens in the cost ledger (§9.2)', () => {
    const forbidden = /\bparseFloat\b|\.toFixed\(|\bMath\.(round|floor|ceil|pow|trunc)\b|\b\d+\.\d+\b/;
    expect(COST_FILES.filter((f) => forbidden.test(stripComments(src(f)).replace(/'[^']*'|`[^`]*`/g, "''")))).toEqual([]);
  });

  it('micro-USD values are never converted to Number in the ledger (BigInt end to end)', () => {
    const toNumber = /Number\([^)]*(MicroUsd|microUsd|cost|reserved|actual|settled|held|committed|allowance|units)\b/i;
    expect(COST_FILES.filter((f) => toNumber.test(stripComments(src(f))))).toEqual([]);
  });

  it('ledger, usage, partial-settlement, and overrun rows are append-only (no UPDATE or DELETE)', () => {
    const appendOnly = /\b(UPDATE|DELETE\s+FROM)\s+(ai_budget_ledger|ai_usage_events|ai_partial_settlements|ai_cost_overruns)\b/i;
    const offenders = COST_FILES.flatMap((f) => sqlOf(f).filter((q) => appendOnly.test(q)).map(() => f));
    expect(offenders).toEqual([]);
  });

  it('an overrun is never added to committed (§9.1): committed = settled + held + compensated', () => {
    const ledger = stripComments(src('cost-ledger.service.ts'));
    expect(ledger).toMatch(/const committed = settled \+ held \+ compensated;/);
    expect(ledger).not.toMatch(/committed\s*=[^;]*overrun/i);
    expect(ledger).not.toMatch(/committed\s*\+=/);
  });

  it('every cost-aware admission takes the B-6 global lock before the scope lock', () => {
    const ledger = src('cost-ledger.service.ts');
    const g = ledger.indexOf('[GLOBAL_ADMISSION_LOCK]');
    const scope = ledger.indexOf('[`${req.userId}:${req.capability}`]');
    expect(g).toBeGreaterThan(0);
    expect(scope).toBeGreaterThan(g);
  });

  it('the module registers the cost services and adds no controller (dark; the Gateway wires them under NEM-022)', () => {
    const mod = readFileSync(join(METERING, '../knowledge.module.ts'), 'utf8');
    for (const s of ['CostConfigService', 'CostLedgerService', 'CostReconciliationJobService']) expect(mod).toContain(`    ${s},`);
    expect(mod).toMatch(/controllers: \[SessionsController\]/);
  });

  it('no customer-visible text names a provider or model (denials reuse the neutral NEM-019 reasons)', () => {
    const ledger = src('cost-ledger.service.ts');
    expect(ledger).toMatch(/class AttemptDenied extends IntelligenceDenied/);
    expect(ledger).not.toMatch(/super\([^)]*(provider|model)/i);
  });
});
