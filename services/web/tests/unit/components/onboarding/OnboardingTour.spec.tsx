// Mock i18n so the tour chrome has its nav labels without a LanguageProvider.
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: { tutorials: { nav: { skip: 'Skip', prev: 'Back', next: 'Next', done: 'Got it' } } },
  }),
}));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import OnboardingTour, { OnboardingStep } from '@/components/onboarding/OnboardingTour';

// React 18's act() sets this flag to silence its environment warning.
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const STEPS: OnboardingStep[] = [
  { icon: '📖', title: 'Read', body: 'Read anything.' },
  { title: 'Listen', body: 'Listen along.' },
  { icon: '✂️', title: 'Capture', body: 'Save fragments.' },
];

let container: HTMLDivElement;
let root: Root;

function render(ui: React.ReactElement): void {
  act(() => {
    root.render(ui);
  });
}

function click(el: Element | null | undefined): void {
  act(() => {
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** The two footer buttons, in DOM order: [secondary (skip/back), primary (next/done)]. */
function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

function title(): string | null {
  return container.querySelector('h2')?.textContent ?? null;
}

function dots(): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="onboarding-dot"]'));
}

/** A dot is "active" when its class carries the wider highlighted width. */
function activeDotIndex(): number {
  return dots().findIndex((d) => d.className.includes('w-6'));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('OnboardingTour', () => {
  it('renders one progress dot per step with the first active by default', () => {
    render(<OnboardingTour steps={STEPS} ariaLabel="Tour" onComplete={jest.fn()} />);
    expect(dots()).toHaveLength(3);
    expect(activeDotIndex()).toBe(0);
    expect(title()).toBe('Read');
  });

  it('exposes the dialog with the given aria-label', () => {
    render(<OnboardingTour steps={STEPS} ariaLabel="Welcome to Noetia" onComplete={jest.fn()} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Welcome to Noetia');
  });

  it('advances on Next, firing onStepChange and updating the visible step', () => {
    const onStepChange = jest.fn();
    render(
      <OnboardingTour steps={STEPS} ariaLabel="Tour" onStepChange={onStepChange} onComplete={jest.fn()} />,
    );
    click(buttons()[1]); // Next
    expect(onStepChange).toHaveBeenCalledWith(1);
    expect(activeDotIndex()).toBe(1);
    expect(title()).toBe('Listen');
  });

  it('shows Skip on the first step and Back after advancing', () => {
    render(<OnboardingTour steps={STEPS} ariaLabel="Tour" onComplete={jest.fn()} />);
    expect(buttons()[0].textContent).toBe('Skip');
    click(buttons()[1]); // Next -> step 1
    expect(buttons()[0].textContent).toBe('Back');
  });

  it('goes back on the secondary button, firing onStepChange', () => {
    const onStepChange = jest.fn();
    render(
      <OnboardingTour
        steps={STEPS}
        ariaLabel="Tour"
        initialStep={2}
        onStepChange={onStepChange}
        onComplete={jest.fn()}
      />,
    );
    click(buttons()[0]); // Back -> step 1
    expect(onStepChange).toHaveBeenCalledWith(1);
    expect(title()).toBe('Listen');
  });

  it('labels the primary button "done" on the last step and calls onComplete', () => {
    const onComplete = jest.fn();
    render(
      <OnboardingTour steps={STEPS} ariaLabel="Tour" initialStep={2} onComplete={onComplete} />,
    );
    expect(buttons()[1].textContent).toBe('Got it');
    click(buttons()[1]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip (not onComplete) when Skip is pressed on the first step', () => {
    const onSkip = jest.fn();
    const onComplete = jest.fn();
    render(
      <OnboardingTour steps={STEPS} ariaLabel="Tour" onSkip={onSkip} onComplete={onComplete} />,
    );
    click(buttons()[0]); // Skip
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('falls back to onComplete when onSkip is omitted', () => {
    const onComplete = jest.fn();
    render(<OnboardingTour steps={STEPS} ariaLabel="Tour" onComplete={onComplete} />);
    click(buttons()[0]); // Skip
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('clamps an out-of-range initialStep into the last step', () => {
    render(
      <OnboardingTour steps={STEPS} ariaLabel="Tour" initialStep={99} onComplete={jest.fn()} />,
    );
    expect(activeDotIndex()).toBe(2);
    expect(title()).toBe('Capture');
  });

  it('renders the icon slot only when a step provides one', () => {
    render(<OnboardingTour steps={STEPS} ariaLabel="Tour" onComplete={jest.fn()} />);
    expect(container.textContent).toContain('📖'); // step 0 has an icon
    click(buttons()[1]); // step 1 has no icon
    expect(container.textContent).not.toContain('📖');
  });

  it('renders nothing when there are no steps', () => {
    render(<OnboardingTour steps={[]} ariaLabel="Tour" onComplete={jest.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toBe('');
  });
});
