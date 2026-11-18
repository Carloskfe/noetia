// Draft Causas program terms (PO decisions 2026-11-18): must carry every approved rule, stay labelled as an unreviewed
// draft, leave open points open, and never name a beneficiary or claim an agreement or contribution.
import {
  CAUSAS_TERMS_DRAFT_EN as EN,
  CAUSAS_TERMS_DRAFT_ES as ES,
  CAUSAS_TERMS_DRAFT_STATUS as STATUS,
} from '@/lib/legal/causas-program-terms-draft';

const sections = (md: string) => md.split('\n').filter((l) => l.startsWith('## ')).length;
const placeholders = (md: string) => (md.match(/\[[^\]]+\]/g) ?? []).length;

describe('Causas program terms — draft status', () => {
  it('labels both languages as a draft for legal review that is not in effect', () => {
    expect(STATUS.es.label).toBe('Borrador para revisión legal — no vigente');
    expect(STATUS.en.label).toBe('Draft for legal review — not in effect');
    expect(STATUS.es.body).toMatch(/No han sido revisados ni aprobados por asesoría legal/);
    expect(STATUS.en.body).toMatch(/have not been reviewed or approved by legal counsel/);
    expect(STATUS.es.body).toMatch(/no se ha firmado ningún acuerdo .* no se ha realizado ninguna contribución/);
    expect(STATUS.en.body).toMatch(/no agreement .* has been signed and no contribution has been made/);
  });

  it('titles each language version as a draft', () => {
    expect(ES).toMatch(/^# Causas Noetia — Términos del programa \(borrador\)$/m);
    expect(EN).toMatch(/^# Causas Noetia — Program terms \(draft\)$/m);
  });

  it('never presents itself as approved, effective or reviewed', () => {
    for (const t of [ES, EN, STATUS.es.body, STATUS.en.body]) {
      expect(t).not.toMatch(/\baprobad[oa]s? por\b(?! asesoría)|\bvigentes desde\b|\bapproved by\b(?! legal counsel)|\beffective (as of|from)\b|legally (binding|approved)/i);
    }
  });
});

describe('Causas program terms — approved rules', () => {
  it.each([
    ['es', ES, [
      /2,22% de los ingresos netos elegibles/,
      /después de las comisiones de procesamiento de pago/,
      /calcularán y liquidarán mensualmente/,
      /reembolsado antes de la liquidación mensual queda excluido/,
      /después de la liquidación mensual, la contribución ya entregada no se revierte: Noetia asume ese costo/,
      /organizaciones benéficas independientes, no causas operadas por Noetia/,
      /Aún no se ha firmado ningún acuerdo de colaboración/,
      /el 100% de la asignación de tus pagos elegibles se destina a esa causa/,
      /Si no eliges ninguna, la asignación se reparte por igual entre las tres\. No hay otras opciones/,
    ]],
    ['en', EN, [
      /2\.22% of eligible net receipts/,
      /after payment-processing fees/,
      /calculated and settled monthly/,
      /refunded before the monthly settlement is excluded/,
      /refunded after the monthly settlement, the contribution already disbursed is not reversed: Noetia absorbs that cost/,
      /independent charitable organizations, not causes operated by Noetia/,
      /No partnership agreement has been signed yet/,
      /100% of the allocation from your eligible payments goes to that cause/,
      /If you don't choose one, the allocation is split equally among all three\. There are no other distribution options/,
    ]],
  ] as const)('%s covers every PO rule', (_l, md, rules) => {
    for (const r of rules) expect(md).toMatch(r);
  });

  it('lists the three causes in both languages', () => {
    for (const c of ['Bienestar animal', 'Niñez y juventud', 'Medio ambiente']) expect(ES).toContain(`- ${c}`);
    for (const c of ['Animal welfare', 'Children and youth', 'Environment']) expect(EN).toContain(`- ${c}`);
  });

  it('keeps ES and EN structurally aligned (same sections, same open points)', () => {
    expect(sections(ES)).toBe(sections(EN));
    expect(sections(EN)).toBe(10);
    expect(placeholders(ES)).toBe(placeholders(EN));
  });

  it('leaves undecided matters as explicit open points instead of inventing policy', () => {
    for (const topic of [/qué pagos son elegibles/, /impuestos cobrados/, /contracargos/, /fechas de corte/, /cambio de causa/, /deja de participar/, /reportes del programa/, /modificar o finalizar/]) {
      expect(ES).toMatch(new RegExp(`\\[Pendiente de [^\\]]*${topic.source}`));
    }
    for (const topic of [/which payments are eligible/, /collected taxes/, /chargebacks/, /cut-off dates/, /change of cause/, /stops participating/, /program reports/, /change or end the program/]) {
      expect(EN).toMatch(new RegExp(`\\[To be [^\\]]*${topic.source}`));
    }
  });

  it('names no beneficiary organization and claims no partnership or completed donation', () => {
    for (const md of [ES, EN]) {
      expect(md).not.toMatch(/fundación|foundation|asociación civil|\bA\.C\.|\bInc\.|\bLtd\b|501\(c\)/i);
      expect(md).not.toMatch(/hemos donado|we have donated|donamos|we donate|nuestros aliados son|our partners are/i);
    }
  });
});
