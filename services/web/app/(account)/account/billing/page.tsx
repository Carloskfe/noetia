'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Activo',      color: 'bg-green-100 text-green-700' },
  trialing:  { label: 'Trial',       color: 'bg-blue-100 text-blue-700' },
  canceling: { label: 'Cancelando',  color: 'bg-yellow-100 text-yellow-700' },
  past_due:  { label: 'Pago vencido', color: 'bg-red-100 text-red-700' },
  canceled:  { label: 'Cancelado',   color: 'bg-gray-100 text-gray-600' },
  none:      { label: 'Sin plan',    color: 'bg-gray-100 text-gray-600' },
};

export default function BillingSettingsPage() {
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [linkedData, setLinkedData] = useState<LinkedUsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  async function load() {
    const [subRes, linkedRes] = await Promise.all([
      fetch('/api/subscriptions/me'),
      fetch('/api/subscriptions/linked-users'),
    ]);
    const subData = await subRes.json();
    setSub(subData);
    if (linkedRes.ok) setLinkedData(await linkedRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleManageBilling() {
    const res = await fetch('/api/subscriptions/portal', { method: 'POST' });
    const { url } = await res.json();
    window.location.href = url;
  }

  async function handleRefresh() {
    setSyncing(true);
    await fetch('/api/subscriptions/sync', { method: 'POST' });
    await load();
    setSyncing(false);
  }

  async function handleResume() {
    await fetch('/api/subscriptions/resume', { method: 'POST' });
    await load();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError('');
    const res = await fetch('/api/subscriptions/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    });
    setInviting(false);
    if (res.ok) {
      setInviteSent(true);
      setInviteEmail('');
      setShowInviteForm(false);
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      const messages: Record<string, string> = {
        plan_full: 'El plan ya tiene el máximo de usuarios.',
        plan_does_not_support_sharing: 'Tu plan no admite usuarios adicionales.',
      };
      setInviteError(messages[data?.error] ?? 'No se pudo enviar la invitación.');
    }
  }

  async function handleRemoveUser(userId: string) {
    await fetch(`/api/subscriptions/linked-users/${userId}`, { method: 'DELETE' });
    await load();
  }

  async function handleRevokeInvite(inviteId: string) {
    await fetch(`/api/subscriptions/invite/${inviteId}`, { method: 'DELETE' });
    await load();
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando…</div>;

  const status = sub?.status ?? 'none';
  const badge = STATUS_LABELS[status] ?? STATUS_LABELS.none;
  const renewalDate = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString('es')
    : null;

  const maxProfiles = linkedData?.maxProfiles ?? sub?.maxProfiles ?? 1;
  const isSharedPlan = maxProfiles > 1;
  const usedSlots = (linkedData?.linkedUsers.length ?? 0) + 1; // +1 for owner
  const hasRoom = usedSlots < maxProfiles;

  if (status === 'none' || status === 'canceled') {
    return (
      <main className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-6">Facturación</h1>
        <p className="text-gray-500 mb-6">No tienes un plan activo.</p>
        <Link href="/pricing" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Ver planes
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-16 space-y-6">
      <h1 className="text-2xl font-bold">Facturación</h1>

      {/* Plan card */}
      <div className="border rounded-xl p-6 bg-white shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">{sub?.planName ?? 'Plan'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
            {badge.label}
          </span>
        </div>
        {renewalDate && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{status === 'canceling' ? 'Acceso hasta' : 'Renueva el'}</span>
            <span>{renewalDate}</span>
          </div>
        )}
        {!sub?.isLinkedMember && (
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleManageBilling}
              className="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              Gestionar facturación
            </button>
            {status === 'canceling' && (
              <button
                onClick={handleResume}
                className="w-full py-2 px-4 rounded-lg border border-indigo-600 text-indigo-600 font-medium hover:bg-indigo-50"
              >
                Reanudar suscripción
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={syncing}
              className="w-full py-2 px-4 rounded-lg border text-gray-600 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {syncing ? 'Actualizando…' : 'Actualizar estado'}
            </button>
          </div>
        )}
      </div>

      {/* Shared plan members — only for Duo/Family */}
      {isSharedPlan && linkedData && (
        <div className="border rounded-xl p-6 bg-white shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Miembros del plan</h2>
            <span className="text-xs text-gray-400">{usedSlots} / {maxProfiles}</span>
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
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Pending invites */}
          {linkedData.pendingInvites.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Invitaciones pendientes</p>
              <ul className="divide-y divide-gray-100">
                {linkedData.pendingInvites.map(inv => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm text-gray-700">{inv.email}</p>
                      <p className="text-xs text-gray-400">
                        Expira {new Date(inv.expiresAt).toLocaleDateString('es')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Revocar
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
                <p className="text-sm text-green-600 mb-2">✓ Invitación enviada por email.</p>
              )}
              {!showInviteForm ? (
                <button
                  onClick={() => { setShowInviteForm(true); setInviteSent(false); }}
                  className="w-full py-2 px-4 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm hover:border-indigo-400 hover:text-indigo-600"
                >
                  + Invitar usuario
                </button>
              ) : (
                <form onSubmit={handleInvite} className="flex flex-col gap-2">
                  <input
                    type="email"
                    required
                    placeholder="email@ejemplo.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={inviting}
                      className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {inviting ? 'Enviando…' : 'Enviar invitación'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowInviteForm(false); setInviteError(''); }}
                      className="px-3 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {linkedData.isOwner && !hasRoom && (
            <p className="text-xs text-gray-400 text-center">Plan completo — {maxProfiles} de {maxProfiles} usuarios.</p>
          )}
        </div>
      )}

      <div className="text-center">
        <Link href="/causas" className="text-sm text-slate-400 hover:text-slate-600 transition">
          🌿 Ver Causas Noetia — el 2,22% de tu pago apoya causas sociales
        </Link>
      </div>
    </main>
  );
}
