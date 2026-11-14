import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Planes y Precios',
  description:
    'Suscríbete a Noetia desde US$8.99/mes y desbloquea audiolibros sincronizados, captura de fragmentos y tarjetas para compartir en redes.',
  openGraph: {
    title: 'Planes y Precios — Noetia',
    description: 'Elige el plan que mejor se adapte a tu ritmo de lectura.',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
