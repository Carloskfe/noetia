import { TourProvider, useTour } from '../../../src/components/TourContext';

describe('TourProvider', () => {
  it('exports a React function component', () => {
    expect(typeof TourProvider).toBe('function');
  });
});

describe('useTour', () => {
  it('exports a function', () => {
    expect(typeof useTour).toBe('function');
  });
});
