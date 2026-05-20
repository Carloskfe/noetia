'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { en } from './en';
import { es } from './es';
import type { Translations } from './en';

export type Language = 'es' | 'en';
const STORAGE_KEY = 'noetia_lang';
const translations: Record<Language, Translations> = { es, en };

interface LanguageContextValue {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'es',
  t: es,
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>('es');

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Language) ?? 'es';
    setLang(saved === 'en' ? 'en' : 'es');
    document.documentElement.lang = saved;
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    // Sync to API if logged in
    const token = typeof window !== 'undefined' ? localStorage.getItem('noetia_token') : null;
    if (token) {
      fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uiLanguage: lang }),
      }).catch(() => {});
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, t: translations[language], setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'es';
  return (localStorage.getItem(STORAGE_KEY) as Language) ?? 'es';
}
