'use client';

import { useState } from 'react';
import { apiFetch, clearToken } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

interface Props {
  onClose: () => void;
}

export default function DeleteAccountModal({ onClose }: Props) {
  const { t } = useTranslation();
  const dm = t.account.deleteModal;
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const confirmed = input === dm.confirmWord;

  async function handleDelete() {
    if (!confirmed) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch('/users/me', { method: 'DELETE' });
      clearToken();
      localStorage.clear();
      window.location.href = '/';
    } catch {
      setError(dm.error);
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={dm.ariaLabel}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{dm.title}</h2>
            <p className="text-xs text-gray-500">{dm.warning}</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {dm.body}
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
          <p className="text-xs text-amber-800 leading-relaxed">
            {dm.warningBox}
          </p>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {dm.label}
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={dm.placeholder}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            autoComplete="off"
          />
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {dm.cancel}
          </button>
          <button
            onClick={handleDelete}
            disabled={!confirmed || loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 transition"
          >
            {loading ? dm.deleting : dm.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
