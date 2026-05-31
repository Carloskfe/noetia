import type { Metadata } from 'next';
import LandingContent from './LandingContent';

export const metadata: Metadata = {
  title: 'Noetia — Where knowledge becomes visible',
  description:
    'Lee, escucha, resalta y comparte. Noetia transforma lo que aprendes en una identidad intelectual visible — frase por frase.',
  openGraph: {
    title: 'Noetia — Where knowledge becomes visible',
    description: 'The first Knowledge Expression Platform. Read, listen, highlight, and share what defines you.',
    type: 'website',
    locale: 'es_LA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Noetia — Where knowledge becomes visible',
    description: 'The first Knowledge Expression Platform. Read, listen, highlight, and share what defines you.',
  },
};

export default function LandingPage() {
  return <LandingContent />;
}
