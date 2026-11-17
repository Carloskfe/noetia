import { apiClient } from './client';

export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'canceling'
  | 'past_due'
  | 'canceled';

export interface SubscriptionInfo {
  status: SubscriptionStatus;
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    const data = await apiClient.get<SubscriptionInfo>('/subscriptions/me');
    return data.status ?? 'none';
  } catch {
    return 'none';
  }
}

/**
 * D1/D6 (PO 2026-11-13): whether the API would offer this user a free trial. `null` when unknown (not signed in,
 * network/API failure, or the API could not verify) — the paywall then does not mention a trial.
 */
export async function fetchTrialEligibility(): Promise<boolean | null> {
  try {
    const data = await apiClient.get<{ trialEligible?: boolean | null }>('/subscriptions/me?trialEligibility=1');
    return typeof data?.trialEligible === 'boolean' ? data.trialEligible : null;
  } catch {
    return null;
  }
}

/** Which paywall subtitle to show: a trial only for a confirmed-eligible user, never for a returning one. */
export function paywallSubtitleKey(trialEligible: boolean | null): 'subtitle' | 'subtitleReturning' | 'subtitleNeutral' {
  if (trialEligible === true) return 'subtitle';
  if (trialEligible === false) return 'subtitleReturning';
  return 'subtitleNeutral';
}

export function requiresPaywall(status: SubscriptionStatus): boolean {
  return status === 'none' || status === 'canceled' || status === 'past_due';
}
