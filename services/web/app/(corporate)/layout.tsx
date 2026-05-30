import type { ReactNode } from 'react';
import { CorporateNav } from './_components';

export default function CorporateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white min-h-screen">
      <CorporateNav />
      {children}
    </div>
  );
}
