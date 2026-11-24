import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredLanguage, hasStoredLanguage, selectableLanguages } from '../../../src/i18n';

jest.mock('../../../src/api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn() } }));

const ENV = 'EXPO_PUBLIC_FR_CA_ENABLED';

describe('mobile stored language preference (NEM-025 Checkpoint A)', () => {
  const prev = process.env[ENV];
  beforeEach(async () => {
    await AsyncStorage.removeItem('noetia_lang');
    delete process.env[ENV];
  });
  afterEach(() => {
    if (prev === undefined) delete process.env[ENV];
    else process.env[ENV] = prev;
  });

  it('keeps existing es/en preferences', async () => {
    await AsyncStorage.setItem('noetia_lang', 'en');
    expect(await getStoredLanguage()).toBe('en');
    expect(await hasStoredLanguage()).toBe(true);
    await AsyncStorage.setItem('noetia_lang', 'es');
    expect(await getStoredLanguage()).toBe('es');
  });

  it('defaults to es and reports no preference when nothing is stored', async () => {
    expect(await getStoredLanguage()).toBe('es');
    expect(await hasStoredLanguage()).toBe(false);
  });

  it('ignores a stored fr-CA value while French is gated, so the language picker is shown again', async () => {
    await AsyncStorage.setItem('noetia_lang', 'fr-CA');
    expect(await getStoredLanguage()).toBe('es');
    expect(await hasStoredLanguage()).toBe(false);
  });

  it('accepts a stored fr-CA value when the gate is enabled', async () => {
    process.env[ENV] = 'true';
    await AsyncStorage.setItem('noetia_lang', 'fr-CA');
    expect(await getStoredLanguage()).toBe('fr-CA');
    expect(await hasStoredLanguage()).toBe(true);
  });

  it('ignores malformed stored values', async () => {
    await AsyncStorage.setItem('noetia_lang', 'pt-BR');
    expect(await getStoredLanguage()).toBe('es');
    expect(await hasStoredLanguage()).toBe(false);
  });

  it('re-exports the gated selectable list', () => {
    expect(selectableLanguages()).toEqual(['es', 'en']);
  });
});
