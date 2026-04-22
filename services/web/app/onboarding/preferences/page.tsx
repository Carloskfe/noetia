'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

const COUNTRIES = [
  { value: 'AR', label: 'Argentina' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'CU', label: 'Cuba' },
  { value: 'DO', label: 'República Dominicana' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'HN', label: 'Honduras' },
  { value: 'MX', label: 'México' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'PA', label: 'Panamá' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'PE', label: 'Perú' },
  { value: 'PR', label: 'Puerto Rico' },
  { value: 'ES', label: 'España' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'VE', label: 'Venezuela' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'OTHER', label: 'Otro' },
];

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
];

export default function PreferencesPage() {
  const router = useRouter();
  const [country, setCountry] = useState('');
  const [languages, setLanguages] = useState<string[]>(['es']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleLanguage(value: string) {
    setLanguages((prev) =>
      prev.includes(value) ? prev.filter((l) => l !== value) : [...prev, value],
    );
  }

  async function handleContinue() {
    if (!country || languages.length === 0) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ country, languages }),
      });
      router.push('/onboarding/interests');
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-1 rounded-full bg-blue-600" />
          <div className="w-8 h-1 rounded-full bg-blue-600" />
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>

        <h1 className="text-2xl font-bold text-center mb-1">¿Dónde estás?</h1>
        <p className="text-gray-500 text-center mb-8">
          Esto nos ayuda a personalizar tu experiencia.
        </p>

        {/* Country */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">País</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full border-2 rounded-xl px-4 py-3 text-gray-900 bg-white focus:outline-none focus:border-blue-600 transition"
          >
            <option value="">Selecciona tu país</option>
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Language */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Idiomas de lectura
          </label>
          <div className="flex gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                onClick={() => toggleLanguage(lang.value)}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition ${
                  languages.includes(lang.value)
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={!country || languages.length === 0 || loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition"
        >
          {loading ? 'Guardando…' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
