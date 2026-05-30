jest.mock('@react-native-async-storage/async-storage');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isTourDismissed, dismissTour, resetTour } from '../../../src/offline/tour-storage';

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockSet = AsyncStorage.setItem as jest.Mock;
const mockRemove = AsyncStorage.removeItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
});

describe('isTourDismissed', () => {
  it('returns false when key is absent', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await isTourDismissed()).toBe(false);
  });

  it('returns true when key is "true"', async () => {
    mockGet.mockResolvedValueOnce('true');
    expect(await isTourDismissed()).toBe(true);
  });

  it('returns false for any value other than "true"', async () => {
    mockGet.mockResolvedValueOnce('false');
    expect(await isTourDismissed()).toBe(false);
  });

  it('reads from the correct key', async () => {
    await isTourDismissed();
    expect(mockGet).toHaveBeenCalledWith('noetia_tour_dismissed');
  });
});

describe('dismissTour', () => {
  it('writes "true" to the correct key', async () => {
    await dismissTour();
    expect(mockSet).toHaveBeenCalledWith('noetia_tour_dismissed', 'true');
  });
});

describe('resetTour', () => {
  it('removes the correct key', async () => {
    await resetTour();
    expect(mockRemove).toHaveBeenCalledWith('noetia_tour_dismissed');
  });
});
