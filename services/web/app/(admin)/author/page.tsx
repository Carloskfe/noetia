'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { authorPortalCopy } from '@/lib/i18n/pages/author-portal';

// Category values are what the API stores; labels come from the page dictionary.
const CATEGORIES = ['leadership', 'personal-development', 'business', 'classic'] as const;

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
  coverUrl: string | null;
  createdAt: string;
};

type BookAnalytics = {
  id: string;
  title: string;
  isPublished: boolean;
  readers: number;
  shareCount: number;
  storageMB: number;
};

type Analytics = {
  books: BookAnalytics[];
  totalReaders: number;
  totalShares: number;
  totalStorageMB: number;
};

type Quota = { tier: string; limit: number; used: number; remaining: number };

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 mt-1">{children}</p>;
}

function FileInput({ name, label, hint, accept, required }: {
  name: string; label: string; hint: string; accept: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-blue-600">*</span>}
      </label>
      <input
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
      />
      <FieldHint>{hint}</FieldHint>
    </div>
  );
}

/** Upload a FormData with XHR so we can report progress. */
function uploadWithProgress(
  url: string,
  formData: FormData,
  token: string,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: any = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, data: {} });
    xhr.send(formData);
  });
}

export default function AuthorPage() {
  const router = useRouter();
  const { language } = useTranslation();
  const c = authorPortalCopy[language];
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [showSync, setShowSync] = useState(false);
  // Per-book SRT upload state: bookId → { loading, success, error }
  const [srtState, setSrtState] = useState<Record<string, { loading?: boolean; success?: string; error?: string }>>({});

  const token = useCallback(() =>
    typeof window !== 'undefined' ? localStorage.getItem('access_token') ?? '' : '',
    [],
  );

  useEffect(() => {
    if (!token()) { router.replace('/login'); return; }
    fetchAll(token());
  }, [router, token]);

  function fetchAll(t: string) {
    fetchMyBooks(t);
    fetchAnalytics(t);
    fetchQuota(t);
  }

  async function fetchMyBooks(t: string) {
    setLoadingBooks(true);
    try {
      const res = await fetch('/api/authors/me/books', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setMyBooks(await res.json());
    } catch { /* ignore */ } finally { setLoadingBooks(false); }
  }

  async function fetchAnalytics(t: string) {
    try {
      const res = await fetch('/api/authors/me/analytics', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setAnalytics(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchQuota(t: string) {
    try {
      const res = await fetch('/api/authors/me/quota', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setQuota(await res.json());
    } catch { /* ignore */ }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    setUploadPct(0);

    const formData = new FormData(e.currentTarget);
    const t = token();

    const { ok, status, data } = await uploadWithProgress('/api/books', formData, t, setUploadPct);

    if (!ok) {
      // Localized message only; raw server messages are never shown (NEM-025 B1-A).
      setError(c.submitError(status));
    } else {
      setSuccess(c.submitSuccess(data.title));
      formRef.current?.reset();
      setShowSync(false);
      fetchAll(t);
    }
    setLoading(false);
    setUploadPct(0);
  }

  async function handleSrtUpload(bookId: string, file: File) {
    setSrtState((s) => ({ ...s, [bookId]: { loading: true } }));
    try {
      const text = await file.text();
      const res = await fetch(`/api/books/${bookId}/sync-map/srt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'text/plain' },
        body: text,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSrtState((s) => ({ ...s, [bookId]: { success: c.srtSaved } }));
    } catch {
      setSrtState((s) => ({ ...s, [bookId]: { error: c.srtError } }));
    }
  }

  const quotaFull = quota !== null && quota.remaining === 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Page header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 pt-10 pb-6">
          <h1 className="text-2xl font-bold text-gray-900">{c.title}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {c.subtitle}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Quota card */}
        {quota && (
          <div className={`rounded-2xl px-5 py-4 flex items-center justify-between ${
            quotaFull ? 'bg-red-50 border border-red-200' : 'bg-white shadow-sm border border-gray-100'
          }`}>
            <div>
              <p className="text-sm font-semibold text-gray-900">{c.plan(c.tiers[quota.tier as keyof typeof c.tiers] ?? quota.tier)}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {c.quotaUsage(quota.used, quota.limit)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {Array.from({ length: quota.limit }).map((_, i) => (
                  <div key={i} className={`w-3 h-3 rounded-full ${i < quota.used ? 'bg-blue-500' : 'bg-gray-200'}`} />
                ))}
              </div>
              {quotaFull && <span className="text-xs font-medium text-red-600">{c.limitReached}</span>}
            </div>
          </div>
        )}

        {/* Analytics */}
        {analytics && analytics.books.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">{c.activityTitle}</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { v: analytics.totalReaders, l: c.readersLabel },
                { v: analytics.totalShares, l: c.sharesLabel },
                { v: `${analytics.totalStorageMB} MB`, l: c.storageLabel },
              ].map(({ v, l }) => (
                <div key={l} className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{v}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {analytics.books.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-4 py-3">
                  <p className="font-medium text-gray-900 truncate max-w-[140px]">{b.title}</p>
                  <div className="flex gap-4 text-right flex-shrink-0">
                    <span className="text-xs text-gray-500">{c.readers(b.readers)}</span>
                    <span className="text-xs text-gray-500">{c.shares(b.shareCount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">{c.uploadTitle}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {c.uploadIntro}{' '}
              <Link href="/upload-guide" className="text-blue-600 hover:underline font-medium">
                {c.formatGuide}
              </Link>
            </p>
          </div>

          {/* Always show the form; quota banner appears inside when limit reached */}
          <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-5">
              {quotaFull && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-sm font-semibold text-amber-800 mb-0.5">{c.quotaFullTitle}</p>
                  <p className="text-xs text-amber-700">
                    {c.quotaFullBody[0]}<strong>{c.quotaFullBody[1]}</strong>{c.quotaFullBody[2]}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{c.titleLabel} <span className="text-blue-600">*</span></label>
                  <input name="title" required className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={c.titlePlaceholder} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{c.authorLabel} <span className="text-blue-600">*</span></label>
                  <input name="author" required className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={c.authorPlaceholder} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{c.categoryLabel} <span className="text-blue-600">*</span></label>
                  <select name="category" required className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">{c.select}</option>
                    {CATEGORIES.map((value) => <option key={value} value={value}>{c.categories[value]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{c.languageLabel}</label>
                  <select name="language" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{c.descriptionLabel}</label>
                <textarea name="description" rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder={c.descriptionPlaceholder} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                <input name="isbn" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={c.isbnPlaceholder} />
              </div>

              {/* Files */}
              <div className="border-t border-gray-100 pt-5 space-y-4">
                <p className="text-sm font-semibold text-gray-700">{c.filesLabel}</p>

                <FileInput
                  name="coverFile"
                  label={c.cover}
                  accept=".jpg,.jpeg,.png"
                  hint={c.coverHint}
                />

                <FileInput
                  name="textFile"
                  label={c.text}
                  accept=".txt,.epub,.pdf"
                  hint={c.textHint}
                  required
                />

                <FileInput
                  name="audioFile"
                  label={c.audio}
                  accept=".mp3,.m4a,.aac"
                  hint={c.audioHint}
                />
              </div>

              {/* Optional sync section */}
              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSync((v) => !v)}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 transition-transform ${showSync ? 'rotate-90' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {c.syncToggle(showSync)}{' '}
                  <span className="text-xs font-normal text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">{c.recommended}</span>
                </button>
                <p className="text-xs text-gray-400 mt-1 ml-6">
                  {c.syncHint}{' '}
                  <Link href="/upload-guide#sync" className="underline">{c.syncHowTo}</Link>
                </p>

                {showSync && (
                  <div className="mt-3 ml-6">
                    <FileInput
                      name="srtFile"
                      label={c.syncFile}
                      accept=".srt,.vtt"
                      hint={c.syncFileHint}
                    />
                  </div>
                )}
              </div>

              {/* Optional courtesy code */}
              <div className="border-t border-gray-100 pt-4">
                <details className="group">
                  <summary className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none list-none hover:text-gray-700 transition">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 transition-transform group-open:rotate-90">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {c.courtesyQuestion}
                  </summary>
                  <div className="mt-3 ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{c.courtesyLabel}</label>
                    <input
                      name="uploadCode"
                      type="text"
                      placeholder="NOETIA-XXXX-XXXX"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onChange={(e) => { e.target.value = e.target.value.toUpperCase(); }}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {c.courtesyHint}
                    </p>
                  </div>
                </details>
              </div>

              {/* Upload progress */}
              {loading && uploadPct > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{c.uploadingFiles}</span>
                    <span>{uploadPct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-200" style={{ width: `${uploadPct}%` }} />
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">{success}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-40 transition text-sm"
              >
                {loading ? (uploadPct > 0 ? c.uploadingPct(uploadPct) : c.processing) : c.submit}
              </button>
            </form>
        </div>

        {/* My books */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{c.myBooks}</h2>
          {loadingBooks ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="animate-pulse bg-white rounded-xl h-20 border border-gray-100" />)}
            </div>
          ) : myBooks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <p className="text-gray-400 text-sm">{c.noBooks}</p>
              <p className="text-gray-400 text-xs mt-1">{c.noBooksNote}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myBooks.map((book) => {
                const stats = analytics?.books.find((b) => b.id === book.id);
                const srt = srtState[book.id];
                return (
                  <div key={book.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-4 px-4 py-3">
                      {/* Thumbnail */}
                      <div className="w-10 aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {book.coverUrl
                          ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{book.title[0]}</span>
                            </div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{book.title}</p>
                        <p className="text-xs text-gray-500 truncate">{book.author}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                        book.isPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {book.isPublished ? c.published : c.inReview}
                      </span>
                    </div>

                    {stats && (
                      <div className="flex gap-4 px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                        <span>{c.readers(stats.readers)}</span>
                        <span>{c.shares(stats.shareCount)}</span>
                        <span>{stats.storageMB} MB</span>
                      </div>
                    )}

                    {/* SRT upload row */}
                    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100">
                      <label className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer transition">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H16C17.6569 21 19 19.6569 19 18V13.5M13.5 3L19 8.5M13.5 3V8.5H19" />
                        </svg>
                        {c.uploadSrt}
                        <input
                          type="file"
                          accept=".srt,.vtt"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleSrtUpload(book.id, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {srt?.loading && <span className="text-xs text-gray-400">{c.uploading}</span>}
                      {srt?.success && <span className="text-xs text-green-600">✓ {srt.success}</span>}
                      {srt?.error && <span className="text-xs text-red-500">{srt.error}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Help footer */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
          <p className="text-sm text-gray-700 font-medium mb-1">{c.helpTitle}</p>
          <p className="text-xs text-gray-500 mb-3">
            {c.helpBody}
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <Link href="/upload-guide" className="text-blue-600 hover:underline font-medium">
              {c.helpGuide}
            </Link>
            <a href="mailto:autores@noetia.app" className="text-blue-600 hover:underline font-medium">
              autores@noetia.app
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
