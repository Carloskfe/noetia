import { clampStep, stepNav, primaryLabel, secondaryLabel } from '../../../lib/onboarding-stepper';

describe('clampStep', () => {
  it('keeps an in-range index unchanged', () => {
    expect(clampStep(1, 4)).toBe(1);
  });
  it('clamps a negative index to 0', () => {
    expect(clampStep(-3, 4)).toBe(0);
  });
  it('clamps an over-range resume index to the last step', () => {
    expect(clampStep(9, 4)).toBe(3);
  });
  it('returns 0 for an empty step list', () => {
    expect(clampStep(2, 0)).toBe(0);
  });
  it('returns 0 for a non-finite index', () => {
    expect(clampStep(NaN, 4)).toBe(0);
  });
  it('floors a fractional index', () => {
    expect(clampStep(2.9, 4)).toBe(2);
  });
});

describe('stepNav', () => {
  it('flags the first step', () => {
    expect(stepNav(0, 4)).toEqual({ isFirst: true, isLast: false });
  });
  it('flags the last step', () => {
    expect(stepNav(3, 4)).toEqual({ isFirst: false, isLast: true });
  });
  it('flags a middle step as neither', () => {
    expect(stepNav(1, 4)).toEqual({ isFirst: false, isLast: false });
  });
  it('treats a single-step tour as both first and last', () => {
    expect(stepNav(0, 1)).toEqual({ isFirst: true, isLast: true });
  });
});

describe('primaryLabel', () => {
  const labels = { next: 'Next', done: 'Got it' };
  it('shows "next" on a non-last step', () => {
    expect(primaryLabel(0, 3, labels)).toBe('Next');
  });
  it('shows "done" on the last step', () => {
    expect(primaryLabel(2, 3, labels)).toBe('Got it');
  });
});

describe('secondaryLabel', () => {
  const labels = { skip: 'Skip', prev: 'Back' };
  it('shows "skip" on the first step', () => {
    expect(secondaryLabel(0, labels)).toBe('Skip');
  });
  it('shows "prev" after the first step', () => {
    expect(secondaryLabel(1, labels)).toBe('Back');
  });
});
