'use client';

import FragmentsTutorial from '@/components/FragmentsTutorial';
import { useTranslation } from '@/lib/i18n';

export default function FragmentsPage() {
  const { t } = useTranslation();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">{t.fragments.title}</h1>
      <FragmentsTutorial />
    </div>
  );
}
