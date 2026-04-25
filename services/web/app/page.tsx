import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-6">
      <h1 className="text-4xl font-bold">Alexandria</h1>
      <p className="text-lg text-gray-500">Read. Listen. Capture. Share.</p>
      <div className="flex gap-4 mt-4">
        <Link
          href="/login"
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="px-6 py-2 border border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
