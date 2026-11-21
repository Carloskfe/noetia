import { en } from '../../../lib/i18n/en';
import { es } from '../../../lib/i18n/es';

// The `es` object is typed as `Translations` (= typeof en), so gross shape
// mismatches are caught at compile time. These tests guard the things the type
// system does NOT catch at runtime: a key present in the type but accidentally
// omitted from `es` (TS would flag it, but only if noImplicitAny/strict paths
// hold), function parameter arity drift, and — most importantly — a new key
// added to `en` without a Spanish translation.

type AnyRecord = Record<string, unknown>;

/** Describe the shape of a value: 'string', 'fn:<arity>', 'array:<len>', or a
 *  nested descriptor object. Two translation trees are structurally equal iff
 *  their descriptors are deeply equal. */
function describeShape(value: unknown): unknown {
  if (typeof value === 'function') return `fn:${(value as (...a: unknown[]) => unknown).length}`;
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return value.map(describeShape);
  if (value && typeof value === 'object') {
    const out: AnyRecord = {};
    for (const key of Object.keys(value as AnyRecord)) {
      out[key] = describeShape((value as AnyRecord)[key]);
    }
    return out;
  }
  return typeof value;
}

/** Collect every leaf key path (dot-joined) so a missing key reports where. */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as AnyRecord).flatMap((k) =>
      leafPaths((value as AnyRecord)[k], prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe('i18n en/es parity', () => {
  it('has an identical key structure in both languages', () => {
    expect(describeShape(es)).toEqual(describeShape(en));
  });

  it('has no key present in en but missing from es', () => {
    const enPaths = new Set(leafPaths(en));
    const esPaths = new Set(leafPaths(es));
    const missingInEs = [...enPaths].filter((p) => !esPaths.has(p));
    expect(missingInEs).toEqual([]);
  });

  it('has no key present in es but missing from en', () => {
    const enPaths = new Set(leafPaths(en));
    const esPaths = new Set(leafPaths(es));
    const missingInEn = [...esPaths].filter((p) => !enPaths.has(p));
    expect(missingInEn).toEqual([]);
  });
});

describe('reader.audio namespace', () => {
  it('exposes the Active Listening panel strings in both languages', () => {
    for (const t of [en, es]) {
      expect(typeof t.reader.audio.panelTitle).toBe('string');
      expect(typeof t.reader.audio.createQuote).toBe('string');
      expect(typeof t.reader.audio.soloAudio).toBe('string');
      expect(typeof t.reader.audio.noSyncWarning).toBe('string');
    }
  });

  it('interpolates the phrase index in continueFromPhrase', () => {
    expect(en.reader.audio.continueFromPhrase(12)).toContain('12');
    expect(es.reader.audio.continueFromPhrase(12)).toContain('12');
  });

  it('interpolates both phrase indices in moveNarrationSub', () => {
    const enMsg = en.reader.audio.moveNarrationSub(3, 8);
    const esMsg = es.reader.audio.moveNarrationSub(3, 8);
    expect(enMsg).toContain('3');
    expect(enMsg).toContain('8');
    expect(esMsg).toContain('3');
    expect(esMsg).toContain('8');
  });

  it('interpolates the phrase index in quoteMarked', () => {
    expect(en.reader.audio.quoteMarked(5)).toContain('5');
    expect(es.reader.audio.quoteMarked(5)).toContain('5');
  });
});

describe('reader.chapters namespace', () => {
  it('exposes the chapter drawer strings in both languages', () => {
    for (const t of [en, es]) {
      expect(typeof t.reader.chapters.ariaLabel).toBe('string');
      expect(typeof t.reader.chapters.title).toBe('string');
      expect(typeof t.reader.chapters.close).toBe('string');
      expect(typeof t.reader.chapters.empty).toBe('string');
    }
  });
});

describe('fragments.sheet namespace', () => {
  it('exposes the fragment drawer strings in both languages', () => {
    for (const t of [en, es]) {
      expect(typeof t.fragments.sheet.ariaLabel).toBe('string');
      expect(typeof t.fragments.sheet.select).toBe('string');
      expect(typeof t.fragments.sheet.empty).toBe('string');
      expect(typeof t.fragments.sheet.share).toBe('string');
      expect(typeof t.fragments.sheet.delete).toBe('string');
    }
  });

  it('interpolates the selected count in combine', () => {
    expect(en.fragments.sheet.combine(3)).toContain('3');
    expect(es.fragments.sheet.combine(3)).toContain('3');
  });
});

describe('shareCard namespace', () => {
  it('exposes the share-modal strings in both languages', () => {
    for (const t of [en, es]) {
      expect(typeof t.shareCard.title).toBe('string');
      expect(typeof t.shareCard.background).toBe('string');
      expect(typeof t.shareCard.download).toBe('string');
      expect(typeof t.shareCard.publish).toBe('string');
      expect(typeof t.shareCard.errorPublish).toBe('string');
    }
  });

  it('interpolates the platform name in publishedOn', () => {
    expect(en.shareCard.publishedOn('LinkedIn')).toContain('LinkedIn');
    expect(es.shareCard.publishedOn('LinkedIn')).toContain('LinkedIn');
  });

  it('interpolates book/collection into the citation placeholders', () => {
    expect(en.shareCard.citationPlaceholder('Hamlet')).toContain('Hamlet');
    expect(es.shareCard.citationCollectionPlaceholder('Shakespeare', 'Hamlet')).toContain('Hamlet');
    expect(es.shareCard.citationCollectionPlaceholder('Shakespeare', 'Hamlet')).toContain('Shakespeare');
  });

  it('numbers the preset alt text', () => {
    expect(en.shareCard.presetAlt(2)).toContain('2');
    expect(es.shareCard.presetAlt(2)).toContain('2');
  });
});

// ── Interpolation functions: exact EN/ES output for every function-valued key ────────────
// Each row calls the real translation function with sample arguments and asserts the exact
// approved string in both languages (incl. singular/plural branches). The completeness test
// below fails if a new function key is added to `en` without a row here.

type Fn = (...args: never[]) => string;
function at(tree: unknown, path: string): Fn {
  return path.split('.').reduce<unknown>((node, k) => (node as AnyRecord)[k], tree) as Fn;
}
function functionPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'function') return [prefix];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as AnyRecord).flatMap((k) =>
      functionPaths((value as AnyRecord)[k], prefix ? `${prefix}.${k}` : k),
    );
  }
  return [];
}

const INTERPOLATIONS: Array<[path: string, args: unknown[], en: string, es: string]> = [
  ['library.noResults', ['Quijote'], 'No results found for "Quijote"', 'No se encontraron resultados para "Quijote"'],
  ['library.bookCount', [1], '1 book', '1 libro'],
  ['library.bookCount', [4], '4 books', '4 libros'],
  ['library.bookCount', [0], '0 books', '0 libros'],
  ['reader.paged.pageOf', [3, 120], '3 / 120', '3 / 120'],
  ['reader.audio.continueFromPhrase', [12], 'Continue from phrase 12', 'Continuar desde frase 12'],
  ['reader.audio.moveNarrationSub', [3, 8], "You're on phrase 3. You'll jump to phrase 8.", 'Vas por la frase 3. Saltarás a la frase 8.'],
  ['reader.audio.quoteMarked', [5], '🔖 Quote marked at phrase 5', '🔖 Cita marcada en frase 5'],
  ['fragments.sheet.combine', [3], 'Combine (3)', 'Combinar (3)'],
  ['account.tokenAvail', [1], '1 available', '1 disponible'],
  ['account.tokenAvail', [2], '2 available', '2 disponibles'],
  ['billing.members.slots', [2, 4], '2 / 4', '2 / 4'],
  ['billing.members.full', [4], 'Plan full — 4 of 4 users.', 'Plan completo — 4 de 4 usuarios.'],
  ['stats.streakDays', [1], '1 day', '1 día'],
  ['stats.streakDays', [7], '7 days', '7 días'],
  ['stats.minutesFmt', [1], '1 min', '1 min'],
  ['stats.minutesFmt', [45], '45 min', '45 min'],
  ['stats.period.activeWeeks', [1], '1 active week', '1 semana activa'],
  ['stats.period.activeWeeks', [3], '3 active weeks', '3 semanas activas'],
  ['stats.period.activeMonths', [1], '1 active month', '1 mes activo'],
  ['stats.period.activeMonths', [6], '6 active months', '6 meses activos'],
  ['stats.goals.progress', [90, 120], '90 / 120', '90 / 120'],
  ['nav.readingProgress', [42], 'Reading progress: 42%', 'Progreso de lectura: 42%'],
  ['discover.noResults', ['Dante'], 'No results found for "Dante"', 'No se encontraron resultados para "Dante"'],
  ['discover.resultCount', [1, 'Dante'], '1 result for "Dante"', '1 resultado para "Dante"'],
  ['discover.resultCount', [5, 'Dante'], '5 results for "Dante"', '5 resultados para "Dante"'],
  ['discover.freeClassicsCount', [40], '40 classics of world literature', '40 clásicos de la literatura universal'],
  ['shareCard.citationBiblePlaceholder', ['Salmos'], 'Salmos, Chapter 23, verse 1', 'Salmos, Capítulo 23, versículo 1'],
  ['shareCard.citationCollectionPlaceholder', ['Shakespeare', 'Hamlet'], 'Shakespeare · Hamlet, Chapter X, p. N', 'Shakespeare · Hamlet, Capítulo X, p. N'],
  ['shareCard.citationPlaceholder', ['Hamlet'], 'Hamlet, Chapter X, p. N', 'Hamlet, Capítulo X, p. N'],
  ['shareCard.presetAlt', [2], 'Image 2', 'Imagen 2'],
  ['shareCard.publishedOn', ['LinkedIn'], 'Published on LinkedIn!', '¡Publicado en LinkedIn!'],
  ['giftCard.send.submit', ['3 tokens', '$9.99'], 'Gift 3 tokens — $9.99', 'Regalar 3 tokens — $9.99'],
  ['giftCard.claim.tokenLabel', [1], 'Noetia Token', 'Token Noetia'],
  ['giftCard.claim.tokenLabel', [3], 'Noetia Tokens', 'Tokens Noetia'],
  ['giftCard.claim.success.title', [1], '1 token received!', '¡1 token recibido!'],
  ['giftCard.claim.success.title', [3], '3 tokens received!', '¡3 tokens recibidos!'],
];

describe('interpolation functions (exact EN/ES output)', () => {
  it.each(INTERPOLATIONS)('%s(%j) renders the approved English and Spanish text', (path, args, enText, esText) => {
    expect(at(en, path)(...(args as never[]))).toBe(enText);
    expect(at(es, path)(...(args as never[]))).toBe(esText);
  });

  it('has a test row for every function-valued key in both languages', () => {
    const covered = new Set(INTERPOLATIONS.map(([p]) => p));
    expect(functionPaths(en).filter((p) => !covered.has(p))).toEqual([]);
    expect(functionPaths(es).filter((p) => !covered.has(p))).toEqual([]);
  });

  it('substitutes user-supplied text verbatim (no truncation or escaping by the translation layer)', () => {
    const q = 'Cien años <de> "soledad" & más';
    expect(en.discover.noResults(q)).toBe(`No results found for "${q}"`);
    expect(es.library.noResults(q)).toBe(`No se encontraron resultados para "${q}"`);
  });
});
