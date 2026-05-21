'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clubsApi, Club } from '@/lib/clubs';
import { useTranslation } from '@/lib/i18n';
import ClubCard from '@/components/ClubCard';

export default function ClubsDiscoveryPage() {
  const { t } = useTranslation();
  const c = t.clubs;

  const [clubs, setClubs]     = useState<Club[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function load() {
    setLoading(true);
    try {
      const data = await clubsApi.list({ search: search || undefined });
      setClubs(data.clubs ?? data);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{c.discovery.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{c.discovery.subtitle}</p>
        </div>
        <Link
          href="/clubs/new"
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {c.discovery.create}
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={c.discovery.searchPlaceholder}
        className="w-full border rounded-lg px-3 py-2 mb-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={c.discovery.searchPlaceholder}
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : clubs.length === 0 ? (
        <p className="text-center text-gray-400 py-16">{c.discovery.empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map(club => <ClubCard key={club.id} club={club} />)}
        </div>
      )}
    </main>
  );
}
