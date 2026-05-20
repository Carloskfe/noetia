'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [globalError, setGlobalError] = useState('');
  const { t } = useTranslation();

  const schema = z.object({
    password: z.string().min(8, t.auth.reset.errors.short),
    confirm: z.string(),
  }).refine((d) => d.password === d.confirm, { message: t.auth.reset.errors.mismatch, path: ['confirm'] });
  type FormValues = z.infer<typeof schema>;

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      await apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password: values.password }) });
      router.replace('/login?reset=1');
    } catch {
      setGlobalError(t.auth.reset.errors.expired);
    }
  }

  if (!token) {
    return (
      <p className="text-red-500 text-sm text-center">
        {t.auth.reset.invalidLink}{' '}
        <Link href="/forgot-password" className="underline">{t.auth.reset.requestNew}</Link>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t.auth.reset.newPassword}</label>
        <input type="password" {...register('password')} placeholder={t.auth.reset.newPasswordPlaceholder}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t.auth.reset.confirm}</label>
        <input type="password" {...register('confirm')} placeholder={t.auth.reset.confirmPlaceholder}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {errors.confirm && <p className="text-red-500 text-sm mt-1">{errors.confirm.message}</p>}
      </div>

      {globalError && <p className="text-red-500 text-sm">{globalError}</p>}

      <button type="submit" disabled={isSubmitting}
        className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
        {isSubmitting ? t.auth.reset.submitting : t.auth.reset.submit}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-2xl font-bold mb-6 text-center">{t.auth.reset.title}</h1>
      <Suspense><ResetForm /></Suspense>
    </>
  );
}
