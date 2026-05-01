'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  { value: 'leadership', label: 'Liderazgo' },
  { value: 'personal-development', label: 'Desarrollo Personal' },
  { value: 'business', label: 'Negocios' },
  { value: 'classic', label: 'Clásico' },
];

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
];

type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  isPublished: boolean;
  createdAt: string;
};

export default function AuthorPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      router.replace('/login');
      return;
    }
    fetchMyBooks(token);
  }, [router]);

  async function fetchMyBooks(token: string) {
    setLoadingBooks(true);
    try {
      const res = await fetch('/api/authors/me/books', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMyBooks(await res.json());
    } catch {
      // ignore
    } finally {
      setLoadingBooks(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    const token = sessionStorage.getItem('access_token') ?? '';

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `Error (${res.status})`);
      setSuccess(`"${data.title}" enviado para revisión. Te notificaremos cuando sea publicado.`);
      formRef.current?.reset();
      fetchMyBooks(token);
    } catch (err: any) {
      setError(err.message ?? 'Error al enviar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-10">

        {/* Submit form */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Portal de autores</h1>
          <p className="text-gray-500 text-sm mb-6">
            Sube tu libro. El equipo de Noetia lo revisará antes de publicarlo.
          </p>

          <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <input name="title" required className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Autor *</label>
              <input name="author" required className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                <select name="category" required className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccionar…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
                <select name="language" className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
              <input name="isbn" className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea name="description" rows={3} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL de portada</label>
              <input name="coverUrl" type="url" placeholder="https://…" className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Archivo de texto (epub / pdf)</label>
              <input name="textFile" type="file" accept=".epub,.pdf" className="w-full text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Archivo de audio (mp3 / m4a)</label>
              <input name="audioFile" type="file" accept=".mp3,.m4a,.aac" className="w-full text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            {success && <p className="text-green-600 text-sm">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition"
            >
              {loading ? 'Enviando…' : 'Enviar para revisión'}
            </button>
          </form>
        </div>

        {/* My books */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mis libros</h2>
          {loadingBooks ? (
            <p className="text-gray-400 text-sm">Cargando…</p>
          ) : myBooks.length === 0 ? (
            <p className="text-gray-400 text-sm">Aún no has enviado ningún libro.</p>
          ) : (
            <div className="space-y-3">
              {myBooks.map((book) => (
                <div key={book.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{book.title}</p>
                    <p className="text-xs text-gray-500">{book.author} · {book.category}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    book.isPublished
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {book.isPublished ? 'Publicado' : 'En revisión'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
