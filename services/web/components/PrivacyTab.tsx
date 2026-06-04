'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

interface PrivacySettings {
  shareReadingProgress: boolean;
  shareLibrary: boolean;
  shareProfile: boolean;
  shareFragments: boolean;
  allowInsights: boolean;
}

export default function PrivacyTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<PrivacySettings>({
    shareReadingProgress: true,
    shareLibrary: false,
    shareProfile: true,
    shareFragments: false,
    allowInsights: true,
  });
  const [loading, setLoading] = useState(true);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('noetia_token');
    if (!token) { setLoading(false); return; }
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((user) => {
        if (user) {
          setSettings({
            shareReadingProgress: user.shareReadingProgress ?? true,
            shareLibrary:         user.shareLibrary         ?? false,
            shareProfile:         user.shareProfile         ?? true,
            shareFragments:       user.shareFragments       ?? false,
            allowInsights:        user.allowInsights        ?? true,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key: keyof PrivacySettings) => {
    const newVal = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newVal }));
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1500);
    const token = localStorage.getItem('noetia_token');
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [key]: newVal }),
    }).catch(() => {
      setSettings((prev) => ({ ...prev, [key]: !newVal }));
    });
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">{t.common.loading}</p>;

  const socialItems: { key: keyof PrivacySettings; label: string; desc: string }[] = [
    { key: 'shareReadingProgress', label: t.privacy.readingProgress,  desc: t.privacy.readingProgressDesc },
    { key: 'shareLibrary',         label: t.privacy.library,          desc: t.privacy.libraryDesc },
    { key: 'shareProfile',         label: t.privacy.shareProfile,     desc: t.privacy.shareProfileDesc },
    { key: 'shareFragments',       label: t.privacy.fragments,        desc: t.privacy.fragmentsDesc },
  ];

  return (
    <div className="space-y-1">
      <p className="text-sm text-gray-500 mb-5">{t.privacy.subtitle}</p>

      {socialItems.map(({ key, label, desc }) => (
        <ToggleRow
          key={key}
          label={label}
          desc={desc}
          checked={settings[key]}
          saved={savedKey === key}
          savedLabel={t.privacy.saved}
          onToggle={() => toggle(key)}
        />
      ))}

      <div className="pt-5 mt-2 border-t">
        <ToggleRow
          label={t.privacy.insights}
          desc={t.privacy.insightsDesc}
          checked={settings.allowInsights}
          saved={savedKey === 'allowInsights'}
          savedLabel={t.privacy.saved}
          onToggle={() => toggle('allowInsights')}
          accent="amber"
        />
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  desc: string;
  checked: boolean;
  saved: boolean;
  savedLabel: string;
  onToggle: () => void;
  accent?: 'indigo' | 'amber';
}

function ToggleRow({ label, desc, checked, saved, savedLabel, onToggle, accent = 'indigo' }: ToggleRowProps) {
  const activeColor = accent === 'amber' ? 'bg-amber-500' : 'bg-indigo-600';
  const ringColor   = accent === 'amber' ? 'focus:ring-amber-500' : 'focus:ring-indigo-500';

  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saved && <span className="text-xs text-emerald-600">{savedLabel}</span>}
        <button
          role="switch"
          aria-checked={checked}
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 ${ringColor} focus:ring-offset-1 ${
            checked ? activeColor : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
