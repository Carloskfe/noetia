import React, { useState } from 'react';
import {
  Alert,
  BackHandler,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CONSENT_VERSION, saveConsent } from '../offline/consent-storage';

type Props = {
  onConsent: () => void;
};

export function ConsentScreen({ onConsent }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    await saveConsent({ version: CONSENT_VERSION, accepted: true, timestamp: Date.now() });
    setLoading(false);
    onConsent();
  }

  function handleDecline() {
    Alert.alert(
      'Acceso requerido / Access required',
      'Noetia no puede usarse sin aceptar los términos.\nNoetia cannot be used without accepting the terms.',
      [
        {
          text: 'OK',
          onPress: () => {
            if (Platform.OS === 'android') {
              BackHandler.exitApp();
            }
          },
        },
      ],
      { cancelable: false },
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Noetia</Text>
        <Text style={styles.subtitle}>Privacidad y Términos · Privacy & Terms</Text>

        {/* Spanish summary */}
        <Text style={styles.sectionHeader}>🇪🇸 Español</Text>
        <Text style={styles.sectionTitle}>Política de Privacidad</Text>
        <Text style={styles.body}>
          Noetia recopila tu correo electrónico, nombre e información de suscripción (procesada por Stripe) para prestarte el servicio. También guardamos tu progreso de lectura y los fragmentos que crees. No vendemos tus datos a terceros.
        </Text>
        <Text style={styles.body}>
          Tienes derecho a acceder, rectificar y eliminar tus datos en cualquier momento. Para más información, consulta nuestra política completa:
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://noetia.app/legal/privacy')}>
          <Text style={styles.link}>noetia.app/legal/privacy</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Términos de Servicio</Text>
        <Text style={styles.body}>
          Al usar Noetia aceptas que el contenido está protegido por derechos de autor y no puede descargarse ni redistribuirse. La suscripción se renueva automáticamente; puedes cancelarla en cualquier momento. Debes tener al menos 18 años.
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://noetia.app/legal/terms')}>
          <Text style={styles.link}>noetia.app/legal/terms</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* English summary */}
        <Text style={styles.sectionHeader}>🇺🇸 English</Text>
        <Text style={styles.sectionTitle}>Privacy Policy</Text>
        <Text style={styles.body}>
          Noetia collects your email, name, and subscription information (processed by Stripe) to provide the service. We also store your reading progress and the fragments you create. We do not sell your data to third parties.
        </Text>
        <Text style={styles.body}>
          You have the right to access, correct, and delete your data at any time. For full details, see our privacy policy:
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://noetia.app/legal/privacy')}>
          <Text style={styles.link}>noetia.app/legal/privacy</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Terms of Service</Text>
        <Text style={styles.body}>
          By using Noetia you agree that content is copyright-protected and may not be downloaded or redistributed. Subscriptions renew automatically; you may cancel at any time. You must be at least 18 years old.
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://noetia.app/legal/terms')}>
          <Text style={styles.link}>noetia.app/legal/terms</Text>
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={handleAccept}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.btnPrimaryText}>
            {loading ? '...' : 'Acepto / I agree'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDecline} onPress={handleDecline} activeOpacity={0.7}>
          <Text style={styles.btnDeclineText}>No acepto / I decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#0D1B2A', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 4, marginBottom: 28 },
  sectionHeader: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: '#3B82F6', textTransform: 'uppercase', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 6 },
  body: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 8 },
  link: { fontSize: 14, color: '#2563EB', textDecorationLine: 'underline', marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 24 },
  bottomPad: { height: 8 },
  bottomBar: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#fff', gap: 10 },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#0D1B2A' },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnDecline: { alignItems: 'center', paddingVertical: 8 },
  btnDeclineText: { fontSize: 14, color: '#6B7280' },
});
