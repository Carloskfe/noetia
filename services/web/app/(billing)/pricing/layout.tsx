import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Planes y Precios',
  description:
    'Conoce los planes Individual, Dúo y Familia de Noetia y desbloquea audiolibros sincronizados, captura de fragmentos y tarjetas para compartir en redes.',
  openGraph: {
    title: 'Planes y Precios — Noetia',
    description: 'Elige el plan que mejor se adapte a tu ritmo de lectura.',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
