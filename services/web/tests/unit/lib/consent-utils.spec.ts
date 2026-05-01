import {
  CONSENT_VERSION,
  saveConsent,
  loadConsent,
  needsConsent,
  hasAnalyticsConsent,
  hasMarketingConsent,
  type ConsentRecord,
} from '../../../lib/consent-utils';

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
  clear: jest.fn(() => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); }),
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });
  Object.defineProperty(global, 'window', { value: { localStorage: localStorageMock }, writable: true });
});

const validRecord = (): ConsentRecord => ({
  version: CONSENT_VERSION,
  analytics: true,
  marketing: false,
  timestamp: 1714000000000,
});

describe('loadConsent', () => {
  it('returns null when storage is empty', () => {
    expect(loadConsent()).toBeNull();
  });

  it('returns parsed record when one exists', () => {
    mockStorage['noetia_consent'] = JSON.stringify(validRecord());
    const result = loadConsent();
    expect(result).toMatchObject({ version: CONSENT_VERSION, analytics: true, marketing: false });
  });

  it('returns null when stored value is invalid JSON', () => {
    mockStorage['noetia_consent'] = 'not-json';
    expect(loadConsent()).toBeNull();
  });
});

describe('saveConsent', () => {
  it('writes the record to localStorage as JSON', () => {
    saveConsent(validRecord());
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'noetia_consent',
      JSON.stringify(validRecord()),
    );
  });

  it('overwrites an existing record', () => {
    mockStorage['noetia_consent'] = JSON.stringify(validRecord());
    const updated = { ...validRecord(), analytics: false };
    saveConsent(updated);
    expect(JSON.parse(mockStorage['noetia_consent']).analytics).toBe(false);
  });
});

describe('needsConsent', () => {
  it('returns true when no consent record exists', () => {
    expect(needsConsent()).toBe(true);
  });

  it('returns true when stored version does not match current version', () => {
    mockStorage['noetia_consent'] = JSON.stringify({ ...validRecord(), version: '0.9' });
    expect(needsConsent()).toBe(true);
  });

  it('returns false when stored version matches current version', () => {
    mockStorage['noetia_consent'] = JSON.stringify(validRecord());
    expect(needsConsent()).toBe(false);
  });
});

describe('hasAnalyticsConsent', () => {
  it('returns false when no record exists', () => {
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('returns true when analytics is true in the stored record', () => {
    mockStorage['noetia_consent'] = JSON.stringify(validRecord());
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it('returns false when analytics is false in the stored record', () => {
    mockStorage['noetia_consent'] = JSON.stringify({ ...validRecord(), analytics: false });
    expect(hasAnalyticsConsent()).toBe(false);
  });
});

describe('hasMarketingConsent', () => {
  it('returns false when no record exists', () => {
    expect(hasMarketingConsent()).toBe(false);
  });

  it('returns true when marketing is true in the stored record', () => {
    mockStorage['noetia_consent'] = JSON.stringify({ ...validRecord(), marketing: true });
    expect(hasMarketingConsent()).toBe(true);
  });

  it('returns false when marketing is false in the stored record', () => {
    mockStorage['noetia_consent'] = JSON.stringify(validRecord());
    expect(hasMarketingConsent()).toBe(false);
  });
});
