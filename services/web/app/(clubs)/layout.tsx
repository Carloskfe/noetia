import type { Metadata } from 'next';
import ClubsChrome from '@/components/ClubsChrome';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false }, // Clubs require login — don't index
};

export default function ClubsLayout({ children }: { children: React.ReactNode }) {
  return <ClubsChrome>{children}</ClubsChrome>;
}
