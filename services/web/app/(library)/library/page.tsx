'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import { BookGrid } from '@/components/BookGrid';
import { useTranslation } from '@/lib/i18n';

type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  category: string;
  language: string;
  collection: string | null;
};

type CollectionMeta = { name: string; slug: string; coverUrl: string | null };

type CollectionGroup = {
  name: string;
  coverUrl: string | null;
  slug: string | null;
  books: Book[];
};

function groupLibrary(
  books: Book[],
  collectionMeta: Map<string, CollectionMeta>,
): { groups: CollectionGroup[]; standalone: Book[] } {
  const map = new Map<string, CollectionGroup>();
  const standalone: Book[] = [];

  for (const book of books) {
    if (book.collection) {
      if (!map.has(book.collection)) {
        const meta = collectionMeta.get(book.collection);
        map.set(book.collection, {
          name: book.collection,
          coverUrl: meta?.coverUrl ?? book.coverUrl,
          slug: meta?.slug ?? null,
          books: [],
        });
      }
      map.get(book.collection)!.books.push(book);
    } else {
      standalone.push(book);
    }
  }

  return { groups: Array.from(map.values()), standalone };
}

export default function LibraryPage() {
  const { t } = useTranslation();
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [collectionMeta, setCollectionMeta] = useState<Map<string, CollectionMeta>>(new Map());
  const [searchHits, setSearchHits] = useState<Book[] | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/library'),
      apiFetch('/collections').catch(() => [] as CollectionMeta[]),
    ])
      .then(([books, cols]: [Book[], CollectionMeta[]]) => {
        setAllBooks(books);
        setCollectionMeta(new Map(cols.map((c) => [c.name, c])));
      })
      .catch((err) => setError(err.message ?? 'Error loading library'))
      .finally(() => setLoading(false));
  }, []);

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

  const { groups, standalone } = groupLibrary(searchHits ?? allBooks, collectionMeta);
  const isSearching = Boolean(query.trim());

  return (
    <div className="max-w-lg mx-auto px-4">
      <div className="pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t.library.title}</h1>

        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          </svg>
          <input
            type="search"
            aria-label={t.library.search}
            placeholder={t.library.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {t.library.searching}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <BookGridSkeleton />
      ) : error ? (
        <p className="text-center text-red-500 text-sm mt-16">{error}</p>
      ) : allBooks.length === 0 ? (
        <EmptyLibrary />
      ) : isSearching && searchHits?.length === 0 ? (
        <p className="text-center text-gray-400 text-sm mt-16">
          {t.library.noResults(query)}
        </p>
      ) : (
        <>
          {/* Collection groups — hidden during search (flat results work better) */}
          {!isSearching && groups.length > 0 && (
            <div className="mb-6 space-y-3">
              {groups.map((group) => (
                <CollectionCard key={group.name} group={group} />
              ))}
            </div>
          )}

          {/* Standalone books + search results */}
          {(isSearching ? (searchHits ?? []) : standalone).length > 0 && (
            <BookGrid books={isSearching ? (searchHits ?? []) : standalone} />
          )}
        </>
      )}
    </div>
  );
}

function CollectionCard({ group }: { group: CollectionGroup }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const previewBooks = group.books.slice(0, 3);
  const slug = group.slug;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition text-left"
      >
        {/* Collection cover */}
        <div className="w-12 flex-shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 shadow-sm relative">
          {group.coverUrl ? (
            <Image src={group.coverUrl} alt={group.name} fill sizes="48px" className="object-cover" />
          ) : (
            <div className="w-full h-full bg-indigo-700 flex items-end p-1">
              <span className="text-white text-[8px] font-semibold leading-tight line-clamp-2">{group.name}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight">{group.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t.library.bookCount(group.books.length)}</p>
          {/* Mini preview strip */}
          <div className="flex gap-1 mt-2">
            {previewBooks.map((b) => (
              <div key={b.id} className="w-7 aspect-[2/3] rounded overflow-hidden bg-gray-100 flex-shrink-0 relative">
                {b.coverUrl ? (
                  <Image src={b.coverUrl} alt={b.title} fill sizes="28px" className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-300" />
                )}
              </div>
            ))}
            {group.books.length > 3 && (
              <div className="w-7 aspect-[2/3] rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-gray-400 text-[8px] font-medium">+{group.books.length - 3}</span>
              </div>
            )}
          </div>
        </div>

        {/* Chevron */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={['w-5 h-5 text-gray-400 flex-shrink-0 transition-transform', expanded ? 'rotate-180' : ''].join(' ')}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded book grid */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          <BookGrid books={group.books} />
        </div>
      )}
    </div>
  );
}

function BookGridSkeleton() {
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

function EmptyLibrary() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center text-center mt-20 px-6">
      <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-blue-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{t.library.empty}</h2>
      <p className="text-gray-500 text-sm mb-8 leading-relaxed">{t.library.emptySubtitle}</p>
      <Link href="/discover" className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-medium hover:bg-blue-700 transition">
        {t.library.discover}
      </Link>
    </div>
  );
}
