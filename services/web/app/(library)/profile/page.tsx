'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, clearToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import DeleteAccountModal from '@/components/DeleteAccountModal';
import StatsTab from '@/components/StatsTab';
import PrivacyTab from '@/components/PrivacyTab';
import { useTranslation } from '@/lib/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  provider: 'local' | 'google' | 'facebook' | 'apple';
  userType: 'personal' | 'author' | 'editorial' | null;
  country: string | null;
  languages: string[] | null;
  interests: string[] | null;
  hostingTier: 'basic' | 'starter' | 'pro';
  emailConfirmed: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface SubscriptionStatus {
  status: 'none' | 'trialing' | 'active' | 'canceling' | 'past_due' | 'canceled';
  planId: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  tokenBalance: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LANGUAGES = ['Español', 'English', 'Português', 'Français', 'Deutsch', 'Italiano', 'Русский', '中文'];
const INTERESTS = [
  'Liderazgo', 'Desarrollo Personal', 'Negocios', 'Clásicos',
  'Ficción', 'No Ficción', 'Filosofía', 'Historia', 'Ciencia', 'Espiritualidad',
];

const SOCIAL_PLATFORMS = ['linkedin', 'facebook', 'instagram', 'pinterest'] as const;
type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  pinterest: 'Pinterest',
};

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Activo',        color: 'bg-green-100 text-green-700' },
  trialing:  { label: 'Prueba gratis', color: 'bg-blue-100 text-blue-700' },
  canceling: { label: 'Cancelando',    color: 'bg-yellow-100 text-yellow-700' },
  past_due:  { label: 'Pago vencido',  color: 'bg-red-100 text-red-700' },
  canceled:  { label: 'Cancelado',     color: 'bg-gray-100 text-gray-500' },
  none:      { label: 'Sin plan',      color: 'bg-gray-100 text-gray-500' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null, email: string | null): string {
  if (name) return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  if (email) return email[0].toUpperCase();
  return '?';
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

type Tab = 'profile' | 'stats' | 'privacy';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [socials, setSocials] = useState<Partial<Record<SocialPlatform, boolean>>>({});
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [resendingConfirm, setResendingConfirm] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      apiFetch('/users/me').catch(() => null),
      apiFetch('/subscriptions/me').catch(() => null),
      ...SOCIAL_PLATFORMS.map((p) =>
        apiFetch(`/social/${p}/status`)
          .then((d: unknown) => ({ p, connected: (d as { connected: boolean }).connected }))
          .catch(() => ({ p, connected: false }))
      ),
    ]).then(([userData, subData, ...socialResults]) => {
      if (userData) {
        const u = userData as UserProfile;
        setUser(u);
        setName(u.name ?? '');
        setCountry(u.country ?? '');
        setSelectedLanguages(u.languages ?? []);
        setSelectedInterests(u.interests ?? []);
      }
      if (subData) setSub(subData as SubscriptionStatus);
      const map: Partial<Record<SocialPlatform, boolean>> = {};
      (socialResults as { p: SocialPlatform; connected: boolean }[]).forEach(({ p, connected }) => {
        map[p] = connected;
      });
      setSocials(map);
    }).finally(() => setLoading(false));
  }, []);

  // ── Save profile ───────────────────────────────────────────────────────

  const cancelEdit = useCallback(() => {
    if (!user) return;
    setEditing(false);
    setSaveError('');
    setName(user.name ?? '');
    setCountry(user.country ?? '');
    setSelectedLanguages(user.languages ?? []);
    setSelectedInterests(user.interests ?? []);
  }, [user]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    try {
      const updated = await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim() || undefined,
          country: country.trim() || undefined,
          languages: selectedLanguages,
          interests: selectedInterests,
        }),
      });
      setUser(updated as UserProfile);
      setEditing(false);
    } catch {
      setSaveError(t.account.errorSave);
    } finally {
      setSaving(false);
    }
  }, [name, country, selectedLanguages, selectedInterests, t]);

  // ── Resend confirmation ────────────────────────────────────────────────

  const handleResend = useCallback(async () => {
    setResendingConfirm(true);
    try {
      await apiFetch('/auth/resend-confirmation', { method: 'POST' });
      setConfirmSent(true);
    } catch {}
    setResendingConfirm(false);
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────

  const handleLogout = useCallback(async () => {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
    clearToken();
    router.push('/');
  }, [router]);

  // ── Connect social ─────────────────────────────────────────────────────

  const handleConnectSocial = useCallback((platform: SocialPlatform) => {
    const popup = window.open(`/api/social/${platform}/connect`, '_blank', 'width=600,height=700');
    const timer = setInterval(async () => {
      if (popup?.closed) {
        clearInterval(timer);
        const d = await apiFetch(`/social/${platform}/status`).catch(() => ({ connected: false }));
        setSocials((prev) => ({ ...prev, [platform]: (d as { connected: boolean }).connected }));
      }
    }, 500);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-16 text-center">
        <p className="text-gray-500 mb-4">{t.account.title}</p>
        <Link href="/auth/login" className="text-blue-600 font-medium">{t.auth.login.submit} →</Link>
      </div>
    );
  }

  const subStatus = sub?.status ?? 'none';
  const subBadge = SUB_STATUS[subStatus] ?? SUB_STATUS.none;
  const renewalDate = sub?.currentPeriodEnd ? fmtDate(sub.currentPeriodEnd) : null;
  const trialDate   = sub?.trialEnd ? fmtDate(sub.trialEnd) : null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: t.profile.tabs.profile },
    { key: 'stats',   label: t.profile.tabs.stats },
    { key: 'privacy', label: t.profile.tabs.privacy },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name ?? ''} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center flex-shrink-0 select-none">
            {initials(user.name, user.email)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-gray-900 truncate">{user.name ?? t.account.noName}</h1>
          <p className="text-sm text-gray-500 truncate">{user.email ?? '—'}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {user.userType && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {t.account.userTypes[user.userType] ?? user.userType}
              </span>
            )}
            {user.isAdmin && (
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">{t.account.admin}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Stats tab ───────────────────────────────────────────────────── */}
      {activeTab === 'stats' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <StatsTab />
        </div>
      )}

      {/* ── Privacy tab ─────────────────────────────────────────────────── */}
      {activeTab === 'privacy' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <PrivacyTab />
        </div>
      )}

      {/* ── Profile tab ─────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <>
          {/* ── Email confirmation banner ────────────────────────────────── */}
          {!user.emailConfirmed && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-amber-800 leading-snug">{t.account.confirmEmail}</p>
              {confirmSent ? (
                <span className="text-xs text-green-700 font-semibold whitespace-nowrap">{t.account.emailSent}</span>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendingConfirm}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap disabled:opacity-50 transition"
                >
                  {resendingConfirm ? t.account.sendingEmail : t.account.resendEmail}
                </button>
              )}
            </div>
          )}

          {/* ── Información personal ─────────────────────────────────────── */}
          <Section
            title={t.account.personalInfo}
            action={
              !editing
                ? <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">{t.account.edit}</button>
                : (
                  <div className="flex gap-3">
                    <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-700">{t.account.cancel}</button>
                    <button onClick={handleSave} disabled={saving} className="text-xs text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-50">
                      {saving ? t.account.saving : t.account.save}
                    </button>
                  </div>
                )
            }
          >
            {saveError && <p className="text-xs text-red-600 mb-3">{saveError}</p>}

            <Row label={t.account.name}>
              {editing
                ? <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.account.namePlaceholder} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                : <Value>{user.name}</Value>}
            </Row>

            <Row label={t.account.country}>
              {editing
                ? <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t.account.countryPlaceholder} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                : <Value>{user.country}</Value>}
            </Row>

            <Row label={t.account.languages}>
              {editing
                ? <TagSelector options={LANGUAGES} selected={selectedLanguages} onChange={setSelectedLanguages} />
                : <TagList items={user.languages} notSpecified={t.account.notSpecified} />}
            </Row>

            <Row label={t.account.interests}>
              {editing
                ? <TagSelector options={INTERESTS} selected={selectedInterests} onChange={setSelectedInterests} />
                : <TagList items={user.interests} notSpecified={t.account.notSpecified} />}
            </Row>
          </Section>

          {/* ── Suscripción ──────────────────────────────────────────────── */}
          <Section
            title={t.account.subscription}
            action={<Link href="/account/billing" className="text-xs text-blue-600 hover:text-blue-800 font-medium">{t.account.manage}</Link>}
          >
            <Row label={t.account.status}>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${subBadge.color}`}>{subBadge.label}</span>
            </Row>
            {sub && sub.tokenBalance > 0 && (
              <Row label={t.account.tokens}>
                <span className="text-sm font-semibold text-blue-700">{t.account.tokenAvail(sub.tokenBalance)}</span>
              </Row>
            )}
            {subStatus === 'trialing' && trialDate && (
              <Row label={t.account.trialUntil}><Value>{trialDate}</Value></Row>
            )}
            {(subStatus === 'active' || subStatus === 'canceling') && renewalDate && (
              <Row label={subStatus === 'canceling' ? t.account.accessUntil : t.account.renewsOn}>
                <Value>{renewalDate}</Value>
              </Row>
            )}
            {(subStatus === 'none' || subStatus === 'canceled') && (
              <Link href="/pricing" className="mt-3 block text-center text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl py-2.5 transition">
                {t.account.viewPlans}
              </Link>
            )}
          </Section>

          {/* ── Redes sociales ───────────────────────────────────────────── */}
          <Section title={t.account.socialAccounts}>
            {SOCIAL_PLATFORMS.map((platform) => {
              const connected = socials[platform] ?? false;
              return (
                <Row key={platform} label={PLATFORM_LABELS[platform]}>
                  {connected ? (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full">{t.account.connected}</span>
                  ) : (
                    <button onClick={() => handleConnectSocial(platform)} className="text-xs font-medium text-blue-600 hover:text-blue-800 transition">
                      {t.account.connect}
                    </button>
                  )}
                </Row>
              );
            })}
          </Section>

          {/* ── Cuenta ───────────────────────────────────────────────────── */}
          <Section title="Cuenta">
            <Row label={t.account.provider}>
              <span className="text-sm text-gray-800 capitalize">{user.provider}</span>
            </Row>
            <Row label={t.account.emailConfirmed}>
              {user.emailConfirmed
                ? <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full">{t.account.confirmed}</span>
                : <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">{t.account.pending}</span>}
            </Row>
            <Row label={t.account.memberSince}><Value>{fmtDate(user.createdAt)}</Value></Row>
            <Row label={t.account.lastLogin}><Value>{fmtDate(user.lastLoginAt)}</Value></Row>
          </Section>

          {/* ── Acciones ─────────────────────────────────────────────────── */}
          <div className="space-y-2 pt-1">
            {user.provider === 'local' && (
              <Link href="/auth/forgot-password" className="block w-full text-center text-sm font-medium text-gray-700 border border-gray-200 rounded-2xl py-3 hover:bg-gray-50 transition">
                {t.account.changePassword}
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-center text-sm font-medium text-red-600 border border-red-100 rounded-2xl py-3 hover:bg-red-50 transition"
            >
              {t.account.logout}
            </button>
          </div>

          {/* ── Danger zone ──────────────────────────────────────────────── */}
          <div className="border border-red-100 rounded-2xl p-4">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-widest mb-1">{t.account.dangerZone}</p>
            <p className="text-sm text-gray-500 leading-relaxed mb-3">{t.account.deleteWarning}</p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-sm font-medium text-red-600 hover:text-red-800 underline underline-offset-2 transition"
            >
              {t.account.deleteAccount}
            </button>
          </div>
        </>
      )}

      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}

    </div>
  );
}

// ── Reusable layout atoms ─────────────────────────────────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 min-h-[1.75rem]">
      <span className="text-sm text-gray-500 flex-shrink-0 w-32 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0 flex justify-end">{children}</div>
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  if (!children) return <em className="text-sm text-gray-400">—</em>;
  return <span className="text-sm text-gray-800 text-right">{children}</span>;
}

function TagList({ items, notSpecified }: { items: string[] | null; notSpecified: string }) {
  if (!items?.length) return <em className="text-sm text-gray-400">{notSpecified}</em>;
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {items.map((item) => (
        <span key={item} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full">{item}</span>
      ))}
    </div>
  );
}

function TagSelector({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(item: string) {
    onChange(selected.includes(item) ? selected.filter((x) => x !== item) : [...selected, item]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((item) => {
        const on = selected.includes(item);
        return (
          <button
            key={item}
            type="button"
            onClick={() => toggle(item)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              on ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
