import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Noetia — Where ideas become visible
        </p>
        <nav className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <Link href="/legal/privacy" className="hover:text-gray-800 transition">
            Privacidad / Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-gray-800 transition">
            Términos / Terms
          </Link>
          <Link href="/legal/cookies" className="hover:text-gray-800 transition">
            Cookies
          </Link>
          <a href="mailto:legal@noetia.app" className="hover:text-gray-800 transition">
            legal@noetia.app
          </a>
        </nav>
      </div>
    </footer>
  );
}
