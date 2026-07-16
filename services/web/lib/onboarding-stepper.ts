/** Pure step-navigation logic for the reusable OnboardingTour stepper.
 *  Kept separate from the component so it's unit-testable without a DOM. */

/** Clamp a (possibly out-of-range or resume) index into [0, total-1]. */
export function clampStep(step: number, total: number): number {
  if (total <= 0) return 0;
  if (!Number.isFinite(step)) return 0;
  return Math.min(Math.max(Math.floor(step), 0), total - 1);
}

export interface StepNav {
  isFirst: boolean;
  isLast: boolean;
}

export function stepNav(step: number, total: number): StepNav {
  return { isFirst: step <= 0, isLast: step >= total - 1 };
}

/** The label for the primary (right) button: "done" on the last step, else "next". */
export function primaryLabel(step: number, total: number, labels: { next: string; done: string }): string {
  return stepNav(step, total).isLast ? labels.done : labels.next;
}

/** The label for the secondary (left) button: "skip" on the first step, else "prev". */
export function secondaryLabel(step: number, labels: { skip: string; prev: string }): string {
  return step <= 0 ? labels.skip : labels.prev;
}
