import type { Metadata } from 'next';
import './globals.css';
import CookieBanner from '@/components/CookieBanner';
import Footer from '@/components/Footer';
import { LanguageProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Noetia — Lee. Escucha. Comparte.',
  description:
    'Plataforma de lectura multimodal con sincronización texto-audio frase por frase. Captura fragmentos y compártelos como tarjetas visuales.',
  openGraph: {
    siteName: 'Noetia',
    type: 'website',
    locale: 'es_LA',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <LanguageProvider>
          {children}
          <Footer />
          <CookieBanner />
        </LanguageProvider>
      </body>
    </html>
  );
}
