'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

const MAX = 5;

const CATEGORIES = [
  { value: 'leadership', label: 'Liderazgo', emoji: '🏆' },
  { value: 'personal-development', label: 'Desarrollo Personal', emoji: '🌱' },
  { value: 'business', label: 'Negocios', emoji: '💼' },
  { value: 'finance', label: 'Finanzas', emoji: '💰' },
  { value: 'marketing', label: 'Marketing', emoji: '📣' },
  { value: 'psychology', label: 'Psicología', emoji: '🧠' },
  { value: 'science', label: 'Ciencia', emoji: '🔬' },
  { value: 'history', label: 'Historia', emoji: '📜' },
  { value: 'fiction', label: 'Ficción', emoji: '🌌' },
  { value: 'self-help', label: 'Autoayuda', emoji: '✨' },
  { value: 'health', label: 'Salud & Bienestar', emoji: '🏃' },
  { value: 'spirituality', label: 'Espiritualidad', emoji: '🕊️' },
  { value: 'philosophy', label: 'Filosofía', emoji: '💡' },
  { value: 'biography', label: 'Biografías', emoji: '📰' },
  { value: 'technology', label: 'Tecnología', emoji: '💻' },
];

export default function InterestsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggle(value: string) {
    setSelected((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= MAX) return prev;
      return [...prev, value];
    });
  }

  async function handleContinue() {
    if (selected.length === 0) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ interests: selected }),
      });
      router.push('/library');
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg mx-auto">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-1 rounded-full bg-blue-600" />
          <div className="w-8 h-1 rounded-full bg-blue-600" />
          <div className="w-8 h-1 rounded-full bg-blue-600" />
        </div>

        <h1 className="text-2xl font-bold text-center mb-1">¿Qué te interesa leer?</h1>
        <p className="text-gray-500 text-center mb-2">
          Elige hasta {MAX} categorías para personalizar tu biblioteca.
        </p>
        <p className="text-center text-sm font-medium text-blue-600 mb-8">
          {selected.length}/{MAX} seleccionadas
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {CATEGORIES.map((cat) => {
            const isSelected = selected.includes(cat.value);
            const isDisabled = !isSelected && selected.length >= MAX;
            return (
              <button
                key={cat.value}
                onClick={() => toggle(cat.value)}
                disabled={isDisabled}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50'
                    : isDisabled
                    ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-sm font-medium text-gray-800 leading-tight">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={selected.length === 0 || loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition"
        >
          {loading ? 'Guardando…' : 'Ir a mi biblioteca'}
        </button>
      </div>
    </div>
  );
}
