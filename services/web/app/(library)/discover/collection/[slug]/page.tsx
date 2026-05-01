'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

type CollectionDetail = {
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  bookCount: number;
  books: Book[];
};

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [libraryIds, setLibraryIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch(`/collections/${slug}`),
      apiFetch('/library/ids').catch(() => [] as string[]),
    ])
      .then(([col, ids]) => {
        setCollection(col);
        setLibraryIds(new Set(ids));
      })
      .catch((err) => setError(err.message ?? 'Error loading collection'))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleAdd = useCallback(async (bookId: string) => {
    setLibraryIds((prev) => new Set([...prev, bookId]));
    try {
      await apiFetch(`/library/${bookId}`, { method: 'POST' });
    } catch {
      setLibraryIds((prev) => { const n = new Set(prev); n.delete(bookId); return n; });
    }
  }, []);

  if (loading) return <CollectionSkeleton />;
  if (error || !collection) return (
    <div className="max-w-lg mx-auto px-4 pt-16 text-center">
      <p className="text-red-500 text-sm">{error || 'Colección no encontrada'}</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4">
      {/* Header */}
      <div className="pt-12 pb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4 transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Volver
        </button>

        <div className="flex items-start gap-4 mb-4">
          {collection.coverUrl && (
            <div className="w-16 aspect-[2/3] rounded-xl overflow-hidden shadow-sm flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={collection.coverUrl} alt={collection.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Colección</span>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5 leading-tight">{collection.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{collection.bookCount} libros</p>
          </div>
        </div>

        {collection.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{collection.description}</p>
        )}
      </div>

      <BookGrid books={collection.books} libraryBookIds={libraryIds} onAdd={handleAdd} />
    </div>
  );
}

function CollectionSkeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-12">
      <div className="animate-pulse mb-6">
        <div className="h-4 bg-gray-200 rounded w-16 mb-4" />
        <div className="flex gap-4">
          <div className="w-16 aspect-[2/3] bg-gray-200 rounded-xl" />
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[2/3] bg-gray-200 rounded-xl mb-2" />
            <div className="h-3 bg-gray-200 rounded w-3/4 mb-1" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
