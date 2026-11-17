'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

interface SubscriptionStatus {
  status: 'none' | 'trialing' | 'active' | 'canceling' | 'past_due' | 'canceled';
  planId?: string | null;
  planName?: string | null;
  maxProfiles?: number;
  currentPeriodEnd?: string | null;
  trialEnd?: string | null;
  tokenBalance?: number;
  isLinkedMember?: boolean;
}

interface LinkedUser {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  expiresAt: string;
}

interface LinkedUsersData {
  linkedUsers: LinkedUser[];
  pendingInvites: PendingInvite[];
  maxProfiles: number;
  isOwner: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  canceling: 'bg-yellow-100 text-yellow-700',
  past_due: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-600',
  none: 'bg-gray-100 text-gray-600',
};

// Protected calls go through apiFetch (Bearer + one shared refresh). The page renders its own error states, so
// a failed request never masquerades as "no active plan"; an expired session goes to login and comes back here.
const OPTIONAL_AUTH = { redirectOnAuthFailure: false } as const;
const LOGIN = '/login?next=%2Faccount%2Fbilling';
const isAuthError = (e: unknown) => (e as { status?: number } | null)?.status === 401;

export default function BillingSettingsPage() {
  const { t, language } = useTranslation();
  const b = t.billing;
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [linkedData, setLinkedData] = useState<LinkedUsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  function goToLogin() {
    window.location.href = LOGIN;
  }

  /** Loads status (required) and linked users (optional — a missing shared plan answers 404). */
  async function load(): Promise<boolean> {
    try {
      const subData = await apiFetch('/subscriptions/me', {}, OPTIONAL_AUTH);
      if (!subData || typeof subData.status !== 'string') throw new Error('Malformed subscription status');
      setSub(subData);
      setLoadFailed(false);
      try {
        setLinkedData(await apiFetch('/subscriptions/linked-users', {}, OPTIONAL_AUTH));
      } catch (e) {
        if (isAuthError(e)) throw e;
        setLinkedData(null);
      }
      return true;
    } catch (e) {
      if (isAuthError(e)) goToLogin();
      else setLoadFailed(true);
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Runs a protected action, refreshes the affected state on success, and reports failures. */
  async function runAction(key: string, action: () => Promise<unknown>, success?: string) {
    setBusy(key);
    setActionError('');
    setNotice('');
    try {
      await action();
      await load();
      if (success) setNotice(success);
    } catch (e) {
      if (isAuthError(e)) goToLogin();
      else setActionError(b.actionError);
    } finally {
      setBusy(null);
    }
  }

  async function handleManageBilling() {
    setBusy('portal');
    setActionError('');
    setNotice('');
    try {
      const res = await apiFetch('/subscriptions/portal', { method: 'POST' }, OPTIONAL_AUTH);
      const url = typeof res?.url === 'string' && /^https?:\/\//.test(res.url) ? res.url : null;
      if (!url) throw new Error('No portal URL');
      window.location.href = url;
    } catch (e) {
      if (isAuthError(e)) goToLogin();
      else setActionError(b.portalError);
    } finally {
      setBusy(null);
    }
  }

  const handleRefresh = () =>
    runAction('sync', () => apiFetch('/subscriptions/sync', { method: 'POST' }, OPTIONAL_AUTH), b.refreshed);
  const handleResume = () =>
    runAction('resume', () => apiFetch('/subscriptions/resume', { method: 'POST' }, OPTIONAL_AUTH), b.resumed);
  const handleRemoveUser = (userId: string) =>
    runAction(`remove:${userId}`, () => apiFetch(`/subscriptions/linked-users/${userId}`, { method: 'DELETE' }, OPTIONAL_AUTH), b.members.removed);
  const handleRevokeInvite = (inviteId: string) =>
    runAction(`revoke:${inviteId}`, () => apiFetch(`/subscriptions/invite/${inviteId}`, { method: 'DELETE' }, OPTIONAL_AUTH), b.members.revoked);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError('');
    try {
      await apiFetch('/subscriptions/invite', { method: 'POST', body: JSON.stringify({ email: inviteEmail }) }, OPTIONAL_AUTH);
      setInviteSent(true);
      setInviteEmail('');
      setShowInviteForm(false);
      await load();
    } catch (err) {
      if (isAuthError(err)) return goToLogin();
      const code = (err as { data?: { error?: string } })?.data?.error;
      const messages: Record<string, string> = {
        plan_full: b.members.errors.planFull,
        plan_does_not_support_sharing: b.members.errors.noSharing,
      };
      setInviteError((code && messages[code]) || b.members.errors.generic);
    } finally {
      setInviting(false);
    }
  }

  if (loading) return <div role="status" className="p-8 text-center text-gray-400">{b.loading}</div>;

  if (loadFailed || !sub) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16" data-testid="billing-load-error">
        <h1 className="text-2xl font-bold mb-6">{b.title}</h1>
        <p role="alert" className="text-gray-600 mb-6">{b.loadError}</p>
        <button
          type="button"
          onClick={() => { setLoading(true); load(); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {b.retry}
        </button>
      </main>
    );
  }

  const status = sub.status ?? 'none';
  const badgeColor = STATUS_COLORS[status] ?? STATUS_COLORS.none;
  const badgeLabel = (b.statuses as Record<string, string>)[status] ?? b.statuses.none;
  const dateLocale = language === 'en' ? 'en' : 'es';
  const renewalDate = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString(dateLocale)
    : null;

  const maxProfiles = linkedData?.maxProfiles ?? sub?.maxProfiles ?? 1;
  const isSharedPlan = maxProfiles > 1;
  const usedSlots = (linkedData?.linkedUsers.length ?? 0) + 1; // +1 for owner
  const hasRoom = usedSlots < maxProfiles;

  if (status === 'none' || status === 'canceled') {
    return (
      <main className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-6">{b.title}</h1>
        <p className="text-gray-500 mb-6">{b.noPlan}</p>
        <Link href="/pricing" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          {b.viewPlans}
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-16 space-y-6">
      <h1 className="text-2xl font-bold">{b.title}</h1>

      {actionError && <p role="alert" data-testid="billing-action-error" className="text-sm text-red-600">{actionError}</p>}
      {notice && <p role="status" data-testid="billing-notice" className="text-sm text-green-700">{notice}</p>}

      {/* Plan card */}
      <div className="border rounded-xl p-6 bg-white shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">{sub.planName ?? b.plan}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>
            {badgeLabel}
          </span>
        </div>
        {renewalDate && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{status === 'canceling' ? b.accessEnds : b.renewsOn}</span>
            <span>{renewalDate}</span>
          </div>
        )}
        {!sub.isLinkedMember && (
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleManageBilling}
              disabled={busy !== null}
              className="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {b.manageBilling}
            </button>
            {status === 'canceling' && (
              <button
                onClick={handleResume}
                disabled={busy !== null}
                className="w-full py-2 px-4 rounded-lg border border-indigo-600 text-indigo-600 font-medium hover:bg-indigo-50 disabled:opacity-50"
              >
                {b.resumeSubscription}
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={busy !== null}
              className="w-full py-2 px-4 rounded-lg border text-gray-600 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'sync' ? b.refreshing : b.refreshStatus}
            </button>
          </div>
        )}
      </div>

      {/* Shared plan members — only for Duo/Family */}
      {isSharedPlan && linkedData && (
        <div className="border rounded-xl p-6 bg-white shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{b.members.title}</h2>
            <span className="text-xs text-gray-400">{b.members.slots(usedSlots, maxProfiles)}</span>
          </div>

          {/* Linked users */}
          {linkedData.linkedUsers.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {linkedData.linkedUsers.map(u => (
                <li key={u.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{u.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  {linkedData.isOwner && (
                    <button
                      onClick={() => handleRemoveUser(u.id)}
                      disabled={busy !== null}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      {b.members.remove}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Pending invites */}
          {linkedData.pendingInvites.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{b.members.pendingTitle}</p>
              <ul className="divide-y divide-gray-100">
                {linkedData.pendingInvites.map(inv => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm text-gray-700">{inv.email}</p>
                      <p className="text-xs text-gray-400">
                        {b.members.expires} {new Date(inv.expiresAt).toLocaleDateString(dateLocale)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      disabled={busy !== null}
                      className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                    >
                      {b.members.revoke}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Invite form */}
          {linkedData.isOwner && hasRoom && (
            <div>
              {inviteSent && (
                <p role="status" className="text-sm text-green-600 mb-2">{b.members.inviteSent}</p>
              )}
              {!showInviteForm ? (
                <button
                  onClick={() => { setShowInviteForm(true); setInviteSent(false); }}
                  className="w-full py-2 px-4 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm hover:border-indigo-400 hover:text-indigo-600"
                >
                  {b.members.invite}
                </button>
              ) : (
                <form onSubmit={handleInvite} className="flex flex-col gap-2">
                  <input
                    type="email"
                    required
                    placeholder={b.members.emailPlaceholder}
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {inviteError && <p role="alert" className="text-xs text-red-500">{inviteError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={inviting}
                      className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {inviting ? b.members.sending : b.members.sendInvite}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowInviteForm(false); setInviteError(''); }}
                      className="px-3 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50"
                    >
                      {b.members.cancel}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {linkedData.isOwner && !hasRoom && (
            <p className="text-xs text-gray-400 text-center">{b.members.full(maxProfiles)}</p>
          )}
        </div>
      )}

      <div className="text-center">
        <Link href="/causas" className="text-sm text-slate-400 hover:text-slate-600 transition">
          {b.causas}
        </Link>
      </div>
    </main>
  );
}
