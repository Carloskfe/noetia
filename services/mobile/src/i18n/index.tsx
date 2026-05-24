import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { en, type MobileTranslations } from './en';
import { es } from './es';

export type Language = 'es' | 'en';
const STORAGE_KEY = 'noetia_lang';
const translations: Record<Language, MobileTranslations> = { es, en };

interface LanguageContextValue {
  language: Language;
  t: MobileTranslations;
  setLanguage: (lang: Language) => Promise<void>;
  isLoaded: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'es',
  t: es,
  setLanguage: async () => {},
  isLoaded: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>('es');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(async (saved) => {
      if (saved === 'en' || saved === 'es') setLang(saved);
      setIsLoaded(true);

      // Sync from API — server-side preference wins over stale local storage
      try {
        const user = await apiClient.get<{ uiLanguage?: string }>('/users/me');
        if (user?.uiLanguage === 'en' || user?.uiLanguage === 'es') {
          setLang(user.uiLanguage);
          AsyncStorage.setItem(STORAGE_KEY, user.uiLanguage);
        }
      } catch {
        // Not logged in or network error — local preference stays
      }
    });
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
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
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  return saved === 'en' ? 'en' : 'es';
}

export async function hasStoredLanguage(): Promise<boolean> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  return saved === 'en' || saved === 'es';
}
