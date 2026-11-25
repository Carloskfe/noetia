'use client';

import { useTranslation } from '@/lib/i18n';

export default function SocialPage() {
  const { t } = useTranslation();
  return <div className="p-8"><h1 className="text-2xl font-semibold">{t.socialPage.title}</h1></div>;
}
