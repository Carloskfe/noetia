import { en } from '../../../src/i18n/en';
import { es } from '../../../src/i18n/es';
import { frCA } from '../../../src/i18n/fr-ca';
import { liveSessionErrorMessage } from '../../../src/i18n/errors';

describe('liveSessionErrorMessage', () => {
  it('returns an empty string when there is no error', () => {
    expect(liveSessionErrorMessage(en, '')).toBe('');
    expect(liveSessionErrorMessage(en, null)).toBe('');
    expect(liveSessionErrorMessage(en, undefined)).toBe('');
  });

  it('maps the gateway messages to localized text', () => {
    expect(liveSessionErrorMessage(es, 'Not a club member')).toBe('No eres miembro de este club.');
    expect(liveSessionErrorMessage(en, 'Session not found')).toBe('Session not found.');
    expect(liveSessionErrorMessage(frCA, 'Room not found')).toBe('Séance introuvable.');
  });

  it('never shows an unknown raw server message', () => {
    const raw = 'TypeError: cannot read properties of undefined';
    for (const t of [es, en, frCA]) {
      const msg = liveSessionErrorMessage(t, raw);
      expect(msg).toBe(t.clubs.live.errors.generic);
      expect(msg).not.toContain('TypeError');
    }
  });
});
