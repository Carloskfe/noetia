'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LibraryPage() {
  const [query, setQuery] = useState('');

  // Placeholder — will be wired to the books API when that module is ready
  const books: any[] = [];
  const filtered = books.filter(
    (b) =>
      b.title.toLowerCase().includes(query.toLowerCase()) ||
      b.author.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="max-w-lg mx-auto px-4">
      {/* Header */}
      <div className="pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Mi biblioteca</h1>

        {/* Search bar */}
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
            type="text"
            placeholder="Buscar en tu biblioteca…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      {/* Content */}
      {books.length === 0 ? (
        <EmptyLibrary />
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 text-sm mt-16">
          No se encontraron resultados para &ldquo;{query}&rdquo;
        </p>
      ) : (
        <BookGrid books={filtered} />
      )}
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="flex flex-col items-center justify-center text-center mt-20 px-6">
      <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="w-12 h-12 text-blue-400"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">Tu biblioteca está vacía</h2>
      <p className="text-gray-500 text-sm mb-8 leading-relaxed">
        Descubre libros basados en tus intereses y empieza a construir tu colección.
      </p>

      <Link
        href="/discover"
        className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-medium hover:bg-blue-700 transition"
      >
        Descubrir libros
      </Link>
    </div>
  );
}

function BookGrid({ books }: { books: any[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 pb-6">
      {books.map((book) => (
        <Link key={book.id} href={`/reader/${book.id}`} className="group">
          <div className="aspect-[2/3] bg-gray-200 rounded-xl overflow-hidden mb-2 shadow-sm group-hover:shadow-md transition">
            {book.coverUrl && (
              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
            {book.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{book.author}</p>
        </Link>
      ))}
    </div>
  );
}
