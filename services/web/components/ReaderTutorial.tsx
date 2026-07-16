'use client';

import { markReaderTutorialSeen } from '@/lib/reader-tutorial';
import { useTranslation } from '@/lib/i18n';
import OnboardingTour from '@/components/onboarding/OnboardingTour';

export { hasSeenReaderTutorial } from '@/lib/reader-tutorial';

const ICONS = [
  <svg key="0" className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>,
  <svg key="1" className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z" />
  </svg>,
  <svg key="2" className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>,
  <svg key="3" className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>,
];

interface Props {
  onDismiss: () => void;
}

export default function ReaderTutorial({ onDismiss }: Props) {
  const { t } = useTranslation();
  const tr = t.tutorials.reader;

  function dismiss() {
    markReaderTutorialSeen();
    onDismiss();
  }

  const steps = tr.steps.map((s, i) => ({ icon: ICONS[i], title: s.title, body: s.body }));

  return (
    <OnboardingTour
      steps={steps}
      ariaLabel={tr.ariaLabel}
      onComplete={dismiss}
      onSkip={dismiss}
    />
  );
}
