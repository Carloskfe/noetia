'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import CauseSelector from '@/components/CauseSelector';
import { apiFetch } from '@/lib/api';
import { formatUsd } from '@/lib/currency';
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

/**
 * Causas preference lookup outcome:
 * - `saved`: a preference record exists;
 * - `none`: the API answered 200 with an EMPTY body (no saved choice — apiFetch maps it to `{}`);
 * - `auth`: the session could not be authenticated, even after the refresh attempt;
 * - `error`: any other failure — we do not know whether a choice exists, so the page must not imply the
 *   equal-split default nor risk overwriting a saved cause.
 */
type PreferenceState = 'saved' | 'none' | 'auth' | 'error';

// /pricing is public: protected calls use optional authentication and never bounce a guest to /login on load.
const OPTIONAL_AUTH = { redirectOnAuthFailure: false } as const;
const LOGIN_FOR_PRICING = '/login?next=/pricing';

const isAuthError = (e: unknown) => (e as { status?: number } | null)?.status === 401;

/**
 * Subscription status (GET /subscriptions/me) outcome, tracked separately from the Causas lookup:
 * - `known`: the API answered; `planId` is the plan that still holds a live Stripe subscription, if any;
 * - `unknown`: a server or network failure — we cannot tell whether the user already subscribes, so no new
 *   subscription checkout may be created until a retry succeeds (the API does not block duplicates);
 * - `auth`: no authenticated session (guest), even after the refresh attempt.
 */
type StatusState = 'known' | 'unknown' | 'auth';
type StatusResult = { state: StatusState; planId: string | null };

// Statuses that still hold a Stripe subscription: starting another checkout for these would duplicate it.
// `canceled` / `none` leave the plan purchasable again.
const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'canceling', 'past_due'];

async function loadStatus(): Promise<StatusResult> {
  try {
    const s = await apiFetch('/subscriptions/me', {}, OPTIONAL_AUTH);
    const live = !!s && LIVE_SUBSCRIPTION_STATUSES.includes(s.status);
    return { state: 'known', planId: live ? s.planId ?? null : null };
  } catch (e) {
    return { state: isAuthError(e) ? 'auth' : 'unknown', planId: null };
  }
}

async function loadPreference(): Promise<PreferenceState> {
  try {
    const pref = await apiFetch('/causes/preferences', {}, OPTIONAL_AUTH);
    return pref && typeof pref === 'object' && 'cause1Id' in pref ? 'saved' : 'none';
  } catch (e) {
    return isAuthError(e) ? 'auth' : 'error';
  }
}

// USD, always marked explicitly (PO decision 2026-11-13) — see lib/currency.
const formatPrice = formatUsd;

export default function PricingPage() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [error, setError] = useState<string | null>(null);
  const [errorShowsBilling, setErrorShowsBilling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [preference, setPreference] = useState<PreferenceState>('auth');
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [lookupFailedPlanId, setLookupFailedPlanId] = useState<string | null>(null);
  const [retryingLookup, setRetryingLookup] = useState(false);
  const [buyingPackageId, setBuyingPackageId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState>('auth');
  const statusRef = useRef<StatusState>('auth'); // read by checkout(), which callbacks may hold from an earlier render
  const [statusFailedPlanId, setStatusFailedPlanId] = useState<string | null>(null);
  const [retryingStatus, setRetryingStatus] = useState(false);

  function applyStatus(s: StatusResult) {
    statusRef.current = s.state;
    setStatus(s.state);
    setCurrentPlanId(s.planId);
  }

  useEffect(() => {
    // Public catalogue: plain fetch, no authentication required.
    const catalogue = Promise.all([
      fetch('/api/subscriptions/plans').then((r) => r.ok ? r.json() : []),
      fetch('/api/subscriptions/token-packages').then((r) => r.ok ? r.json() : []),
    ]);
    // Optional session: apiFetch sends the Bearer token; with an absent/expired token it tries the
    // httpOnly refresh cookie once. Sequential so a guest costs one 401 + one refresh, never a redirect.
    const session = (async () => {
      const st = await loadStatus();
      if (st.state === 'auth') return { signedIn: false, status: st, preference: 'auth' as PreferenceState };
      const pref = await loadPreference();
      // A successful Causas lookup proves the session, never the subscription status: `status` stays as loaded.
      return { signedIn: st.state === 'known' || pref !== 'auth', status: st, preference: pref };
    })();

    Promise.all([catalogue, session]).then(([[fetchedPlans, fetchedPackages], s]) => {
      setPlans(fetchedPlans);
      setPackages(fetchedPackages);
      setSignedIn(s.signedIn);
      applyStatus(s.status);
      setPreference(s.preference);
    }).finally(() => setLoading(false));
  }, []);

  const displayed = plans.filter((p) => p.interval === interval);

  function goToLogin() {
    window.location.href = LOGIN_FOR_PRICING;
  }

  async function checkout(planId: string) {
    setError(null);
    setErrorShowsBilling(false);
    if (statusRef.current !== 'known') return setStatusFailedPlanId(planId); // never checkout on an unknown status
    try {
      const { url } = await apiFetch(
        '/subscriptions/checkout',
        { method: 'POST', body: JSON.stringify({ planId }) },
        OPTIONAL_AUTH,
      );
      if (!url) throw new Error('No checkout URL');
      window.location.href = url;
    } catch (e) {
      if (isAuthError(e)) return goToLogin();
      // The API refuses a second subscription (409) and refuses to guess when Stripe is unreachable (503).
      const code = (e as { data?: { error?: string } } | null)?.data?.error;
      if (code === 'subscription_exists') {
        setError(t.pricing.subscriptionExists);
        setErrorShowsBilling(true);
      } else if (code === 'checkout_pending') setError(t.pricing.checkoutPending);
      else if (code === 'subscription_status_unavailable') setError(t.pricing.statusUnavailable);
      else setError(t.pricing.paymentError);
    }
  }

  async function buyTokenPackage(packageId: string) {
    setError(null);
    setErrorShowsBilling(false);
    setBuyingPackageId(packageId);
    try {
      const { url } = await apiFetch(
        '/subscriptions/tokens/purchase',
        { method: 'POST', body: JSON.stringify({ packageId }) },
        OPTIONAL_AUTH,
      );
      if (!url) throw new Error('No checkout URL');
      window.location.href = url;
    } catch (e) {
      if (isAuthError(e)) goToLogin();
      else setError(t.pricing.paymentError);
    } finally {
      setBuyingPackageId(null);
    }
  }

  function routeByPreference(planId: string, pref: PreferenceState) {
    if (pref === 'auth') return goToLogin();
    if (pref === 'saved') return checkout(planId);
    if (pref === 'none') return setPendingPlanId(planId);
    setLookupFailedPlanId(planId); // unknown: offer retry, or continue without changing the preference
  }

  function handleSelect(planId: string) {
    if (!signedIn) return goToLogin();
    if (status !== 'known') return setStatusFailedPlanId(planId);
    routeByPreference(planId, preference);
  }

  /** Re-checks the subscription status; when a plan was chosen, continues the normal flow on success. */
  async function retryStatus() {
    const planId = statusFailedPlanId;
    setRetryingStatus(true);
    const st = await loadStatus();
    setRetryingStatus(false);
    if (st.state === 'unknown') return; // keep the notice (and banner) up
    setStatusFailedPlanId(null);
    applyStatus(st);
    if (st.state === 'auth') return goToLogin();
    if (planId && planId !== st.planId) routeByPreference(planId, preference);
  }

  async function retryLookup() {
    const planId = lookupFailedPlanId;
    if (!planId) return;
    setRetryingLookup(true);
    const pref = await loadPreference();
    setRetryingLookup(false);
    setPreference(pref);
    if (pref === 'error') return; // keep the notice open
    setLookupFailedPlanId(null);
    routeByPreference(planId, pref);
  }

  function continueWithoutChanging() {
    const planId = lookupFailedPlanId;
    setLookupFailedPlanId(null);
    if (planId) checkout(planId);
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

      {error && (
        <p role="alert" data-testid="pricing-error" className="text-center text-red-600 mb-6 text-sm">
          {error}
          {errorShowsBilling && (
            <>
              {' '}
              <Link href="/account/billing" className="underline font-medium">{t.pricing.goToBilling}</Link>
            </>
          )}
        </p>
      )}

      {!loading && signedIn && status === 'unknown' && (
        <div
          data-testid="status-unknown-banner"
          role="status"
          className="max-w-xl mx-auto mb-8 flex flex-col sm:flex-row items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="flex-1 text-center sm:text-left">{t.pricing.statusCheck.banner}</p>
          <button
            type="button"
            onClick={retryStatus}
            disabled={retryingStatus}
            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium hover:bg-amber-100 disabled:opacity-50 transition"
          >
            {retryingStatus ? t.pricing.statusCheck.retrying : t.pricing.statusCheck.retry}
          </button>
        </div>
      )}

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
          onSave={() => { setPreference('saved'); checkout(pendingPlanId); setPendingPlanId(null); }}
          onSkip={() => { checkout(pendingPlanId); setPendingPlanId(null); }}
        />
      )}

      {/* Preference lookup failed: never assume the equal-split default or overwrite a saved choice */}
      {lookupFailedPlanId && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pref-lookup-title"
            data-testid="pref-lookup-dialog"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6"
          >
            <h2 id="pref-lookup-title" className="text-lg font-semibold text-gray-900 mb-2">{t.pricing.prefLookup.title}</h2>
            <p role="alert" className="text-sm text-gray-600 leading-relaxed mb-5">{t.pricing.prefLookup.body}</p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={retryLookup}
                disabled={retryingLookup}
                className="w-full py-3 rounded-xl bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 transition"
              >
                {retryingLookup ? t.pricing.prefLookup.retrying : t.pricing.prefLookup.retry}
              </button>
              <button
                type="button"
                onClick={continueWithoutChanging}
                disabled={retryingLookup}
                className="w-full py-3 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {t.pricing.prefLookup.continue}
              </button>
              <button
                type="button"
                onClick={() => setLookupFailedPlanId(null)}
                disabled={retryingLookup}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription status unknown: block a new subscription checkout until the status is confirmed */}
      {statusFailedPlanId && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-check-title"
            data-testid="status-check-dialog"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6"
          >
            <h2 id="status-check-title" className="text-lg font-semibold text-gray-900 mb-2">{t.pricing.statusCheck.title}</h2>
            <p role="alert" className="text-sm text-gray-600 leading-relaxed mb-5">{t.pricing.statusCheck.body}</p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={retryStatus}
                disabled={retryingStatus}
                className="w-full py-3 rounded-xl bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 transition"
              >
                {retryingStatus ? t.pricing.statusCheck.retrying : t.pricing.statusCheck.retry}
              </button>
              <button
                type="button"
                onClick={() => setStatusFailedPlanId(null)}
                disabled={retryingStatus}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
