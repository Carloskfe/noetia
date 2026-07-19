import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

type ShareData = {
  id: string;
  quote: string;
  author: string;
  title: string;
  citation: string | null;
  imageUrl: string;
  book: { id: string; title: string; author: string; coverUrl: string | null; isFree: boolean } | null;
};

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:4000';

// React cache() dedupes the fetch across generateMetadata + the page render,
// so a request hits the API (and bumps the visit counter) exactly once.
const getShare = cache(async (id: string): Promise<ShareData | null> => {
  try {
    const res = await fetch(`${API}/shares/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ShareData;
  } catch {
    return null;
  }
});

function pickLang(): 'es' | 'en' {
  const al = headers().get('accept-language')?.toLowerCase() ?? '';
  return al.startsWith('en') ? 'en' : 'es';
}

const COPY = {
  es: {
    invite: 'Alguien quiere compartir esta idea contigo.',
    readBook: (t: string) => `Lee «${t}» en Noetia`,
    discover: 'Descubre Noetia',
    tagline: 'Lee, escucha y comparte lo que te inspira — frase por frase.',
    metaDesc: (a: string, t: string) => `${a} · ${t} — léelo en Noetia, con audio sincronizado frase por frase.`,
  },
  en: {
    invite: 'Someone wanted to share this idea with you.',
    readBook: (t: string) => `Read “${t}” on Noetia`,
    discover: 'Discover Noetia',
    tagline: 'Read, listen, and share what inspires you — phrase by phrase.',
    metaDesc: (a: string, t: string) => `${a} · ${t} — read it on Noetia, with phrase-by-phrase synced audio.`,
  },
} as const;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const share = await getShare(params.id);
  if (!share) return { title: 'Noetia' };
  const c = COPY[pickLang()];
  const snippet = share.quote.length > 80 ? share.quote.slice(0, 80).trimEnd() + '…' : share.quote;
  const title = `“${snippet}” — Noetia`;
  const description = c.metaDesc(share.author, share.title);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Noetia',
      images: [{ url: share.imageUrl }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [share.imageUrl],
    },
  };
}

export default async function SharePage({ params }: { params: { id: string } }) {
  const share = await getShare(params.id);
  if (!share) notFound();

  const c = COPY[pickLang()];
  // Book-first CTA: the viewer liked this quote, so invite them into that book.
  const bookHref = share.book ? `/reader/${share.book.id}` : '/';

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <p className="text-sm text-gray-500 text-center">{c.invite}</p>

        {/* Quote card image (external MinIO URL) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={share.imageUrl}
          alt={share.quote}
          className="w-full rounded-2xl shadow-lg"
        />

        <div className="text-center">
          <p className="text-base text-gray-800 leading-snug">“{share.quote}”</p>
          <p className="text-sm text-gray-500 mt-2">
            {share.author} · {share.title}
          </p>
        </div>

        <div className="w-full flex flex-col gap-3">
          <Link
            href={bookHref}
            className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition"
          >
            {c.readBook(share.title)}
          </Link>
          <Link
            href="/"
            className="w-full text-center border border-gray-300 hover:border-blue-400 hover:text-blue-600 text-gray-700 py-3 rounded-xl transition"
          >
            {c.discover}
          </Link>
        </div>

        <p className="text-xs text-gray-400 text-center mt-2">{c.tagline}</p>
      </div>
    </main>
  );
}
