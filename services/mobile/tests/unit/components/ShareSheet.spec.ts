import { ShareSheet, buildShareContent, shareErrorMessage } from '../../../src/components/ShareSheet';
import { en } from '../../../src/i18n/en';
import { es } from '../../../src/i18n/es';

describe('ShareSheet', () => {
  it('exports a React function component', () => {
    expect(typeof ShareSheet).toBe('function');
  });
});

describe('buildShareContent (G10 — Android link sharing)', () => {
  const page = 'https://noetia.app/s/AbCdEf1234';

  it('puts the share-page link inside the message on Android (RN ignores `url` there)', () => {
    expect(buildShareContent('Una cita', page, 'android')).toEqual({ message: `Una cita\n\n${page}` });
  });

  it('passes the link as `url` on iOS without duplicating it in the message', () => {
    expect(buildShareContent('Una cita', page, 'ios')).toEqual({ message: 'Una cita', url: page });
  });

  it('never shares the raw image URL as the link', () => {
    const out = buildShareContent('q', page, 'android');
    expect(out.message).toContain('/s/');
    expect(out.message).not.toContain('/images/');
  });
});

describe('shareErrorMessage', () => {
  const strings = en.sharing;

  it('explains a refused (edited) quote', () => {
    expect(shareErrorMessage({ status: 422, data: { error: 'quote_not_in_source' } }, strings)).toBe(strings.errorQuoteNotInSource);
  });

  it('gives specific guidance for omission refusals', () => {
    expect(shareErrorMessage({ status: 422, data: { error: 'quote_not_in_source', reason: 'omission_marker_required' } }, strings)).toBe(strings.errorOmissionMarker);
    expect(shareErrorMessage({ status: 422, data: { error: 'quote_not_in_source', reason: 'omission_may_distort' } }, strings)).toBe(strings.errorOmissionMeaning);
    expect(shareErrorMessage({ status: 422, data: { error: 'quote_not_in_source', reason: 'omission_too_long' } }, strings)).toBe(strings.errorOmissionMeaning);
  });

  it('explains an unshareable book', () => {
    expect(shareErrorMessage({ status: 422, data: { error: 'book_not_shareable' } }, strings)).toBe(strings.errorBookNotShareable);
  });

  it('explains rate limiting', () => {
    expect(shareErrorMessage({ status: 429, data: { error: 'rate_limited' } }, strings)).toBe(strings.errorRateLimited);
  });

  it('falls back to the generic error', () => {
    expect(shareErrorMessage(new Error('network'), strings)).toBe(strings.error);
    expect(shareErrorMessage(null, strings)).toBe(strings.error);
  });

  it('has Spanish copy for every share error', () => {
    for (const k of ['errorQuoteNotInSource', 'errorOmissionMarker', 'errorOmissionMeaning', 'errorBookNotShareable', 'errorRateLimited'] as const) {
      expect(es.sharing[k]).toBeTruthy();
      expect(es.sharing[k]).not.toBe(en.sharing[k]);
    }
  });
});
