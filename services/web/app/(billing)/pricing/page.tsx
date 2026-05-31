'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CauseSelector from '@/components/CauseSelector';
import { useTranslation } from '@/lib/i18n';

type Plan = {
  id: string;
  name: string;
  amountCents: number;
  interval: string;
  tokensPerCycle: number;
  maxProfiles: number;
};

type TokenPackage = {
  id: string;
  name: string;
  tokenCount: number;
  amountCents: number;
};


function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PricingPage() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPreferences, setHasPreferences] = useState(true);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [buyingPackageId, setBuyingPackageId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/subscriptions/plans').then((r) => r.ok ? r.json() : []),
      fetch('/api/subscriptions/token-packages').then((r) => r.ok ? r.json() : []),
      fetch('/api/subscriptions/me').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/causes/preferences').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([fetchedPlans, fetchedPackages, status, prefs]) => {
      setPlans(fetchedPlans);
      setPackages(fetchedPackages);
      if (status?.planId) setCurrentPlanId(status.planId);
      setHasPreferences(!!prefs);
    }).finally(() => setLoading(false));
  }, []);

  const displayed = plans.filter((p) => p.interval === interval);

  async function checkout(planId: string) {
    setError(null);
    try {
      const res = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError(t.pricing.paymentError);
    }
  }

  async function buyTokenPackage(packageId: string) {
    setError(null);
    setBuyingPackageId(packageId);
    try {
      const res = await fetch('/api/subscriptions/tokens/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      if (res.status === 401) {
        window.location.href = `/login?returnUrl=${encodeURIComponent('/pricing')}`;
        return;
      }
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError(t.pricing.paymentError);
    } finally {
      setBuyingPackageId(null);
    }
  }

  async function handleSelect(planId: string) {
    if (!hasPreferences) {
      setPendingPlanId(planId);
    } else {
      await checkout(planId);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-14">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.pricing.title}</h1>
        <p className="text-gray-500 text-sm mb-1">{t.pricing.trial}</p>
        <p className="text-xs text-slate-400">
          {t.pricing.causasText}{' '}
          <Link href="/causas" className="underline hover:text-slate-600">{t.pricing.causasLink}</Link>.
        </p>
      </div>

      {/* Interval toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-xl bg-gray-100 p-1 gap-1">
          {(['month', 'year'] as const).map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                interval === iv ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {iv === 'month' ? t.pricing.monthly : t.pricing.annual}
              {iv === 'year' && <span className="ml-1.5 text-xs text-emerald-600 font-semibold">{t.pricing.twoMonthsFree}</span>}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-center text-red-600 mb-6 text-sm">{error}</p>}

      {/* Plans */}
      {loading ? (
        <p className="text-center text-gray-400 py-12">{t.pricing.loadingPlans}</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-6 mb-16">
          {displayed.map((plan) => {
            const meta = t.pricing.planDescriptions[plan.name] ?? { tagline: '', highlights: [] };
            const isCurrent = plan.id === currentPlanId;
            const isPopular = plan.name === 'Duo';
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 flex flex-col ${
                  isPopular ? 'border-blue-600 shadow-lg' : 'border-gray-200'
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t.pricing.popular}
                  </span>
                )}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">{plan.name}</p>
                <div className="mb-1">
                  <span className="text-3xl font-black text-gray-900">{formatPrice(plan.amountCents)}</span>
                  <span className="text-gray-400 text-sm">{interval === 'month' ? t.pricing.perMonth : t.pricing.perYear}</span>
                </div>
                {interval === 'year' && (
                  <p className="text-xs text-emerald-600 font-medium mb-2">
                    {t.pricing.equivalent} {formatPrice(Math.round(plan.amountCents / 12))}{t.pricing.perMonth}
                  </p>
                )}
                <p className="text-sm text-gray-500 mb-4">{meta.tagline}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {meta.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                      {h}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelect(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition ${
                    isCurrent
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : isPopular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {isCurrent ? t.pricing.currentPlan : t.pricing.startTrial}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Token packages */}
      {packages.length > 0 && (
        <div className="border-t border-gray-100 pt-12">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t.pricing.tokens.title}</h2>
            <p className="text-sm text-gray-500">{t.pricing.tokens.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-gray-900 mb-0.5">{pkg.tokenCount}</p>
                <p className="text-xs text-gray-400 mb-3">{pkg.tokenCount === 1 ? t.pricing.tokens.token : t.pricing.tokens.tokens}</p>
                <p className="text-base font-bold text-gray-800 mb-1">{formatPrice(pkg.amountCents)}</p>
                <p className="text-xs text-gray-400 mb-4">{formatPrice(Math.round(pkg.amountCents / pkg.tokenCount))} {t.pricing.tokens.each}</p>
                <button
                  onClick={() => buyTokenPackage(pkg.id)}
                  disabled={buyingPackageId === pkg.id}
                  className="w-full py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                >
                  {buyingPackageId === pkg.id ? t.pricing.tokens.redirecting : t.pricing.tokens.buy}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-gray-400 mt-4">{t.pricing.tokens.expiry}</p>
          <div className="mt-6 text-center">
            <Link href="/gift" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-full px-4 py-2 hover:border-gray-400 transition">
              {t.pricing.tokens.gift}
            </Link>
          </div>
        </div>
      )}

      {/* Cause selector */}
      {pendingPlanId && (
        <CauseSelector
          onSave={() => { setHasPreferences(true); checkout(pendingPlanId); setPendingPlanId(null); }}
          onSkip={() => { checkout(pendingPlanId); setPendingPlanId(null); }}
        />
      )}
    </main>
  );
}
