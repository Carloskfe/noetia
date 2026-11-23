import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { en, type MobileTranslations } from './en';
import { es } from './es';
import { frCA } from './fr-ca';
import {
  DEFAULT_LANGUAGE,
  type Language,
  normalizeLanguage,
  resolveServerLanguage,
  resolveStoredLanguage,
} from './locales';

export type { Language } from './locales';
export { isFrenchEnabled, selectableLanguages, SUPPORTED_LANGUAGES } from './locales';

const STORAGE_KEY = 'noetia_lang';
const translations: Record<Language, MobileTranslations> = { es, en, 'fr-CA': frCA };

interface LanguageContextValue {
  language: Language;
  t: MobileTranslations;
  setLanguage: (lang: Language) => Promise<void>;
  isLoaded: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  t: es,
  setLanguage: async () => {},
  isLoaded: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>(DEFAULT_LANGUAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(async (saved) => {
      const local = resolveStoredLanguage(saved);
      setLang(local);
      setIsLoaded(true);

      // Sync from API — server-side preference wins over stale local storage
      try {
        const user = await apiClient.get<{ uiLanguage?: string }>('/users/me');
        if (!user) return;
        const resolved = resolveServerLanguage(user.uiLanguage, local);
        if (resolved !== local) {
          setLang(resolved);
          AsyncStorage.setItem(STORAGE_KEY, resolved);
        }
      } catch {
        // Not logged in or network error — local preference stays
      }
    });
  }, []);

  const setLanguage = useCallback(async (requested: Language) => {
    // Fail closed: a language that is not selectable (fr-CA while the readiness gate is off) is ignored.
    const lang = normalizeLanguage(requested);
    if (!lang) return;
    setLang(lang);
    await AsyncStorage.setItem(STORAGE_KEY, lang);
    apiClient.patch('/users/me', { uiLanguage: lang }).catch(() => {});
  }, []);

  return (
    <LanguageContext.Provider value={{ language, t: translations[language], setLanguage, isLoaded }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}

export async function getStoredLanguage(): Promise<Language> {
  return resolveStoredLanguage(await AsyncStorage.getItem(STORAGE_KEY));
}

export async function hasStoredLanguage(): Promise<boolean> {
  return normalizeLanguage(await AsyncStorage.getItem(STORAGE_KEY)) !== null;
}
