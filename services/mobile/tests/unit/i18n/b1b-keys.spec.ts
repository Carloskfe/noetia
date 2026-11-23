// NEM-025 B1-B: quality checks for the keys added to the mobile dictionaries.
import { en } from '../../../src/i18n/en';
import { es } from '../../../src/i18n/es';
import { frCA } from '../../../src/i18n/fr-ca';

const ALL = { es, en, 'fr-CA': frCA };

describe('B1-B mobile dictionary keys', () => {
  it('keeps every Spanish value identical to the literal it replaced', () => {
    expect(es.nav).toEqual({ library: 'Biblioteca', clubs: 'Clubes', fragments: 'Fragmentos', account: 'Cuenta', club: 'Club' });
    expect(es.auth.social.divider).toBe('o continúa con');
    expect(es.auth.social.google).toBe('Continuar con Google');
    expect(es.auth.social.facebook).toBe('Continuar con Facebook');
    expect(es.auth.social.errors).toEqual({
      googleConnect: 'Error al conectar con Google. Inténtalo de nuevo.',
      googleNoToken: 'No se recibió token de Google.',
      googleSignIn: 'Error al iniciar sesión con Google.',
      facebookConnect: 'Error al conectar con Facebook. Inténtalo de nuevo.',
      facebookNoToken: 'No se recibió token de Facebook.',
      facebookSignIn: 'Error al iniciar sesión con Facebook.',
      facebookNotConfigured: 'Facebook no está configurado.',
      appleSignIn: 'Error al iniciar sesión con Apple.',
    });
    expect(es.reader.audioLoadError).toBe('No se pudo cargar el audio.');
    expect(es.common.loading).toBe('Cargando…');
    expect(es.library.title).toBe('Biblioteca');
    expect(es.common.errorTitle).toBe('Error');
    expect(es.clubs.live.listening(2)).toBe('2 escuchando');
    expect(es.clubs.live.connecting).toBe('Conectando…');
    expect(es.clubs.live.phrases(10, 40)).toBe('Frases 10–40');
    expect(es.clubs.live.syncing).toBe('Sincronizando…');
    expect(es.clubs.live.paused).toBe('En pausa');
    expect(es.clubs.live.you).toBe('Tú');
    expect(es.clubs.live.chatTitle).toBe('Chat en vivo');
  });

  it('interpolates counts and phrase ranges in every language', () => {
    for (const [lang, t] of Object.entries(ALL)) {
      for (const n of [0, 1, 2, 20]) {
        expect(t.clubs.live.listening(n)).toContain(String(n));
      }
      const range = t.clubs.live.phrases(3, 9);
      expect(range).toMatch(/3–9$/);
      expect(range).not.toContain('undefined');
      // A session without indexes rendered "Frases –" before B1-B; the helper keeps that.
      expect(t.clubs.live.phrases(undefined, undefined)).not.toContain('undefined');
      expect(lang).toBeTruthy();
    }
  });

  it('uses count-invariant wording, so no plural form is needed', () => {
    // "escuchando", "listening" and "à l’écoute" do not inflect with the count.
    expect(es.clubs.live.listening(1)).toBe('1 escuchando');
    expect(en.clubs.live.listening(1)).toBe('1 listening');
    expect(frCA.clubs.live.listening(1)).toBe('1 à l’écoute');
  });

  it('describes each language option in the interface language', () => {
    expect(es.lang.sublabels).toEqual({ es: 'Latinoamérica', en: 'Inglés', 'fr-CA': 'Francés (Canadá)' });
    expect(en.lang.sublabels).toEqual({ es: 'Latin America', en: 'English', 'fr-CA': 'French (Canada)' });
    expect(frCA.lang.sublabels).toEqual({ es: 'Amérique latine', en: 'Anglais', 'fr-CA': 'Français (Canada)' });
  });

  it('uses French typography: typographic apostrophe, accents and the ellipsis character', () => {
    const fr = JSON.stringify([frCA.nav, frCA.auth.social, frCA.clubs.live.errors, frCA.reader.audioLoadError, frCA.lang.sublabels])
      + frCA.clubs.live.listening(2) + frCA.clubs.live.connecting;
    expect(fr).not.toMatch(/\w'\w/);           // no straight apostrophe inside words
    expect(fr).toContain('’');
    expect(fr).toMatch(/[éèàç]/);
    expect(fr).not.toContain('...');           // the … character, never three dots
    expect(frCA.clubs.live.connecting).toBe('Connexion…');
  });

  it('avoids "jeton" for social sign-in tokens (reserved for the subscription token)', () => {
    expect(JSON.stringify(frCA.auth.social)).not.toMatch(/jeton/i);
  });

  it('flags French strings much longer than English (text-expansion risk, for visual QA)', () => {
    const pairs: Array<[string, string]> = [
      [en.nav.library, frCA.nav.library], [en.nav.account, frCA.nav.account],
      [en.auth.social.google, frCA.auth.social.google], [en.clubs.live.chatTitle, frCA.clubs.live.chatTitle],
    ];
    // Tab labels must stay short enough for the bottom tab bar (11 pt).
    expect(frCA.nav.library.length).toBeLessThanOrEqual(12);
    expect(frCA.nav.account.length).toBeLessThanOrEqual(12);
    const ratios = pairs.map(([a, b]) => b.length / a.length);
    expect(Math.max(...ratios)).toBeLessThan(2.5);
  });
});
