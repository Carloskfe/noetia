/**
 * NEM-025 B2-A1 — typed email dictionary parity, French completeness, interpolation and typography.
 */
import { EMAIL_COPY } from '../../../src/email/copy';
import { en } from '../../../src/email/copy/en';
import { es } from '../../../src/email/copy/es';
import { frCa } from '../../../src/email/copy/fr-ca';
import { escapeHtml } from '../../../src/email/escape';

type Leaf = { path: string; value: unknown };
function leaves(obj: unknown, prefix = ''): Leaf[] {
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return [{ path: prefix, value: obj }];
}

const S = escapeHtml('⟦S⟧'); // marker for SafeHtml args
const STR = '⟦R⟧'; // marker for raw string args

/** Evaluates a leaf to its rendered string(s) using markers and both token counts. */
function render(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'function') throw new Error('unexpected leaf type');
  const fn = value as (...a: unknown[]) => string;
  const variants: unknown[][] = [];
  switch (fn.length) {
    case 1: variants.push([S], [1], [3], [STR]); break;
    case 2: variants.push([S, 1], [S, 3], [S, S]); break;
    case 3: variants.push([S, 1, S], [S, 3, S]); break;
    default: throw new Error(`unexpected arity ${fn.length}`);
  }
  return variants.map((args) => String(fn(...args)));
}

const DICTS = { es, en, 'fr-CA': frCa };

describe('email dictionaries (B2-A1)', () => {
  it('registry exposes exactly es, en and fr-CA', () => {
    expect(Object.keys(EMAIL_COPY).sort()).toEqual(['en', 'es', 'fr-CA']);
    expect(EMAIL_COPY.es).toBe(es);
    expect(EMAIL_COPY.en).toBe(en);
    expect(EMAIL_COPY['fr-CA']).toBe(frCa);
  });

  it('key parity: every locale has the same keys', () => {
    const keys = (d: unknown) => leaves(d).map((l) => l.path).sort();
    expect(keys(en)).toEqual(keys(es));
    expect(keys(frCa)).toEqual(keys(es));
  });

  it('interpolation parity: same leaf kind and arity in every locale', () => {
    const shape = (d: unknown) =>
      leaves(d).map((l) => `${l.path}:${typeof l.value}:${typeof l.value === 'function' ? (l.value as (...a: unknown[]) => unknown).length : '-'}`).sort();
    expect(shape(en)).toEqual(shape(es));
    expect(shape(frCa)).toEqual(shape(es));
  });

  it.each(Object.entries(DICTS))('%s: every entry renders a non-empty string', (_loc, dict) => {
    for (const { path, value } of leaves(dict)) {
      for (const out of render(value)) {
        expect(`${path}=${out.trim().length > 0}`).toBe(`${path}=true`);
      }
    }
  });

  it.each(Object.entries(DICTS))('%s: interpolating functions include every argument they receive', (_loc, dict) => {
    const check = (path: string, fn: (...a: any[]) => string, args: unknown[]) => {
      const out = fn(...args);
      for (const a of args) {
        if (typeof a === 'number') continue; // counts select wording; checked separately
        expect(`${path} contains ${String(a)}: ${out.includes(String(a))}`).toBe(`${path} contains ${String(a)}: true`);
      }
    };
    const d = dict as typeof es;
    check('confirmation.greeting', d.confirmation.greeting, [S]);
    check('passwordReset.greeting', d.passwordReset.greeting, [S]);
    check('farewell.greeting', d.farewell.greeting, [S]);
    check('farewell.registerAgain', d.farewell.registerAgain, [S]);
    check('waitlistConfirmation.heading', d.waitlistConfirmation.heading, [S]);
    check('waitlistInvite.heading', d.waitlistInvite.heading, [S]);
    check('giftCard.subject', d.giftCard.subject, [S, 3]);
    check('giftCard.heading', d.giftCard.heading, [S]);
    check('giftCard.quote', d.giftCard.quote, [S]);
    check('giftConfirmation.subject', d.giftConfirmation.subject, [STR]);
    check('giftConfirmation.body', d.giftConfirmation.body, [S, 3, escapeHtml('⟦E⟧')]);
    check('giftConfirmation.questions', d.giftConfirmation.questions, [STR]);
    check('planInvite.subject', d.planInvite.subject, [S, escapeHtml('⟦P⟧')]);
    check('planInvite.body', d.planInvite.body, [S, escapeHtml('⟦P⟧')]);
    expect(d.giftCard.subject(S, 3)).toContain('3');
    expect(d.giftConfirmation.body(S, 3, S)).toContain('3');
  });

  it.each(Object.entries(DICTS))('%s: token-count wording differs between 1 and 3', (_loc, dict) => {
    const d = dict as typeof es;
    expect(d.giftCard.subject(S, 1)).not.toEqual(d.giftCard.subject(S, 3).replace('3', '1'));
    expect(d.giftCard.tokenLabel(1)).not.toEqual(d.giftCard.tokenLabel(3));
  });

  it('Unicode values pass through interpolation untouched', () => {
    const u = escapeHtml('José Ñúñez — 李小龍 ’«» 📚');
    for (const d of [es, en, frCa]) {
      expect(d.confirmation.greeting(u)).toContain('José Ñúñez — 李小龍 ’«» 📚');
      expect(d.giftCard.quote(u)).toContain('José Ñúñez — 李小龍 ’«» 📚');
    }
  });

  describe('French draft completeness and typography', () => {
    // Identical-to-source strings that are legitimate in French (proper nouns, cognates).
    const ALLOWED_SAME_AS_EN = new Set(['waitlistConfirmation.fragments']);

    it('no French entry is left in Spanish or English', () => {
      const esL = leaves(es);
      const enL = leaves(en);
      for (const [i, { path, value }] of leaves(frCa).entries()) {
        if (ALLOWED_SAME_AS_EN.has(path)) continue;
        const fr = render(value).join('|');
        expect(`${path}: ${fr === render(esL[i].value).join('|')}`).toBe(`${path}: false`);
        expect(`${path}: ${fr === render(enL[i].value).join('|')}`).toBe(`${path}: false`);
      }
    });

    const frStrings = () => leaves(frCa).flatMap(({ path, value }) => render(value).map((out) => ({ path, out })));

    it('uses typographic apostrophes, never ASCII quotes in copy', () => {
      for (const { path, out } of frStrings()) {
        // `style="…"` never appears in copy; markup-bearing entries only contain <strong>.
        expect(`${path}: ${/'/.test(out)}`).toBe(`${path}: false`);
      }
    });

    it('Québec punctuation: no space before ? or !, non-breaking space before :', () => {
      for (const { path, out } of frStrings()) {
        expect(`${path}: ${/[ \u00A0\u202F][?!]/.test(out)}`).toBe(`${path}: false`);
        expect(`${path}: ${/[^\u00A0]:/.test(out.replace(/https?:/g, ''))}`).toBe(`${path}: false`);
      }
    });

    it('French guillemets use non-breaking inner spaces', () => {
      expect(frCa.giftCard.quote(S)).toBe(`«\u00A0${S}\u00A0»`);
    });

    it('uses the provisional terminology (vous, jeton, courriel, Écoute active, forfait)', () => {
      const all = frStrings().map((x) => x.out).join(' ');
      expect(all).toMatch(/\bvous\b/);
      expect(all).not.toMatch(/(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})/iu); // Unicode-aware: 'bêta' is not 'ta'
      expect(all).toMatch(/jeton/);
      expect(all).not.toMatch(/\btoken/i);
      expect(all).toMatch(/courriel/);
      expect(all).not.toMatch(/e-mail/i);
      expect(all).toContain('Écoute active');
      expect(all).toContain('forfait');
      expect(all).not.toMatch(/\.\.\./);
    });

    it('farewell keeps the same data-erasure statement as ES/EN (no change of legal meaning)', () => {
      expect(frCa.farewell.body).toMatch(/fragments, bibliothèque et préférences/);
      expect(frCa.farewell.body).toMatch(/effacées de nos systèmes/);
    });

    it('commercial meaning preserved: gift validity 1 year, invite 48 h, reset 1 h, confirmation 24 h', () => {
      expect(frCa.giftCard.validity).toContain('1 an');
      expect(frCa.planInvite.expiry).toContain('48 heures');
      expect(frCa.passwordReset.expiry).toContain('1 heure');
      expect(frCa.confirmation.expiry).toContain('24 heures');
      expect(frCa.giftCard.eachToken).toMatch(/Chaque jeton débloque un livre/);
    });
  });
});
