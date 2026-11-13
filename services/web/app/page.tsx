import type { Metadata } from 'next';
import LandingContent from './LandingContent';
import { displayFont } from './fonts';

export const metadata: Metadata = {
  title: 'Noetia — Lee, escucha y comparte las ideas que te mueven',
  description:
    'Lee y escucha con texto y audio sincronizados, guarda los pasajes que te mueven y compártelos como tarjetas visuales. Read, listen, capture and share.',
  openGraph: {
    title: 'Noetia — Lee, escucha y comparte las ideas que te mueven',
    description: 'Lectura y audio sincronizados, fragmentos y tarjetas visuales. Synchronized reading and audio, saved passages and visual cards.',
    type: 'website',
    locale: 'es_LA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Noetia — Lee, escucha y comparte las ideas que te mueven',
    description: 'Lectura y audio sincronizados, fragmentos y tarjetas visuales. Synchronized reading and audio, saved passages and visual cards.',
  },
};

export default function LandingPage() {
  return (
    <div className={displayFont.variable}>
      <LandingContent />
    </div>
  );
}
