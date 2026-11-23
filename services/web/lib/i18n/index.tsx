'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { en } from './en';
import { es } from './es';
import { frCA } from './fr-ca';
import type { Translations } from './en';
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
const translations: Record<Language, Translations> = { es, en, 'fr-CA': frCA };

interface LanguageContextValue {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  t: es,
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const lang = resolveStoredLanguage(localStorage.getItem(STORAGE_KEY));
    setLang(lang);
    document.documentElement.lang = lang;

    // Sync from API — server-side preference wins over stale localStorage
    const token = localStorage.getItem('noetia_token');
    if (token) {
      fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((user) => {
          if (!user) return;
          const resolved = resolveServerLanguage(user.uiLanguage, lang);
          if (resolved === lang) return;
          setLang(resolved);
          localStorage.setItem(STORAGE_KEY, resolved);
          document.documentElement.lang = resolved;
        })
        .catch(() => {});
    }
  }, []);

  const setLanguage = useCallback((requested: Language) => {
    // Fail closed: a language that is not selectable (fr-CA while the readiness gate is off) is ignored.
    const lang = normalizeLanguage(requested);
    if (!lang) return;
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
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  return resolveStoredLanguage(localStorage.getItem(STORAGE_KEY));
}
