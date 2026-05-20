'use client';

import { useTranslation, type Language } from '@/lib/i18n';

interface Props {
  className?: string;
}

const FLAGS: Record<Language, string> = { es: '🇪🇸', en: '🇺🇸' };

export default function LanguagePicker({ className = '' }: Props) {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div className={`inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm ${className}`}>
      {(['es', 'en'] as Language[]).map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`px-3 py-1.5 font-medium transition ${
            language === lang
              ? 'bg-slate-900 text-white'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          {FLAGS[lang]} {t.lang[lang]}
        </button>
      ))}
    </div>
  );
}
