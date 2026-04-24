'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BookGrid } from '@/components/BookGrid';

type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  category: string;
  language: string;
};

const TABS = [
  { label: 'Todo', value: '' },
  { label: 'Liderazgo', value: 'leadership' },
  { label: 'Desarrollo Personal', value: 'personal-development' },
  { label: 'Negocios', value: 'business' },
];

export default function DiscoverPage() {
  const [activeTab, setActiveTab] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const url = activeTab ? `/books?category=${activeTab}` : '/books';
    apiFetch(url)
      .then((data) => setBooks(data))
      .catch((err) => setError(err.message ?? 'Error loading books'))
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className="max-w-lg mx-auto px-4">
      <div className="pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Descubrir</h1>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                activeTab === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 pb-6 mt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[2/3] bg-gray-200 rounded-xl mb-2" />
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-1" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-center text-red-500 text-sm mt-16">{error}</p>
      ) : books.length === 0 ? (
        <p className="text-center text-gray-400 text-sm mt-16">No hay libros en esta categoría todavía.</p>
      ) : (
        <BookGrid books={books} />
      )}
    </div>
  );
}
