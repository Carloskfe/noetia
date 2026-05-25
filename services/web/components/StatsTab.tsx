'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

interface DayStat {
  date: string;
  minutes: number;
  phrases: number;
}

interface Stats {
  thisWeek: DayStat[];
  thisWeekMinutes: number;
  thisWeekPhrases: number;
  booksThisWeek: number;
  streak: number;
  allTimeMinutes: number;
  allTimePhrases: number;
  goals: { weeklyMinutes: number | null; weeklyBooks: number | null };
}

export default function StatsTab() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalMinutes, setGoalMinutes] = useState('');
  const [goalBooks, setGoalBooks] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('noetia_token');
    if (!token) { setLoading(false); return; }
    fetch('/api/stats/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setStats(data);
          setGoalMinutes(data.goals.weeklyMinutes != null ? String(data.goals.weeklyMinutes) : '');
          setGoalBooks(data.goals.weeklyBooks != null ? String(data.goals.weeklyBooks) : '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveGoals = async () => {
    setSaving(true);
    const token = localStorage.getItem('noetia_token');
    const body: Record<string, number | null> = {
      goalWeeklyMinutes: goalMinutes ? parseInt(goalMinutes, 10) : null,
      goalWeeklyBooks: goalBooks ? parseInt(goalBooks, 10) : null,
    };
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">{t.common.loading}</p>;
  if (!stats) return null;

  const maxMinutes = Math.max(...stats.thisWeek.map((d) => d.minutes), 1);
  const goalMin = stats.goals.weeklyMinutes;
  const goalBk = stats.goals.weeklyBooks;

  const dayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t.stats.thisWeek}</h3>
        <div className="flex items-end gap-1 h-24">
          {stats.thisWeek.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-indigo-500 transition-all"
                style={{ height: `${Math.round((day.minutes / maxMinutes) * 72)}px`, minHeight: day.minutes > 0 ? '4px' : '0' }}
                title={t.stats.minutesFmt(day.minutes)}
              />
              <span className="text-[10px] text-gray-400">{dayLabel(day.date)}</span>
            </div>
          ))}
        </div>
        {stats.thisWeekMinutes === 0 && (
          <p className="text-xs text-gray-400 text-center mt-2">{t.stats.noData}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t.stats.streak} value={t.stats.streakDays(stats.streak)} accent />
        <StatCard label={t.stats.thisWeek} value={t.stats.minutesFmt(stats.thisWeekMinutes)} />
        <StatCard label={t.stats.booksThisWeek} value={String(stats.booksThisWeek)} />
        <StatCard label={t.stats.allTimePhrases} value={stats.allTimePhrases.toLocaleString()} />
      </div>

      {(goalMin != null) && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{t.stats.goals.weeklyMinutes}</span>
            <span>{t.stats.goals.progress(stats.thisWeekMinutes, goalMin)}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${Math.min(100, Math.round((stats.thisWeekMinutes / goalMin) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {(goalBk != null) && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{t.stats.goals.weeklyBooks}</span>
            <span>{t.stats.goals.progress(stats.booksThisWeek, goalBk)}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, Math.round((stats.booksThisWeek / goalBk) * 100))}%` }}
            />
          </div>
        </div>
      )}

      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{t.stats.goals.title}</h3>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-gray-500 mb-1 block">{t.stats.goals.weeklyMinutes}</span>
            <input
              type="number"
              min={1}
              value={goalMinutes}
              onChange={(e) => setGoalMinutes(e.target.value)}
              placeholder={t.stats.goals.minutesPlaceholder}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 mb-1 block">{t.stats.goals.weeklyBooks}</span>
            <input
              type="number"
              min={1}
              value={goalBooks}
              onChange={(e) => setGoalBooks(e.target.value)}
              placeholder={t.stats.goals.booksPlaceholder}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </label>
        </div>
        <button
          onClick={saveGoals}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? t.stats.goals.saving : saved ? t.stats.goals.saved : t.stats.goals.save}
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border p-3 text-center">
      <p className={`text-2xl font-bold ${accent ? 'text-indigo-600' : 'text-gray-800'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
