/**
 * NEM-025 B2-A1 — locale foundation. Live dispatch is behaviour-preserving; French is inert;
 * N-1 normalization is tested in isolation and is NOT wired to dispatch.
 */
import {
  dispatchCopyLocale,
  FR_CA_TRANSACTIONAL_READY,
  HTML_LANG,
  isFrenchTransactionalActive,
  N1_FALLBACK_LOCALE,
  resolveMessageLocale,
} from '../../../src/email/locale';

const GATE_ON = { FR_CA_ENABLED: 'true' } as NodeJS.ProcessEnv;
const NOT_ON = ['', 'TRUE', 'True', '1', 'yes', ' true', 'true '];
const LEGACY = ['pt', 'EN', 'Es', 'fr', 'fr-ca', 'FR-CA', '"><', '', null, undefined, 42, {}];

describe('French transactional readiness (inert in B2-A1)', () => {
  it('ships disabled in code', () => {
    expect(FR_CA_TRANSACTIONAL_READY).toBe(false);
  });

  it('is inactive by default even when the API French gate is on', () => {
    expect(isFrenchTransactionalActive({ env: GATE_ON })).toBe(false);
    expect(isFrenchTransactionalActive()).toBe(false);
  });

  it('requires BOTH the readiness constant and the exact gate value', () => {
    expect(isFrenchTransactionalActive({ env: GATE_ON, ready: true })).toBe(true);
    expect(isFrenchTransactionalActive({ env: {} as NodeJS.ProcessEnv, ready: true })).toBe(false);
    for (const v of NOT_ON) {
      expect(isFrenchTransactionalActive({ env: { FR_CA_ENABLED: v } as NodeJS.ProcessEnv, ready: true })).toBe(false);
    }
  });

  it('reads process.env when no env is passed', () => {
    const saved = process.env.FR_CA_ENABLED;
    process.env.FR_CA_ENABLED = 'true';
    try {
      expect(isFrenchTransactionalActive({ ready: true })).toBe(true);
      expect(isFrenchTransactionalActive()).toBe(false);
    } finally {
      if (saved === undefined) delete process.env.FR_CA_ENABLED;
      else process.env.FR_CA_ENABLED = saved;
    }
  });
});

describe('dispatchCopyLocale — live selection, behaviour-preserving', () => {
  it("'en' selects English", () => {
    expect(dispatchCopyLocale('en')).toBe('en');
    expect(dispatchCopyLocale('en', { env: GATE_ON, ready: true })).toBe('en');
  });

  it("'es' and the default select Spanish", () => {
    expect(dispatchCopyLocale('es')).toBe('es');
    expect(dispatchCopyLocale(undefined)).toBe('es');
  });

  it("stored 'fr-CA' selects Spanish (as before) while French is inactive — even with the gate on", () => {
    expect(dispatchCopyLocale('fr-CA')).toBe('es');
    expect(dispatchCopyLocale('fr-CA', { env: GATE_ON })).toBe('es');
    for (const v of NOT_ON) {
      expect(dispatchCopyLocale('fr-CA', { env: { FR_CA_ENABLED: v } as NodeJS.ProcessEnv, ready: true })).toBe('es');
    }
  });

  it("'fr-CA' selects French only with readiness AND gate (future activation path)", () => {
    expect(dispatchCopyLocale('fr-CA', { env: GATE_ON, ready: true })).toBe('fr-CA');
  });

  it.each(LEGACY)('legacy/invalid value %p selects Spanish, exactly as before', (v) => {
    expect(dispatchCopyLocale(v)).toBe('es');
    expect(dispatchCopyLocale(v, { env: GATE_ON, ready: true })).toBe('es');
  });
});

describe('resolveMessageLocale — N-1 design, isolated (not used by dispatch)', () => {
  it('fallback is es (B2-D4 recommendation, pending PO)', () => {
    expect(N1_FALLBACK_LOCALE).toBe('es');
  });

  it('valid es/en map to themselves with canonical html lang', () => {
    expect(resolveMessageLocale('es')).toEqual({ locale: 'es', htmlLang: 'es' });
    expect(resolveMessageLocale('en')).toEqual({ locale: 'en', htmlLang: 'en' });
  });

  it.each(LEGACY)('legacy/invalid %p normalizes to the fallback and never echoes the raw value', (v) => {
    const r = resolveMessageLocale(v);
    expect(r).toEqual({ locale: 'es', htmlLang: 'es' });
  });

  it('fr-CA: fallback while inactive, French when ready and gated on', () => {
    expect(resolveMessageLocale('fr-CA', { env: GATE_ON })).toEqual({ locale: 'es', htmlLang: 'es' });
    expect(resolveMessageLocale('fr-CA', { env: GATE_ON, ready: true })).toEqual({ locale: 'fr-CA', htmlLang: 'fr-CA' });
  });

  it('canonical html lang map', () => {
    expect(HTML_LANG).toEqual({ es: 'es', en: 'en', 'fr-CA': 'fr-CA' });
  });

  it('is not referenced by EmailService (N-1 is not wired to dispatch)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../../src/email/email.service.ts'), 'utf8');
    expect(src).not.toMatch(/resolveMessageLocale|N1_FALLBACK_LOCALE|HTML_LANG/);
    expect(src).toMatch(/dispatchCopyLocale/);
  });
});
