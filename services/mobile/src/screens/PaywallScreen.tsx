import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchSubscriptionStatus, requiresPaywall, SubscriptionStatus } from '../api/subscriptions';

const PRICING_URL = 'https://noetia.app/pricing';

let sessionCache: SubscriptionStatus | null = null;

export function useSubscriptionStatus(): { status: SubscriptionStatus | null; isLoading: boolean } {
  const [status, setStatus] = useState<SubscriptionStatus | null>(sessionCache);
  const [isLoading, setIsLoading] = useState(sessionCache === null);
  const fetched = useRef(sessionCache !== null);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
    fetchSubscriptionStatus(apiUrl)
      .then((s) => {
        sessionCache = s;
        setStatus(s);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { status, isLoading };
}

const PLANS = [
  { name: 'Individual', price: '$9.99/mo', features: ['Unlimited books', 'Phrase-sync reader', 'Fragment sheets'] },
  { name: 'Dual Reader', price: '$14.99/mo', features: ['Everything in Individual', '2 simultaneous profiles', 'Shared library'] },
];

export function PaywallScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Noetia Premium</Text>
      <Text style={styles.subtitle}>Choose a plan to start reading</Text>

      {PLANS.map((plan) => (
        <View key={plan.name} style={styles.card}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planPrice}>{plan.price}</Text>
          {plan.features.map((f) => (
            <Text key={f} style={styles.feature}>✓ {f}</Text>
          ))}
        </View>
      ))}

      <TouchableOpacity
        style={styles.cta}
        onPress={() => Linking.openURL(PRICING_URL)}
        accessibilityLabel="Subscribe now"
      >
        <Text style={styles.ctaText}>Subscribe now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title:     { fontSize: 28, fontWeight: '700', color: '#0D1B2A', marginBottom: 8 },
  subtitle:  { fontSize: 16, color: '#6B7280', marginBottom: 24 },
  card:      { width: '100%', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 },
  planName:  { fontSize: 18, fontWeight: '600', color: '#0D1B2A', marginBottom: 4 },
  planPrice: { fontSize: 24, fontWeight: '700', color: '#4F46E5', marginBottom: 12 },
  feature:   { fontSize: 14, color: '#374151', marginBottom: 4 },
  cta:       { backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  ctaText:   { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export { requiresPaywall };
