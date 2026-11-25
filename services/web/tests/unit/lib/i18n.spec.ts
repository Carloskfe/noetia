import { en } from '../../../lib/i18n/en';
import { es } from '../../../lib/i18n/es';
import { frCA } from '../../../lib/i18n/fr-ca';

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

// ── NEM-025 Checkpoint A: Canadian French (fr-CA) dictionary ──────────────────

function leafEntries(value: unknown, prefix = ''): [string, unknown][] {
  if (value && typeof value === 'object') {
    return Object.keys(value as AnyRecord).flatMap((k) =>
      leafEntries((value as AnyRecord)[k], prefix ? `${prefix}.${k}` : k),
    );
  }
  return [[prefix, value]];
}

describe('i18n en/fr-CA parity', () => {
  it('has an identical key structure, including function arity, in en and fr-CA', () => {
    expect(describeShape(frCA)).toEqual(describeShape(en));
  });

  it('has no key present in en but missing from fr-CA, and none extra', () => {
    const enPaths = new Set(leafPaths(en));
    const frPaths = new Set(leafPaths(frCA));
    expect([...enPaths].filter((p) => !frPaths.has(p))).toEqual([]);
    expect([...frPaths].filter((p) => !enPaths.has(p))).toEqual([]);
  });

  it('has no empty French string', () => {
    const empty = leafEntries(frCA).filter(([, v]) => typeof v === 'string' && v.trim() === '');
    expect(empty).toEqual([]);
  });

  // Strings that are legitimately identical in English and French: brand and product names,
  // language labels, routes, cognates, and the English public-domain demo passage.
  // Anything else identical to English is treated as an untranslated string.
  const IDENTICAL_TO_EN_ALLOWED = new Set([
    'lang.es', 'lang.en', 'lang.fr-CA',
    'onboarding.interests.categories.leadership', 'onboarding.interests.categories.marketing',
    'onboarding.interests.categories.science', 'onboarding.interests.categories.fiction',
    'onboarding.interests.categories.biography', 'reader.audio.pause', 'fragments.title',
    'fragments.sheet.title', 'account.admin', 'pricing.causasLink', 'paywall.title', 'nav.clubs',
    'nav.fragments', 'clubs.nav', 'clubs.page.tabs.discussion', 'clubs.polls.question',
    'clubs.polls.votes', 'clubs.members.roles.admin', 'discover.collections',
    'discover.tabs.leadership', 'footer.links.platform.2.label', 'footer.links.company.6.label',
    'shareCard.bgImage', 'landing.nav.menu', 'landing.hero.demoSource', 'landing.hero.demoBefore',
    'landing.hero.demoPhrase', 'landing.hero.demoAfter', 'landing.hero.demoQuote',
    'landing.hero.demoAuthor', 'landing.causas.eyebrow', 'causeSelector.eyebrow',
    'collection.label',
  ]);

  it('leaves no English string untranslated outside the reviewed allowlist', () => {
    const enMap = new Map(leafEntries(en));
    const untranslated = leafEntries(frCA)
      .filter(([k, v]) => typeof v === 'string' && enMap.get(k) === v)
      .map(([k]) => k)
      .filter((k) => !k.endsWith('.href') && !IDENTICAL_TO_EN_ALLOWED.has(k));
    expect(untranslated).toEqual([]);
  });

  it('keeps every footer route identical to en (routes are not localized in Checkpoint A)', () => {
    const enMap = new Map(leafEntries(en));
    for (const [k, v] of leafEntries(frCA)) {
      if (k.endsWith('.href')) expect(v).toBe(enMap.get(k));
    }
  });

  it('labels the French interface "Français (Canada)" in every dictionary', () => {
    for (const t of [en, es, frCA]) expect(t.lang['fr-CA']).toBe('Français (Canada)');
  });

  it('keeps the 2.22% Causas Noetia commitment unchanged in French copy', () => {
    expect(frCA.pricing.causasText).toContain('2,22 %');
    expect(frCA.landing.causas.body).toContain('2,22 %');
    expect(frCA.causeSelector.title).toContain('2,22 %');
    expect(frCA.causeSelector.body).toContain('2,22 %');
  });

  it('marks the only literal price as US dollars, never a bare $', () => {
    expect(frCA.giftCard.send.unlocks3).toContain('$ US');
  });

  it('keeps Noetia+ and NoetiaX described as not yet available', () => {
    expect(frCA.landing.eco.comingSoon).toBe('Bientôt offert');
    expect(frCA.landing.eco.note).toContain('ne sont pas encore offerts');
  });
});

describe('i18n interpolation parity (en, es, fr-CA)', () => {
  /** Distinct sentinel arguments: numbers stay > 1 so plural branches still interpolate. */
  function sentinelArgs(arity: number): unknown[] {
    return Array.from({ length: arity }, (_, i) => 7301 + i);
  }

  const enFns = leafEntries(en).filter(([, v]) => typeof v === 'function') as [string, (...a: unknown[]) => unknown][];

  it('covers every interpolated en string', () => {
    expect(enFns.length).toBeGreaterThan(0);
  });

  it.each(enFns.map(([path]) => path))('%s interpolates the same arguments in every language', (path) => {
    const pick = (t: unknown) =>
      path.split('.').reduce<unknown>((o, k) => (o as AnyRecord)[k], t) as (...a: unknown[]) => unknown;
    const enFn = pick(en);
    const args = sentinelArgs(enFn.length);
    const enOut = String(enFn(...args));
    const expected = args.map(String).filter((a) => enOut.includes(a));
    for (const t of [es, frCA]) {
      const out = String(pick(t)(...args));
      for (const a of expected) expect(out).toContain(a);
      expect(typeof out).toBe('string');
    }
  });

  it('keeps singular forms working in fr-CA', () => {
    expect(frCA.library.bookCount(1)).toBe('1 livre');
    expect(frCA.library.bookCount(3)).toBe('3 livres');
    expect(frCA.discover.resultCount(1, 'x')).toBe('1 résultat pour « x »');
    expect(frCA.giftCard.claim.tokenLabel(1)).toBe('Jeton Noetia');
    expect(frCA.giftCard.claim.tokenLabel(2)).toBe('Jetons Noetia');
    expect(frCA.giftCard.claim.success.title(1)).toBe('1 jeton reçu!');
    expect(frCA.account.tokenAvail(1)).toBe('1 disponible');
    expect(frCA.stats.streakDays(1)).toBe('1 jour');
    expect(frCA.stats.period.activeWeeks(1)).toBe('1 semaine active');
    expect(frCA.stats.period.activeMonths(1)).toBe('1 mois actif');
  });
});
