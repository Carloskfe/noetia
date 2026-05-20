import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'en' || saved === 'es') setLang(saved);
      setIsLoaded(true);
    });
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLang(lang);
    await AsyncStorage.setItem(STORAGE_KEY, lang);
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
