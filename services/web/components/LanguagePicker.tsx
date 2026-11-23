'use client';

import { selectableLanguages, useTranslation, type Language } from '@/lib/i18n';

interface Props {
  className?: string;
}

// Flags are decorative only and never identify a language; fr-CA is shown by its label alone.
const FLAGS: Record<Language, string> = { es: '🌎', en: '🇺🇸', 'fr-CA': '' };

export default function LanguagePicker({ className = '' }: Props) {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div className={`inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm ${className}`}>
      {/* fr-CA appears only when the French readiness gate is enabled (default: hidden). */}
      {selectableLanguages().map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`px-3 py-1.5 font-medium transition ${
            language === lang
              ? 'bg-slate-900 text-white'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          {FLAGS[lang] ? `${FLAGS[lang]} ` : ''}{t.lang[lang]}
        </button>
      ))}
    </div>
  );
}
