'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

/**
 * Post-checkout landing page. Stripe webhooks remain the authoritative source of subscription state: this page
 * only READS it (POST /subscriptions/sync re-reads Stripe for a subscription the webhook already recorded, then
 * GET /subscriptions/me is polled a bounded number of times). It never creates a subscription or a charge.
 *
 * Query parameters are UNTRUSTED: neither `?purchase=` nor `?session_id=` is verified here (PR #60 PA review, P1 —
 * server-side Checkout-session verification is a STOP-gated design awaiting PA review). So this page never claims
 * that a payment was received:
 *   - subscription: "Your subscription is active" only when the backend reports an entitled status — a statement
 *     about the ACCOUNT (re-read from Stripe by /subscriptions/sync), not proof that this Checkout session paid;
 *   - one-time purchases (tokens, book, gift): neutral "we're confirming your purchase" copy, conditional on the
 *     payment being confirmed. Fulfillment stays webhook-only; this page grants nothing.
 */
type View = 'checking' | 'confirmed' | 'pending' | 'problem' | 'auth' | 'error' | 'purchase';
type PurchaseKind = 'tokens' | 'book' | 'gift';

const ENTITLED = ['active', 'trialing', 'canceling'];
const OPTIONAL_AUTH = { redirectOnAuthFailure: false } as const;
const POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 3000;

const isAuthError = (e: unknown) => (e as { status?: number } | null)?.status === 401;

function purchaseKind(): PurchaseKind | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search).get('purchase');
  return p === 'tokens' || p === 'book' || p === 'gift' ? p : null;
}

function classify(status: unknown): 'confirmed' | 'problem' | 'none' {
  if (typeof status === 'string' && ENTITLED.includes(status)) return 'confirmed';
  if (status === 'past_due') return 'problem';
  return 'none';
}

export default function BillingSuccessPage() {
  const { t } = useTranslation();
  const s = t.billing.success;
  const [view, setView] = useState<View>('checking');
  const [kind] = useState<PurchaseKind | null>(purchaseKind);
  const run = useRef(0); // invalidates an in-flight verification when a new one starts or the page unmounts

  const verify = useCallback(async () => {
    const id = ++run.current;
    setView('checking');
    try {
      const synced = await apiFetch('/subscriptions/sync', { method: 'POST' }, OPTIONAL_AUTH);
      let outcome = classify(synced?.status);
      // The webhook may not have been processed yet: poll the recorded status, a bounded number of times.
      for (let attempt = 0; outcome === 'none' && attempt < POLL_ATTEMPTS; attempt++) {
        await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
        if (id !== run.current) return;
        const me = await apiFetch('/subscriptions/me', {}, OPTIONAL_AUTH);
        outcome = classify(me?.status);
      }
      if (id !== run.current) return;
      setView(outcome === 'none' ? 'pending' : outcome);
    } catch (e) {
      if (id !== run.current) return;
      setView(isAuthError(e) ? 'auth' : 'error');
    }
  }, []);

  useEffect(() => {
    if (kind) setView('purchase');
    else verify();
    // `run` is a counter, not a DOM ref: bumping its latest value on unmount is exactly the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { run.current++; };
  }, [kind, verify]);

  const primary = 'inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700';
  const secondary = 'inline-block px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50';
  const billingLink = <Link href="/account/billing" className={secondary}>{s.viewBilling}</Link>;

  let content: React.ReactNode;
  switch (view) {
    case 'checking':
      content = <p role="status" className="text-gray-500">{s.checking}</p>;
      break;
    case 'confirmed':
      content = (
        <>
          <div className="text-6xl mb-6" aria-hidden="true">🎉</div>
          <h1 className="text-3xl font-bold mb-3">{s.title}</h1>
          <p className="text-gray-500 mb-8">{s.body}</p>
          <Link href="/" className={primary}>{s.cta}</Link>
        </>
      );
      break;
    case 'purchase':
      content = (
        <>
          <h1 className="text-3xl font-bold mb-3">{s.purchaseTitle}</h1>
          <p className="text-gray-500 mb-8">{s.purchaseBody[kind ?? 'tokens']}</p>
          <Link href="/" className={primary}>{s.continue}</Link>
        </>
      );
      break;
    case 'pending':
      content = (
        <>
          <h1 className="text-2xl font-bold mb-3">{s.pendingTitle}</h1>
          <p role="status" className="text-gray-500 mb-8">{s.pendingBody}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={verify} className={primary}>{s.checkAgain}</button>
            {billingLink}
          </div>
        </>
      );
      break;
    case 'problem':
      content = (
        <>
          <h1 className="text-2xl font-bold mb-3">{s.problemTitle}</h1>
          <p role="alert" className="text-gray-500 mb-8">{s.problemBody}</p>
          <Link href="/account/billing" className={primary}>{s.viewBilling}</Link>
        </>
      );
      break;
    case 'auth':
      content = (
        <>
          <h1 className="text-2xl font-bold mb-3">{s.authTitle}</h1>
          <p className="text-gray-500 mb-8">{s.authBody}</p>
          <a href="/login?next=%2Fbilling%2Fsuccess" className={primary}>{s.signIn}</a>
        </>
      );
      break;
    default:
      content = (
        <>
          <h1 className="text-2xl font-bold mb-3">{s.errorTitle}</h1>
          <p role="alert" className="text-gray-500 mb-8">{s.errorBody}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={verify} className={primary}>{t.billing.retry}</button>
            {billingLink}
          </div>
        </>
      );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-24 text-center" data-view={view}>
      {content}
    </main>
  );
}
