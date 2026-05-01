jest.mock('@react-native-async-storage/async-storage');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONSENT_VERSION, saveConsent, loadConsent, consentIsCurrent } from '../../../src/offline/consent-storage';

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockSet = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReset();
  mockSet.mockReset();
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue(undefined);
});

describe('loadConsent', () => {
  it('returns null when no record is stored', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await loadConsent()).toBeNull();
  });

  it('returns parsed record when one exists', async () => {
    const record = { version: CONSENT_VERSION, accepted: true, timestamp: 1714000000000 };
    mockGet.mockResolvedValueOnce(JSON.stringify(record));
    const result = await loadConsent();
    expect(result).toMatchObject({ version: CONSENT_VERSION, accepted: true });
  });

  it('returns null on invalid JSON', async () => {
    mockGet.mockResolvedValueOnce('bad-json');
    expect(await loadConsent()).toBeNull();
  });
});

describe('saveConsent', () => {
  it('calls AsyncStorage.setItem with correct key and JSON', async () => {
    const record = { version: CONSENT_VERSION, accepted: true, timestamp: 1714000000000 };
    await saveConsent(record);
    expect(mockSet).toHaveBeenCalledWith('noetia_consent', JSON.stringify(record));
  });
});

describe('consentIsCurrent', () => {
  it('returns false when no record is stored', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await consentIsCurrent()).toBe(false);
  });

  it('returns false when version does not match', async () => {
    mockGet.mockResolvedValueOnce(
      JSON.stringify({ version: '0.9', accepted: true, timestamp: 1714000000000 }),
    );
    expect(await consentIsCurrent()).toBe(false);
  });

  it('returns false when accepted is false', async () => {
    mockGet.mockResolvedValueOnce(
      JSON.stringify({ version: CONSENT_VERSION, accepted: false, timestamp: 1714000000000 }),
    );
    expect(await consentIsCurrent()).toBe(false);
  });

  it('returns true when version matches and accepted is true', async () => {
    mockGet.mockResolvedValueOnce(
      JSON.stringify({ version: CONSENT_VERSION, accepted: true, timestamp: 1714000000000 }),
    );
    expect(await consentIsCurrent()).toBe(true);
  });
});
