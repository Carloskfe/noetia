import Link from 'next/link';

type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  category: string;
  language: string;
};

export function BookGrid({ books }: { books: Book[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 pb-6">
      {books.map((book) => (
        <Link key={book.id} href={`/reader/${book.id}`} className="group">
          <div className="aspect-[2/3] bg-gray-200 rounded-xl overflow-hidden mb-2 shadow-sm group-hover:shadow-md transition">
            {book.coverUrl && (
              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{book.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{book.author}</p>
        </Link>
      ))}
    </div>
  );
}
