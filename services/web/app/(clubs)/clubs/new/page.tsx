'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clubsApi } from '@/lib/clubs';
import { useTranslation } from '@/lib/i18n';

type Book = { id: string; title: string; author: string; isFree: boolean };

export default function CreateClubPage() {
  const { t } = useTranslation();
  const c = t.clubs.create;
  const router = useRouter();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [type, setType]               = useState<'public' | 'private'>('public');
  const [bookSearch, setBookSearch]   = useState('');
  const [books, setBooks]             = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    if (!bookSearch) { setBooks([]); return; }
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(`/books?search=${encodeURIComponent(bookSearch)}&limit=8`);
        setBooks(data.books ?? data ?? []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [bookSearch]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBook) { setError('Select a starting book.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const club = await clubsApi.create({ name, description: description || undefined, type, bookId: selectedBook.id });
      router.push(`/clubs/${club.id}`);
    } catch (err: any) {
      const code = err?.data?.error;
      if (code === 'club_limit_reached') setError(c.limitReached);
      else if (code === 'subscription_required_for_paid_book_club') setError(c.subscriptionRequired);
      else setError(t.common.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{c.title}</h1>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">{c.name}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={c.namePlaceholder}
            required minLength={3} maxLength={100}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{c.description}</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={c.descriptionPlaceholder}
            rows={3} maxLength={1000}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{c.type}</label>
          <div className="space-y-2">
            {(['public', 'private'] as const).map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="type" value={opt} checked={type === opt} onChange={() => setType(opt)} />
                <span className="text-sm">{opt === 'public' ? c.public : c.private}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{c.book}</label>
          {selectedBook ? (
            <div className="flex items-center justify-between border rounded-lg px-3 py-2 bg-blue-50">
              <span className="text-sm font-medium">{selectedBook.title}</span>
              <button type="button" onClick={() => { setSelectedBook(null); setBookSearch(''); }} className="text-xs text-gray-500 hover:text-red-500">✕</button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={bookSearch}
                onChange={e => setBookSearch(e.target.value)}
                placeholder={c.bookPlaceholder}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {books.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {books.map(b => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => { setSelectedBook(b); setBooks([]); setBookSearch(''); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        <span className="font-medium">{b.title}</span>
                        <span className="text-gray-400 ml-1">— {b.author}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !name || !selectedBook}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? c.submitting : c.submit}
        </button>
      </form>
    </main>
  );
}
