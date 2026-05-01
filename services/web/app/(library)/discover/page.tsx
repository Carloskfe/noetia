'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { BookGrid } from '@/components/BookGrid';

type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  category: string;
  language: string;
  isFree: boolean;
};

type CollectionSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  bookCount: number;
};

const TABS = [
  { label: 'Todo', value: 'all' },
  { label: 'Gratis', value: 'free' },
  { label: 'Clásicos', value: 'classic' },
  { label: 'Liderazgo', value: 'leadership' },
  { label: 'Desarrollo Personal', value: 'personal-development' },
  { label: 'Negocios', value: 'business' },
];

function buildUrl(tab: string): string {
  if (tab === 'all') return '/books';
  if (tab === 'free') return '/books?isFree=true';
  return `/books?category=${tab}`;
}

export default function DiscoverPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [freeBooks, setFreeBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [libraryIds, setLibraryIds] = useState<Set<string>>(new Set());
  const [searchHits, setSearchHits] = useState<Book[] | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefetch free books for the hero banner and user's library IDs
  useEffect(() => {
    apiFetch('/books?isFree=true')
      .then((data) => setFreeBooks(data))
      .catch(() => {});

    apiFetch('/library/ids')
      .then((ids: string[]) => setLibraryIds(new Set(ids)))
      .catch(() => {});

    apiFetch('/collections')
      .then((data: CollectionSummary[]) => setCollections(data))
      .catch(() => {});
  }, []);

  // Load books when tab changes
  useEffect(() => {
    if (query.trim()) return;
    setLoading(true);
    setError('');
    apiFetch(buildUrl(activeTab))
      .then((data) => setAllBooks(data))
      .catch((err) => setError(err.message ?? 'Error loading books'))
      .finally(() => setLoading(false));
  }, [activeTab, query]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSearchHits(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query });
        const data = await apiFetch(`/search?${params}`);
        setSearchHits(data.hits ?? []);
      } catch {
        setSearchHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleAdd = useCallback(async (bookId: string) => {
    setLibraryIds((prev) => new Set([...prev, bookId]));
    try {
      await apiFetch(`/library/${bookId}`, { method: 'POST' });
    } catch {
      setLibraryIds((prev) => {
        const next = new Set(prev);
        next.delete(bookId);
        return next;
      });
    }
  }, []);

  const displayed = searchHits ?? allBooks;
  const showHero = activeTab === 'all' && !query.trim() && freeBooks.length > 0;

  return (
    <div className="max-w-lg mx-auto px-4">
      <div className="pt-12 pb-4 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Descubrir</h1>

        {/* Search bar */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por título, autor o descripción…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              Buscando…
            </span>
          )}
        </div>

        {/* Category tabs — hidden during search */}
        {!query.trim() && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
        )}
      </div>

      {/* Search results */}
      {query.trim() ? (
        searching ? (
          <GridSkeleton />
        ) : searchHits && searchHits.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-16">
            No se encontraron resultados para &ldquo;{query}&rdquo;
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">{searchHits?.length ?? 0} resultados para &ldquo;{query}&rdquo;</p>
            <BookGrid books={displayed} libraryBookIds={libraryIds} onAdd={handleAdd} />
          </>
        )
      ) : loading ? (
        <>
          {showHero && <HeroSkeleton />}
          <GridSkeleton />
        </>
      ) : error ? (
        <p className="text-center text-red-500 text-sm mt-16">{error}</p>
      ) : (
        <>
          {/* Collections row — shown on "Todo" tab */}
          {activeTab === 'all' && !query.trim() && collections.length > 0 && (
            <CollectionsRow collections={collections} />
          )}

          {/* Free library hero — shown on "Todo" tab */}
          {showHero && <FreeLibraryHero books={freeBooks} />}

          {displayed.length === 0 ? (
            <p className="text-center text-gray-400 text-sm mt-16">
              No hay libros en esta categoría todavía.
            </p>
          ) : (
            <BookGrid books={displayed} libraryBookIds={libraryIds} onAdd={handleAdd} />
          )}
        </>
      )}
    </div>
  );
}

function FreeLibraryHero({ books }: { books: Book[] }) {
  const preview = books.slice(0, 3);
  return (
    <Link href="?tab=free" as="/discover" onClick={() => {}} className="block mb-8">
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-5 shadow-md">
        <div className="relative z-10">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
            Biblioteca gratuita
          </span>
          <h2 className="text-white text-lg font-bold leading-tight mb-1">
            {books.length} libros clásicos
          </h2>
          <p className="text-white/80 text-sm mb-4">
            Literatura universal y textos sagrados, disponibles sin costo.
          </p>
          <div className="flex gap-2">
            {preview.map((book) => (
              <div key={book.id} className="w-12 aspect-[2/3] rounded-lg overflow-hidden shadow-md bg-white/10 flex-shrink-0">
                {book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover opacity-90" />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{book.title[0]}</span>
                  </div>
                )}
              </div>
            ))}
            {books.length > 3 && (
              <div className="w-12 aspect-[2/3] rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">+{books.length - 3}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function CollectionsRow({ collections }: { collections: CollectionSummary[] }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-gray-900 mb-3">Colecciones</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {collections.map((col) => (
          <Link
            key={col.slug}
            href={`/discover/collection/${col.slug}`}
            className="flex-shrink-0 w-40 group"
          >
            <div className="aspect-[2/3] rounded-xl overflow-hidden mb-2 shadow-sm group-hover:shadow-md transition relative bg-gray-200">
              {col.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={col.coverUrl} alt={col.name} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-indigo-700 flex items-end p-3">
                  <span className="text-white text-xs font-semibold leading-tight line-clamp-2">{col.name}</span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <span className="text-white text-[10px] font-medium">{col.bookCount} libros</span>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{col.name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 pb-6 mt-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] bg-gray-200 rounded-xl mb-2" />
          <div className="h-3 bg-gray-200 rounded w-3/4 mb-1" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function HeroSkeleton() {
  return <div className="animate-pulse h-44 bg-gray-200 rounded-2xl mb-8" />;
}
