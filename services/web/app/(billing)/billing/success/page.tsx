'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Derived,
  MAX_STATUS_REQUESTS,
  SessionCopyKey,
  deriveFromError,
  deriveFromResponse,
  nextDelay,
  statusPath,
  successReturnPath,
} from '@/lib/checkout-status';
import { useTranslation } from '@/lib/i18n';

/**
 * Post-checkout landing page. Stripe webhooks remain the only fulfillment path: this page only READS state and
 * never creates a subscription, a charge, a fulfillment or an entitlement.
 *
 * With a Checkout `session_id` (G-1, design §R3/§R4): the page asks the server to verify THAT session
 * (`GET /subscriptions/checkout-sessions/:id/status`, authenticated, read-only) and chooses copy only from the
 * verified response (`lib/checkout-status.ts`). `?purchase=` never selects the kind or the state — its only effect
 * is the G-b gift rule: `?purchase=gift` sends no request and keeps the existing generic gift copy.
 *
 * Without a `session_id`, the earlier account-status flow is unchanged: POST /subscriptions/sync re-reads Stripe
 * for a subscription the webhook already recorded, then GET /subscriptions/me is polled a bounded number of
 * times; a one-time `?purchase=` without a session shows the neutral "we're confirming your purchase" copy.
 */
type View = 'checking' | 'confirmed' | 'pending' | 'problem' | 'auth' | 'error' | 'purchase' | 'session';
type PurchaseKind = 'tokens' | 'book' | 'gift';

const ENTITLED = ['active', 'trialing', 'canceling'];
const OPTIONAL_AUTH = { redirectOnAuthFailure: false } as const;
const POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 3000;

const isAuthError = (e: unknown) => (e as { status?: number } | null)?.status === 401;

function queryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

function purchaseKind(): PurchaseKind | null {
  const p = queryParam('purchase');
  return p === 'tokens' || p === 'book' || p === 'gift' ? p : null;
}

function classify(status: unknown): 'confirmed' | 'problem' | 'none' {
  if (typeof status === 'string' && ENTITLED.includes(status)) return 'confirmed';
  if (status === 'past_due') return 'problem';
  return 'none';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BillingSuccessPage() {
  const { t } = useTranslation();
  const s = t.billing.success;
  const [view, setView] = useState<View>('checking');
  const [kind] = useState<PurchaseKind | null>(purchaseKind);
  const [sessionId] = useState<string | null>(() => queryParam('session_id'));
  const [sessionCopy, setSessionCopy] = useState<SessionCopyKey>('unavailable');
  const run = useRef(0); // invalidates an in-flight verification when a new one starts or the page unmounts
  const inFlight = useRef<AbortController | null>(null);

  // Account-status flow without a session id: unchanged.
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

  // G-1 session flow: at most MAX_STATUS_REQUESTS reads per run; stops on a terminal state (§R3.5).
  const verifySession = useCallback(async () => {
    if (!sessionId) return;
    const id = ++run.current;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setView('checking');
    let last: Derived = { key: 'unavailable', terminal: false };
    for (let attempt = 0; attempt < MAX_STATUS_REQUESTS; attempt++) {
      let failure: unknown;
      try {
        last = deriveFromResponse(await apiFetch(statusPath(sessionId), { signal: controller.signal }, OPTIONAL_AUTH));
      } catch (e) {
        failure = e;
        last = deriveFromError(e);
      }
      if (id !== run.current) return; // abandoned (new run or unmounted): no state update
      if (last.terminal || attempt === MAX_STATUS_REQUESTS - 1) break;
      await sleep(nextDelay(attempt, failure));
      if (id !== run.current) return;
    }
    setSessionCopy(last.key);
    setView('session');
  }, [sessionId]);

  useEffect(() => {
    if (kind === 'gift') setView('purchase'); // G-b: no request, existing generic copy
    else if (sessionId) verifySession();
    else if (kind) setView('purchase');
    else verify();
    // `run` is a counter, not a DOM ref: bumping its latest value on unmount is exactly the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { run.current++; inFlight.current?.abort(); };
  }, [kind, sessionId, verify, verifySession]);

  const primary = 'inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700';
  const secondary = 'inline-block px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50';
  const billingLink = <Link href="/account/billing" className={secondary}>{s.viewBilling}</Link>;
  const signInHref = `/login?next=${encodeURIComponent(successReturnPath(sessionId, kind))}`;

  /**
   * Verified state → copy (§R4.4). New G-1 messages render WITHOUT a heading (no unapproved heading is added);
   * existing approved headings are used only where §R4.4 maps an existing view (subscription active / pending /
   * problem, sign-in).
   */
  function renderSession(): React.ReactNode {
    const st = s.status;
    const checkAgain = <button type="button" onClick={verifySession} className={primary}>{s.checkAgain}</button>;
    const toBilling = <Link href="/account/billing" className={primary}>{s.viewBilling}</Link>;
    const message = (text: string, actions: React.ReactNode) => (
      <>
        <p role="status" className="text-lg text-gray-700 mb-8" data-copy={sessionCopy}>{text}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">{actions}</div>
      </>
    );
    switch (sessionCopy) {
      case 'checkoutOpen': return message(st.checkoutOpen, checkAgain);
      case 'checkoutExpired': return message(st.checkoutExpired, <Link href="/" className={primary}>{s.continue}</Link>);
      case 'paymentNotConfirmed': return message(st.paymentNotConfirmed, checkAgain);
      case 'paidProcessingTokens': return message(st.paidProcessing.tokens, checkAgain);
      case 'tokenPaymentConfirmed': return message(st.tokenPaymentConfirmed, toBilling);
      case 'paidPendingBook': return message(st.paidPending.book, checkAgain);
      case 'deliveredBook': return message(st.delivered.book, <Link href="/library" className={primary}>{s.cta}</Link>);
      case 'unconfirmedBook': return message(st.unconfirmed.book, <Link href="/library" className={primary}>{s.continue}</Link>);
      case 'subscriptionEnded': return message(st.subscriptionEnded, toBilling);
      case 'subscriptionOther': return message(st.subscriptionOther, toBilling);
      case 'notFound': return message(st.notFound, <a href={signInHref} className={primary}>{s.signIn}</a>);
      case 'subscriptionActive':
        return (
          <>
            <h1 className="text-3xl font-bold mb-3">{s.title}</h1>
            <p className="text-gray-500 mb-8" data-copy="subscriptionActive">{st.subscriptionActive.body}</p>
            {toBilling}
          </>
        );
      case 'subscriptionPending':
        return (
          <>
            <h1 className="text-2xl font-bold mb-3">{s.pendingTitle}</h1>
            <p role="status" className="text-gray-500 mb-8" data-copy="subscriptionPending">{s.pendingBody}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">{checkAgain}{billingLink}</div>
          </>
        );
      case 'subscriptionProblem':
        return (
          <>
            <h1 className="text-2xl font-bold mb-3">{s.problemTitle}</h1>
            <p role="alert" className="text-gray-500 mb-8" data-copy="subscriptionProblem">{s.problemBody}</p>
            {toBilling}
          </>
        );
      case 'auth':
        return (
          <>
            <h1 className="text-2xl font-bold mb-3">{s.authTitle}</h1>
            <p className="text-gray-500 mb-8" data-copy="auth">{s.authBody}</p>
            <a href={signInHref} className={primary}>{s.signIn}</a>
          </>
        );
      default:
        return message(st.unavailable, checkAgain);
    }
  }

  let content: React.ReactNode;
  switch (view) {
    case 'checking':
      content = <p role="status" className="text-gray-500">{sessionId ? s.purchaseTitle : s.checking}</p>;
      break;
    case 'session':
      content = renderSession();
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
