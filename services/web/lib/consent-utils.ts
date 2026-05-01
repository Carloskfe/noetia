export const CONSENT_VERSION = '1.0';
const STORAGE_KEY = 'noetia_consent';

export type ConsentRecord = {
  version: string;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
};

export function saveConsent(record: ConsentRecord): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function loadConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentRecord;
  } catch {
    return null;
  }
}

export function needsConsent(): boolean {
  const record = loadConsent();
  if (!record) return true;
  return record.version !== CONSENT_VERSION;
}

export function hasAnalyticsConsent(): boolean {
  return loadConsent()?.analytics === true;
}

export function hasMarketingConsent(): boolean {
  return loadConsent()?.marketing === true;
}
