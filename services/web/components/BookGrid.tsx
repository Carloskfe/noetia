import Link from 'next/link';

type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  category: string;
  language: string;
};

type Props = {
  books: Book[];
  libraryBookIds?: Set<string>;
  onAdd?: (bookId: string) => void;
};

export function BookGrid({ books, libraryBookIds, onAdd }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 pb-6">
      {books.map((book) => {
        const inLibrary = libraryBookIds?.has(book.id) ?? false;
        return (
          <div key={book.id} className="relative group">
            <Link href={`/reader/${book.id}`} className="block">
              <div className="aspect-[2/3] rounded-xl overflow-hidden mb-2 shadow-sm group-hover:shadow-md transition relative bg-gray-200">
                {book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <BookCoverPlaceholder title={book.title} author={book.author} />
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{book.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{book.author}</p>
            </Link>

            {onAdd && (
              <button
                onClick={(e) => { e.preventDefault(); if (!inLibrary) onAdd(book.id); }}
                aria-label={inLibrary ? 'En tu biblioteca' : 'Agregar a tu biblioteca'}
                className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow transition ${
                  inLibrary
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/90 text-gray-600 hover:bg-blue-600 hover:text-white'
                }`}
              >
                {inLibrary ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const PLACEHOLDER_COLORS = [
  '#1e3a5f', '#14532d', '#3b1fa8', '#7c2d12',
  '#881337', '#134e4a', '#1e1b4b', '#78350f',
];

function BookCoverPlaceholder({ title, author }: { title: string; author: string }) {
  const bg = PLACEHOLDER_COLORS[title.charCodeAt(0) % PLACEHOLDER_COLORS.length];
  const initial = title.trimStart()[0]?.toUpperCase() ?? '?';
  return (
    <div className="absolute inset-0 flex flex-col p-3" style={{ backgroundColor: bg }}>
      <span className="text-6xl font-bold select-none mt-1" style={{ color: 'rgba(255,255,255,0.12)' }}>
        {initial}
      </span>
      <div className="mt-auto">
        <p className="text-white text-[11px] font-semibold leading-tight line-clamp-2">{title}</p>
        <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{author}</p>
      </div>
    </div>
  );
}
