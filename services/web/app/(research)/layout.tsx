import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

// NEM-024 Checkpoint D: research sessions require login and an entitlement — never indexed; no navigation entry.
export const metadata: Metadata = { robots: { index: false } };

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
