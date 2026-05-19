import React, { useState } from 'react';
import {
  ActivityIndicator, Linking, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { fetchSubscriptionStatus, requiresPaywall } from '../api/subscriptions';

const PRICING_URL = 'https://noetia.app/pricing';

const PLANS = [
  {
    name: 'Individual',
    price: '$8.99/mes',
    tokens: '1 token/mes',
    features: ['Acceso completo a la biblioteca', '90 días para usar el token', 'Fragmentos y compartir'],
  },
  {
    name: 'Duo',
    price: '$13.99/mes',
    tokens: '2 tokens compartidos/mes',
    features: ['Todo lo del plan Individual', 'Hasta 2 usuarios', 'Bibliotecas personales independientes'],
    popular: true,
  },
  {
    name: 'Family',
    price: '$18.99/mes',
    tokens: '4 tokens compartidos/mes',
    features: ['Todo lo del plan Duo', 'Hasta 5 usuarios'],
  },
];

interface Props {
  onSubscribed: () => void;
}

export function PaywallScreen({ onSubscribed }: Props) {
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
      setError('No encontramos una suscripción activa. Suscríbete en noetia.app/pricing.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Noetia Premium</Text>
      <Text style={styles.subtitle}>
        14 días de prueba gratuita. Cancela cuando quieras.
      </Text>

      {PLANS.map((plan) => (
        <View key={plan.name} style={[styles.card, plan.popular && styles.cardPopular]}>
          {plan.popular && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Más popular</Text>
            </View>
          )}
          <View style={styles.cardHeader}>
            <Text style={[styles.planName, plan.popular && styles.planNamePopular]}>{plan.name}</Text>
            <Text style={[styles.planPrice, plan.popular && styles.planPricePopular]}>{plan.price}</Text>
          </View>
          <Text style={[styles.tokens, plan.popular && styles.tokensPopular]}>{plan.tokens}</Text>
          {plan.features.map((f) => (
            <Text key={f} style={[styles.feature, plan.popular && styles.featurePopular]}>✓ {f}</Text>
          ))}
        </View>
      ))}

      <TouchableOpacity
        style={styles.ctaPrimary}
        onPress={() => Linking.openURL(PRICING_URL)}
        accessibilityLabel="Ver planes"
      >
        <Text style={styles.ctaPrimaryText}>Ver planes y suscribirme →</Text>
      </TouchableOpacity>

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={styles.ctaSecondary}
        onPress={handleAlreadySubscribed}
        disabled={checking}
        accessibilityLabel="Ya me suscribí"
      >
        {checking
          ? <ActivityIndicator color="#4F46E5" />
          : <Text style={styles.ctaSecondaryText}>Ya me suscribí</Text>}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Suscríbete en noetia.app, luego regresa y toca "Ya me suscribí".
      </Text>
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
