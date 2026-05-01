import AsyncStorage from '@react-native-async-storage/async-storage';

export const CONSENT_VERSION = '1.0';
const STORAGE_KEY = 'noetia_consent';

export type MobileConsentRecord = {
  version: string;
  accepted: boolean;
  timestamp: number;
};

export async function saveConsent(record: MobileConsentRecord): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export async function loadConsent(): Promise<MobileConsentRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MobileConsentRecord;
  } catch {
    return null;
  }
}

export async function consentIsCurrent(): Promise<boolean> {
  const record = await loadConsent();
  if (!record) return false;
  return record.version === CONSENT_VERSION && record.accepted === true;
}
