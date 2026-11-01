import { TERMS_EN, TERMS_ES, TERMS_LAST_UPDATED } from '../../../../lib/legal/terms-of-service';
import { LAST_UPDATED as COOKIE_LAST_UPDATED } from '../../../../lib/legal/cookie-policy';

// Approved subscription schedule (Product Owner, NOF-003 / NOF-004).
const APPROVED = [
  { en: 'Individual', es: 'Individual', monthly: '8.99', annual: '83.99' },
  { en: 'Duo', es: 'Dúo', monthly: '13.99', annual: '129.99' },
  { en: 'Family', es: 'Familia', monthly: '18.99', annual: '179.99' },
];

/** Rows of the "Monthly / Annual Plans" markdown table: [label, monthly, annual]. */
function planRows(doc: string): string[][] {
  return doc
    .split('\n')
    .filter((line) => /^\| (Individual|Duo|Dúo|Family|Familia)\b/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

describe('Terms of Service — plan table', () => {
  it('lists the approved English names and prices', () => {
    const rows = planRows(TERMS_EN);
    expect(rows).toHaveLength(3);
    rows.forEach(([label, monthly, annual], i) => {
      expect(label.startsWith(APPROVED[i].en)).toBe(true);
      expect(monthly).toBe(`$${APPROVED[i].monthly} USD`);
      expect(annual).toBe(`$${APPROVED[i].annual} USD`);
    });
  });

  it('lists the approved Spanish names and prices (decimal comma)', () => {
    const rows = planRows(TERMS_ES);
    expect(rows).toHaveLength(3);
    rows.forEach(([label, monthly, annual], i) => {
      expect(label.startsWith(APPROVED[i].es)).toBe(true);
      expect(monthly).toBe(`$${APPROVED[i].monthly.replace('.', ',')} USD`);
      expect(annual).toBe(`$${APPROVED[i].annual.replace('.', ',')} USD`);
    });
  });

  it.each(['80.99', '125.99', '170.99', '80,99', '125,99', '170,99', 'Dual Reader'])(
    'contains no stale value %p',
    (stale) => {
      expect(TERMS_EN).not.toContain(stale);
      expect(TERMS_ES).not.toContain(stale);
    },
  );
});

describe('Terms of Service — revision date', () => {
  it('has its own revision constant, rendered in both languages', () => {
    expect(TERMS_ES).toContain(`Última actualización: ${TERMS_LAST_UPDATED}`);
    expect(TERMS_EN).toContain(`Last updated: ${TERMS_LAST_UPDATED}`);
  });

  it('keeps the published effective date unchanged (a new date needs a Product Owner decision)', () => {
    expect(TERMS_LAST_UPDATED).toBe('4 de junio de 2026 / June 4, 2026');
  });

  it('leaves the Cookie Policy date untouched', () => {
    expect(COOKIE_LAST_UPDATED).toBe('4 de junio de 2026 / June 4, 2026');
  });
});
