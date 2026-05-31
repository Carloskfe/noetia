'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

export default function BillingCancelPage() {
  const { t } = useTranslation();
  return (
    <main className="max-w-lg mx-auto px-4 py-24 text-center">
      <div className="text-6xl mb-6">👋</div>
      <h1 className="text-3xl font-bold mb-3">{t.billing.cancel.title}</h1>
      <p className="text-gray-500 mb-8">{t.billing.cancel.body}</p>
      <Link href="/pricing" className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
        {t.billing.cancel.cta}
      </Link>
    </main>
  );
}
