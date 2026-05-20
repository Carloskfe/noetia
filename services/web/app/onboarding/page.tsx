'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, saveUserType } from '@/lib/api';
import LanguagePicker from '@/components/LanguagePicker';
import { useTranslation } from '@/lib/i18n';

const TYPE_VALUES = ['personal', 'author', 'editorial'] as const;
type UserType = (typeof TYPE_VALUES)[number];
const TYPE_ICONS: Record<UserType, string> = { personal: '📖', author: '✍️', editorial: '🏢' };

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify({ userType: selected }) });
      saveUserType(selected);
      router.push(selected === 'personal' ? '/onboarding/preferences' : '/library');
    } catch (err: any) {
      if (err.status === 401) { router.replace('/login'); return; }
      setError(err.message ?? t.onboarding.userType.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        {/* Language picker — first decision */}
        <div className="flex justify-center mb-8">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700 mb-3">{t.lang.pick}</p>
            <LanguagePicker />
            <p className="text-xs text-gray-400 mt-2">{t.lang.subtitle}</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">{t.onboarding.userType.welcome}</h1>
        <p className="text-gray-500 text-center mb-8">{t.onboarding.userType.question}</p>

        <div className="space-y-3 mb-8">
          {TYPE_VALUES.map((value) => {
            const type = t.onboarding.userType.types[value];
            return (
              <button
                key={value}
                onClick={() => setSelected(value)}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition ${
                  selected === value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-2xl mt-0.5">{TYPE_ICONS[value]}</span>
                <div>
                  <p className="font-semibold text-gray-900">{type.label}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{type.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={!selected || loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition"
        >
          {loading ? t.onboarding.userType.submitting : t.onboarding.userType.submit}
        </button>
      </div>
    </div>
  );
}
