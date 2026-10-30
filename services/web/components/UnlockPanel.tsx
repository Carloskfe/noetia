'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AccessDenial, UnlockOutcome, fetchAvailableTokens, unlockBook } from '@/lib/acquisition';
import { useTranslation } from '@/lib/i18n';

// "Unlock with token" (NEM-012). Paid books are acquired only by redeeming a
// token (PO-021 Amendment 1) — this UI never offers a per-title purchase.

type BookInfo = { title?: string; author?: string; coverUrl?: string | null };

type PanelProps = BookInfo & {
  bookId: string;
  /** Why the reader was denied; absent when the user can already read via their plan. */
  reason?: AccessDenial['reason'];
  /** True when the user can read the book now (legacy plan access) but does not own it. */
  readableWithPlan?: boolean;
  onUnlocked: () => void;
  onClose?: () => void;
};

const TOKENS_HREF = '/pricing#tokens';

export function UnlockPanel({ bookId, title, author, coverUrl, reason, readableWithPlan, onUnlocked, onClose }: PanelProps) {
  const { t } = useTranslation();
  const a = t.acquisition;
  const [tokens, setTokens] = useState<number | null | undefined>(undefined);
  const [unlocking, setUnlocking] = useState(false);
  const [outcome, setOutcome] = useState<UnlockOutcome | null>(null);
  const signedIn = typeof window !== 'undefined' && Boolean(localStorage.getItem('access_token'));

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    fetchAvailableTokens().then((n) => { if (live) setTokens(n); });
    return () => { live = false; };
  }, [signedIn]);

  async function handleUnlock() {
    if (unlocking) return;
    setUnlocking(true);
    setOutcome(null);
    const result = await unlockBook(bookId);
    if (result === 'unlocked' || result === 'already_owned') {
      onUnlocked();
      return;
    }
    if (result === 'no_tokens') setTokens(0);
    setOutcome(result);
    setUnlocking(false);
  }

  const outOfTokens = tokens === 0 || outcome === 'no_tokens';

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="mx-auto mb-4 h-40 w-28 rounded-lg object-cover shadow" />
      )}
      <h2 className="text-lg font-bold text-gray-900">{a.title}</h2>
      {title && <p className="mt-1 text-sm font-semibold text-gray-800">{title}</p>}
      {author && <p className="text-xs text-gray-500">{author}</p>}

      <p className="mt-3 text-sm text-gray-600">{readableWithPlan ? a.readingWithPlan : a.subtitle}</p>
      {reason === 'payment_required' && <p className="mt-2 text-xs text-amber-700">{a.paymentPending}</p>}

      {!signedIn ? (
        <Link
          href={`/login?next=${encodeURIComponent(`/reader/${bookId}`)}`}
          className="mt-5 block w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {a.signIn}
        </Link>
      ) : (
        <>
          <p className="mt-4 text-sm font-medium text-gray-900" aria-live="polite">
            {tokens === undefined ? a.checkingBalance : tokens === null ? null : a.balance(tokens)}
          </p>

          {outcome === 'email_unconfirmed' && <p role="alert" className="mt-3 text-sm text-red-600">{a.confirmEmail}</p>}
          {(outcome === 'error' || outcome === 'not_found') && <p role="alert" className="mt-3 text-sm text-red-600">{a.error}</p>}

          {outOfTokens ? (
            <>
              <p className="mt-3 text-sm text-gray-600">{a.noTokens}</p>
              <Link href={TOKENS_HREF} className="mt-4 block w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                {a.getTokens}
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleUnlock}
                disabled={unlocking || tokens === undefined}
                className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {unlocking ? a.unlocking : a.unlock}
              </button>
              <Link href={TOKENS_HREF} className="mt-3 block text-sm font-medium text-blue-600 hover:underline">
                {a.getTokens}
              </Link>
            </>
          )}
        </>
      )}

      {onClose && (
        <button type="button" onClick={onClose} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
          {a.close}
        </button>
      )}
    </div>
  );
}

/** Modal used inside the reader when the user can read via their plan but does not own the book. */
export function UnlockDialog(props: Omit<PanelProps, 'onClose'> & { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.acquisition.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <UnlockPanel {...props} />
    </div>
  );
}

/** Full screen shown instead of the reader when the full book is denied. */
export function UnlockScreen({ bookId, reason, onUnlocked }: { bookId: string; reason?: AccessDenial['reason']; onUnlocked: () => void }) {
  const [book, setBook] = useState<BookInfo>({});

  useEffect(() => {
    let live = true;
    apiFetch(`/books/${encodeURIComponent(bookId)}/summary`)
      .then((s) => { if (live) setBook({ title: s?.title, author: s?.author, coverUrl: s?.coverUrl ?? null }); })
      .catch(() => {});
    return () => { live = false; };
  }, [bookId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <UnlockPanel bookId={bookId} reason={reason} onUnlocked={onUnlocked} {...book} />
    </main>
  );
}
