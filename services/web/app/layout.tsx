import type { Metadata } from 'next';
import './globals.css';
import CookieBanner from '@/components/CookieBanner';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Noetia',
  description: 'Where ideas become visible',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Footer />
        <CookieBanner />
      </body>
    </html>
  );
}
