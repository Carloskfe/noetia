/** @jest-environment node */
// NEM-025 B1-A — page dictionaries: structure, interpolation, untranslated-string and policy checks.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { aboutCopy } from '@/lib/i18n/pages/about';
import { careersCopy } from '@/lib/i18n/pages/careers';
import { companyCopy } from '@/lib/i18n/pages/company';
import { CONTACT_CHANNELS, contactCopy } from '@/lib/i18n/pages/contact';
import { howWeBuildCopy } from '@/lib/i18n/pages/how-we-build';
import { milestonesCopy } from '@/lib/i18n/pages/milestones';
import { teamCopy } from '@/lib/i18n/pages/team';
import { trustCopy } from '@/lib/i18n/pages/trust';
import { corporateNavCopy, CORPORATE_LANGUAGE_LABELS } from '@/lib/i18n/pages/corporate-nav';
import { uploadGuideCopy } from '@/lib/i18n/pages/upload-guide';
import { CAUSAS_LINES, causasPageCopy } from '@/lib/i18n/pages/causas';
import { pickShareLanguage, shareInviteCopy } from '@/lib/i18n/pages/share-invite';
import { authorPortalCopy } from '@/lib/i18n/pages/author-portal';

type AnyRecord = Record<string, unknown>;

const PAGES: Record<string, Record<'es' | 'en' | 'fr-CA', unknown>> = {
  about: aboutCopy, careers: careersCopy, company: companyCopy, contact: contactCopy,
  howWeBuild: howWeBuildCopy, milestones: milestonesCopy, team: teamCopy, trust: trustCopy,
  corporateNav: corporateNavCopy, uploadGuide: uploadGuideCopy, causas: causasPageCopy,
  shareInvite: shareInviteCopy, authorPortal: authorPortalCopy,
};

function shape(v: unknown): unknown {
  if (React.isValidElement(v)) return 'node';
  if (typeof v === 'function') return `fn:${(v as (...a: unknown[]) => unknown).length}`;
  if (typeof v === 'string') return 'string';
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === 'object') {
    const o: AnyRecord = {};
    for (const k of Object.keys(v as AnyRecord)) o[k] = shape((v as AnyRecord)[k]);
    return o;
  }
  return typeof v;
}

function leaves(v: unknown, p = ''): [string, unknown][] {
  if (React.isValidElement(v) || typeof v !== 'object' || v === null) return [[p, v]];
  return Object.keys(v as AnyRecord).flatMap((k) => leaves((v as AnyRecord)[k], p ? `${p}.${k}` : k));
}

const text = (v: unknown) => (React.isValidElement(v) ? renderToStaticMarkup(v as React.ReactElement).replace(/<[^>]+>/g, '') : String(v));

// Leaves legitimately identical in French and English: names, routes, cognates, technical tokens.
const SAME_AS_EN: Record<string, RegExp> = {
  about: /^(missionLabel|visionLabel|links\.2\.label|links\.\d\.href)$/,
  careers: /^(contactLabel)$/,
  company: /^(pillars\.\d\.icon|links\.\d\.href)$/,
  contact: /^(label|channels\.6\.label|links\.\d\.href)$/,
  howWeBuild: /^(teams\.\d\.icon|teams\.3\.name)$/,
  milestones: /^(contactLabel|milestones\.6\.title|milestones\.7\.title)$/,
  team: /^(roles\.\d\.icon|roles\.3\.name)$/,
  trust: /^(links\.2\.cta|links\.\d\.href|security\.6)$/,
  corporateNav: /^(links\.\d\.href|links\.5\.label)$/,
  uploadGuide: /^(warnLabel|steps\.\d\.n|steps\.3\.title|textSpecs\.(1|3)\.value|coverSpecs\.(0|2|3)\.label|coverSpecs\.2\.value|audioSpecs\.1\.value|syncSpecs\.(0|1)\.(label|value)|syncSpecs\.0\.label)$/,
  causas: /^$/,
  shareInvite: /^$/,
  authorPortal: /^(tiers\.(starter|pro)|categories\.leadership|descriptionLabel)$/,
};

describe('page dictionaries (NEM-025 B1-A)', () => {
  describe.each(Object.entries(PAGES))('%s', (name, copy) => {
    it('has the same structure in es, en and fr-CA (keys, arrays, function arity, rich-text nodes)', () => {
      expect(shape(copy.es)).toEqual(shape(copy.en));
      expect(shape(copy['fr-CA'])).toEqual(shape(copy.en));
    });

    it('has no empty text in any language', () => {
      for (const lang of ['es', 'en', 'fr-CA'] as const) {
        const empty = leaves(copy[lang]).filter(([, v]) => (typeof v === 'string' || React.isValidElement(v)) && text(v).trim() === '');
        expect(empty).toEqual([]);
      }
    });

    it('interpolates the same arguments in every language', () => {
      for (const [path, enFn] of leaves(copy.en).filter(([, v]) => typeof v === 'function') as [string, (...a: unknown[]) => unknown][]) {
        const args = Array.from({ length: enFn.length }, (_, i) => 7301 + i);
        const expected = args.map(String).filter((a) => String(enFn(...args)).includes(a));
        for (const lang of ['es', 'fr-CA'] as const) {
          const fn = path.split('.').reduce<unknown>((o, k) => (o as AnyRecord)[k], copy[lang]) as (...a: unknown[]) => unknown;
          const out = String(fn(...args));
          for (const a of expected) expect(out).toContain(a);
        }
      }
    });

    it('leaves no English text untranslated in fr-CA outside the reviewed allowlist', () => {
      const en = new Map(leaves(copy.en));
      const same = leaves(copy['fr-CA'])
        .filter(([k, v]) => (typeof v === 'string' || React.isValidElement(v)) && en.has(k) && text(en.get(k)) === text(v))
        .map(([k]) => k)
        .filter((k) => !k.endsWith('.href') && !k.endsWith('.icon') && !SAME_AS_EN[name].test(k));
      expect(same).toEqual([]);
    });
  });

  it('keeps one contact label per channel and one Causas line per cause', () => {
    for (const lang of ['es', 'en', 'fr-CA'] as const) {
      expect(contactCopy[lang].channels).toHaveLength(CONTACT_CHANNELS.length);
      expect(causasPageCopy[lang].lines).toHaveLength(CAUSAS_LINES.length);
    }
  });

  it('keeps the 2.22% Causas Noetia commitment in every language (PO-053)', () => {
    expect(text(causasPageCopy.es.heroBody)).toContain('2,22%');
    expect(text(causasPageCopy.en.heroBody)).toContain('2.22%');
    expect(text(causasPageCopy['fr-CA'].heroBody)).toContain('2,22 %');
    expect(causasPageCopy['fr-CA'].how[0]).toContain('2,22 %');
    expect(aboutCopy['fr-CA'].values[4].body).toContain('2,22 %');
    expect(milestonesCopy['fr-CA'].milestones[7].desc).toContain('2,22 %');
  });

  it('keeps the visible ES/EN corporate toggle labels and labels French "FR"', () => {
    expect(CORPORATE_LANGUAGE_LABELS).toEqual({ es: 'ES', en: 'EN', 'fr-CA': 'FR' });
  });

  describe('pickShareLanguage (public invite page)', () => {
    it('keeps the existing es/en behaviour', () => {
      expect(pickShareLanguage('en-US,en;q=0.9', false)).toBe('en');
      expect(pickShareLanguage('es-MX', false)).toBe('es');
      expect(pickShareLanguage(null, false)).toBe('es');
      expect(pickShareLanguage(undefined, true)).toBe('es');
    });

    it('serves French only behind the readiness gate', () => {
      expect(pickShareLanguage('fr-CA,fr;q=0.9', false)).toBe('es');
      expect(pickShareLanguage('fr-CA,fr;q=0.9', true)).toBe('fr-CA');
      expect(pickShareLanguage('FR', true)).toBe('fr-CA');
    });

    it('reads the environment gate by default (off)', () => {
      const prev = process.env.NEXT_PUBLIC_FR_CA_ENABLED;
      delete process.env.NEXT_PUBLIC_FR_CA_ENABLED;
      expect(pickShareLanguage('fr-CA')).toBe('es');
      if (prev !== undefined) process.env.NEXT_PUBLIC_FR_CA_ENABLED = prev;
    });
  });

  it('author portal: plural and status helpers behave in every language', () => {
    expect(authorPortalCopy.es.quotaUsage(1, 3)).toBe('1 de 3 libros utilizado');
    expect(authorPortalCopy.es.submitError(0)).toBe('Error al enviar (sin conexión)');
    expect(authorPortalCopy.en.submitError(500)).toBe('Upload failed (500)');
    expect(authorPortalCopy['fr-CA'].readers(1)).toBe('1 lecteur');
    expect(authorPortalCopy['fr-CA'].readers(2)).toBe('2 lecteurs');
    expect(authorPortalCopy.en.shares(1)).toBe('1 share');
    expect(authorPortalCopy['fr-CA'].syncToggle(true)).toContain('Masquer');
  });
});
