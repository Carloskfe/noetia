'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

const PACKAGES = [
  { tokenCount: 1 as const, amountCents: 999 },
  { tokenCount: 3 as const, amountCents: 2499 },
];

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function GiftPage() {
  const { t } = useTranslation();
  const [tokenCount, setTokenCount] = useState<1 | 3>(1);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [occasion, setOccasion] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const OCCASIONS = [
    { value: 'birthday',    label: t.giftCard.send.occasions.birthday },
    { value: 'graduation',  label: t.giftCard.send.occasions.graduation },
    { value: 'just',        label: t.giftCard.send.occasions.just },
    { value: 'celebration', label: t.giftCard.send.occasions.celebration },
    { value: 'reading',     label: t.giftCard.send.occasions.reading },
  ];

  const PKG_LABELS = {
    1: { label: '1 Token', description: t.giftCard.send.unlocks1 },
    3: { label: '3 Tokens', description: t.giftCard.send.unlocks3 },
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/gifts/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          tokenCount,
          occasion: occasion || undefined,
          message: message.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError(t.giftCard.send.error);
      setLoading(false);
    }
  }

  const selected = PACKAGES.find(p => p.tokenCount === tokenCount)!;

  return (
    <main className="max-w-lg mx-auto px-4 py-14">
      <div className="text-center mb-10">
        <p className="text-3xl mb-2">🎁</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.giftCard.send.title}</h1>
        <p className="text-gray-500 text-sm">{t.giftCard.send.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Token amount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">{t.giftCard.send.howMany}</label>
          <div className="grid grid-cols-2 gap-3">
            {PACKAGES.map(pkg => {
              const meta = PKG_LABELS[pkg.tokenCount];
              return (
                <button
                  key={pkg.tokenCount}
                  type="button"
                  onClick={() => setTokenCount(pkg.tokenCount)}
                  className={`rounded-xl border-2 p-4 text-left transition ${
                    tokenCount === pkg.tokenCount
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <p className="text-2xl font-black mb-0.5">{meta.label}</p>
                  <p className={`text-xs mb-2 ${tokenCount === pkg.tokenCount ? 'text-slate-300' : 'text-gray-400'}`}>
                    {meta.description}
                  </p>
                  <p className={`text-lg font-bold ${tokenCount === pkg.tokenCount ? 'text-white' : 'text-gray-800'}`}>
                    {formatPrice(pkg.amountCents)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recipient */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t.giftCard.send.recipientEmail}</label>
          <input
            type="email"
            required
            placeholder={t.giftCard.send.recipientPlaceholder}
            value={recipientEmail}
            onChange={e => setRecipientEmail(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {/* Occasion */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t.giftCard.send.occasion}</label>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOccasion(occasion === o.value ? '' : o.value)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  occasion === o.value ? 'bg-slate-900 text-white border-slate-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t.giftCard.send.personalMessage}</label>
          <textarea
            rows={3}
            maxLength={300}
            placeholder={t.giftCard.send.messagePlaceholder}
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/300</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !recipientEmail}
          className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-semibold text-base hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {loading ? t.giftCard.send.submitting : t.giftCard.send.submit(PKG_LABELS[tokenCount].label, formatPrice(selected.amountCents))}
        </button>

        <p className="text-xs text-center text-gray-400">{t.giftCard.send.footer}</p>
      </form>

      <div className="mt-8 text-center">
        <Link href="/pricing" className="text-sm text-gray-400 hover:text-gray-600">
          {t.giftCard.send.backToPlans}
        </Link>
      </div>
    </main>
  );
}
