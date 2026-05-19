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

export function requiresPaywall(status: SubscriptionStatus): boolean {
  return status === 'none' || status === 'canceled' || status === 'past_due';
}
