'use client';

import { ReactNode, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { clampStep, primaryLabel, stepNav } from '@/lib/onboarding-stepper';

export interface OnboardingStep {
  /** Emoji or a custom node (SVG/illustration). Illustrations slot in here later. */
  icon?: ReactNode;
  title: string;
  body: string;
}

interface Props {
  steps: OnboardingStep[];
  ariaLabel: string;
  /** Resume index (e.g. from server-persisted welcomeStep). Clamped to range. */
  initialStep?: number;
  /** Fired on every step change — persist the resume position here. */
  onStepChange?: (step: number) => void;
  /** Finished the last step. */
  onComplete: () => void;
  /** Dismissed early via Skip. Falls back to onComplete when omitted. */
  onSkip?: () => void;
}

/**
 * Reusable illustrated onboarding stepper: progress dots, Back / Next / Skip,
 * emoji-or-illustration slot per step. All labels come from `tutorials.nav`.
 * The single home for tour chrome — per-surface tutorials supply only content.
 */
export default function OnboardingTour({
  steps,
  ariaLabel,
  initialStep = 0,
  onStepChange,
  onComplete,
  onSkip,
}: Props) {
  const { t } = useTranslation();
  const nav = t.tutorials.nav;
  const [step, setStep] = useState(clampStep(initialStep, steps.length));

  if (steps.length === 0) return null;

  const current = steps[step];
  const { isFirst, isLast } = stepNav(step, steps.length);

  function go(next: number) {
    const clamped = clampStep(next, steps.length);
    setStep(clamped);
    onStepChange?.(clamped);
  }

  function handleNext() {
    if (isLast) onComplete();
    else go(step + 1);
  }

  function handleSkip() {
    (onSkip ?? onComplete)();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="flex justify-center gap-1.5 mb-6">
          {steps.map((_, i) => (
            <span
              key={i}
              data-testid="onboarding-dot"
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-blue-600' : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {current.icon != null && <div className="flex justify-center mb-4">{current.icon}</div>}

        <h2 className="text-lg font-bold text-gray-900 mb-2">{current.title}</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">{current.body}</p>

        <div className="flex gap-3">
          {isFirst ? (
            <button
              onClick={handleSkip}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
            >
              {nav.skip}
            </button>
          ) : (
            <button
              onClick={() => go(step - 1)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
            >
              {nav.prev}
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
          >
            {primaryLabel(step, steps.length, nav)}
          </button>
        </div>
      </div>
    </div>
  );
}
