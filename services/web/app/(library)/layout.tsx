import type { Metadata } from 'next';
import AppTopBar from '@/components/AppTopBar';
import BottomNav from '@/components/BottomNav';
import EmailVerificationBanner from '@/components/EmailVerificationBanner';
import WelcomeSplash from '@/components/WelcomeSplash';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false }, // Library pages require login — don't index
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <WelcomeSplash />
      <AppTopBar />
      <EmailVerificationBanner />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
