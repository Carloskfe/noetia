import React, { useState } from 'react';
import {
  ActivityIndicator, Linking, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { fetchSubscriptionStatus, requiresPaywall } from '../api/subscriptions';
import { useTranslation } from '../i18n';

const PRICING_URL = 'https://noetia.app/pricing';
const PLAN_NAMES = ['Individual', 'Duo', 'Family'] as const;

interface Props {
  onSubscribed: () => void;
}

export function PaywallScreen({ onSubscribed }: Props) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  async function handleAlreadySubscribed() {
    setChecking(true);
    setError('');
    const status = await fetchSubscriptionStatus();
    setChecking(false);
    if (!requiresPaywall(status)) {
      onSubscribed();
    } else {
      setError(t.paywall.error);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t.paywall.title}</Text>
      <Text style={styles.subtitle}>{t.paywall.subtitle}</Text>

      {PLAN_NAMES.map((name) => {
        const plan = t.paywall.plans[name];
        const isPopular = plan.popular;
        return (
          <View key={name} style={[styles.card, isPopular && styles.cardPopular]}>
            {isPopular && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t.paywall.popular}</Text>
              </View>
            )}
            <View style={styles.cardHeader}>
              <Text style={[styles.planName, isPopular && styles.planNamePopular]}>{name}</Text>
              <Text style={[styles.planPrice, isPopular && styles.planPricePopular]}>{plan.price}</Text>
            </View>
            <Text style={[styles.tokens, isPopular && styles.tokensPopular]}>{plan.tokens}</Text>
            {plan.features.map((f) => (
              <Text key={f} style={[styles.feature, isPopular && styles.featurePopular]}>✓ {f}</Text>
            ))}
          </View>
        );
      })}

      <TouchableOpacity style={styles.ctaPrimary} onPress={() => Linking.openURL(PRICING_URL)}
        accessibilityLabel={t.paywall.subscribe}>
        <Text style={styles.ctaPrimaryText}>{t.paywall.subscribe}</Text>
      </TouchableOpacity>

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.ctaSecondary} onPress={handleAlreadySubscribed}
        disabled={checking} accessibilityLabel={t.paywall.alreadySubscribed}>
        {checking
          ? <ActivityIndicator color="#4F46E5" />
          : <Text style={styles.ctaSecondaryText}>{t.paywall.alreadySubscribed}</Text>}
      </TouchableOpacity>

      <Text style={styles.hint}>{t.paywall.hint}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flexGrow: 1, alignItems: 'center', padding: 24, paddingTop: 48, backgroundColor: '#fff' },
  title:            { fontSize: 28, fontWeight: '800', color: '#0D1B2A', marginBottom: 8 },
  subtitle:         { fontSize: 14, color: '#6B7280', marginBottom: 28, textAlign: 'center' },
  card:             { width: '100%', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 20, marginBottom: 12 },
  cardPopular:      { borderColor: '#4F46E5', borderWidth: 2, backgroundColor: '#4F46E5' },
  badge:            { position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: '#4F46E5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3 },
  badgeText:        { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  planName:         { fontSize: 17, fontWeight: '700', color: '#0D1B2A' },
  planNamePopular:  { color: '#fff' },
  planPrice:        { fontSize: 20, fontWeight: '800', color: '#4F46E5' },
  planPricePopular: { color: '#C7D2FE' },
  tokens:           { fontSize: 13, color: '#6B7280', marginBottom: 10, fontWeight: '600' },
  tokensPopular:    { color: '#C7D2FE' },
  feature:          { fontSize: 13, color: '#374151', marginBottom: 3 },
  featurePopular:   { color: '#E0E7FF' },
  ctaPrimary:       { width: '100%', backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  ctaPrimaryText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  error:            { fontSize: 13, color: '#EF4444', marginTop: 12, textAlign: 'center' },
  ctaSecondary:     { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24 },
  ctaSecondaryText: { color: '#4F46E5', fontSize: 15, fontWeight: '600' },
  hint:             { fontSize: 12, color: '#9CA3AF', marginTop: 8, textAlign: 'center', paddingHorizontal: 16, marginBottom: 32 },
});
