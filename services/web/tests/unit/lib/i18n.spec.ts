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
