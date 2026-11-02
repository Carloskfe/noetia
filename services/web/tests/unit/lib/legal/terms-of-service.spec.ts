import {
  TERMS_EN,
  TERMS_ES,
  TERMS_LAST_UPDATED,
  TERMS_PUBLICATION_DATE_PLACEHOLDER,
} from '../../../../lib/legal/terms-of-service';
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

  // Intentionally fails until the real deploy-day date replaces the placeholder:
  // PR B must not be published with an unset or planned date.
  it('has the actual publication date set (replace the placeholder on deploy day)', () => {
    expect(TERMS_LAST_UPDATED).not.toBe(TERMS_PUBLICATION_DATE_PLACEHOLDER);
  });

  const itOnceDated = TERMS_LAST_UPDATED === TERMS_PUBLICATION_DATE_PLACEHOLDER ? it.skip : it;

  itOnceDated('is a well-formed bilingual date whose Spanish and English halves agree', () => {
    const ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const match = TERMS_LAST_UPDATED.match(/^(\d{1,2}) de ([a-z]+) de (\d{4}) \/ ([A-Z][a-z]+) (\d{1,2}), (\d{4})$/);
    expect(match).not.toBeNull();
    const [, esDay, esMonth, esYear, enMonth, enDay, enYear] = match!;
    expect(ES.indexOf(esMonth)).toBeGreaterThanOrEqual(0);
    expect(ES.indexOf(esMonth)).toBe(EN.indexOf(enMonth));
    expect(esDay).toBe(enDay);
    expect(esYear).toBe(enYear);
  });

  itOnceDated('is a new revision, later than the previous June 4, 2026 terms', () => {
    const EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const [, month, day, year] = TERMS_LAST_UPDATED.match(/\/ ([A-Z][a-z]+) (\d{1,2}), (\d{4})$/)!;
    const revised = Date.UTC(Number(year), EN.indexOf(month), Number(day));
    expect(revised).toBeGreaterThan(Date.UTC(2026, 5, 4));
  });

  it('leaves the Cookie Policy date untouched', () => {
    expect(COOKIE_LAST_UPDATED).toBe('4 de junio de 2026 / June 4, 2026');
  });
});
