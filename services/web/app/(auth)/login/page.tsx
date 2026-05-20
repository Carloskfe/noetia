'use client';

import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, saveToken, saveUserType, saveEmailConfirmed, postAuthRedirect } from '@/lib/api';
import SocialAuthButtons from '@/components/SocialAuthButtons';
import LanguagePicker from '@/components/LanguagePicker';
import { useTranslation } from '@/lib/i18n';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const resetSuccess = params.get('reset') === '1';
  const { t } = useTranslation();

  const schema = z.object({
    email: z.string().email(t.auth.login.errors.email),
    password: z.string().min(1, t.auth.login.errors.passwordRequired),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      saveToken(data.accessToken);
      saveUserType(data.user?.userType ?? null);
      saveEmailConfirmed(data.user?.emailConfirmed ?? true);
      router.push(postAuthRedirect(data.user?.userType ?? null));
    } catch (err: any) {
      setError('root', { message: err.message ?? t.auth.login.errors.generic });
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <LanguagePicker />
      </div>

      <h1 className="text-2xl font-bold mb-6 text-center">{t.auth.login.pageTitle}</h1>

      {resetSuccess && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center">
          {t.auth.login.passwordUpdated}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t.auth.login.email}</label>
          <input
            type="email"
            {...register('email')}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.auth.login.password}</label>
          <input
            type="password"
            {...register('password')}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
        </div>

        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
            {t.auth.login.forgotPassword}
          </Link>
        </div>

        {errors.root && <p className="text-red-500 text-sm">{errors.root.message}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {isSubmitting ? t.auth.login.submitting : t.auth.login.submit}
        </button>
      </form>

      <SocialAuthButtons />

      <p className="text-center text-sm mt-6 text-gray-500">
        {t.auth.login.noAccount}{' '}
        <Link href="/register" className="text-blue-600 hover:underline">
          {t.auth.login.register}
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
