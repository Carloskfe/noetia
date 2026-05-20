import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { apiClient } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useTranslation, type Language } from '../../i18n';

interface User {
  id: string;
  name: string | null;
  email: string;
  userType: string;
}

const LANG_FLAGS: Record<Language, string> = { es: '🇪🇸', en: '🇺🇸' };

export function AccountScreen() {
  const { logout } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<User>('/users/me').then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(t.account.logout, t.account.logoutConfirm, [
      { text: t.account.cancel, style: 'cancel' },
      { text: t.account.logout, style: 'destructive', onPress: logout },
    ]);
  }, [logout, t]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#4F46E5" /></View>;
  }

  const displayName = user?.name ?? user?.email ?? 'Usuario';
  const initials = displayName.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>{t.account.title}</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{user?.name ?? t.account.noName}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.userType && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {t.account.userTypes[user.userType as keyof typeof t.account.userTypes] ?? user.userType}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Language toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.account.language}</Text>
        <View style={styles.langRow}>
          {(['es', 'en'] as Language[]).map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[styles.langBtn, language === lang && styles.langBtnActive]}
              onPress={() => setLanguage(lang)}
            >
              <Text style={[styles.langBtnText, language === lang && styles.langBtnTextActive]}>
                {LANG_FLAGS[lang]} {t.lang[lang]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityLabel={t.account.logout}>
          <Text style={styles.logoutText}>{t.account.logout}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#fff' },
  content:          { padding: 24, paddingBottom: 48 },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:           { fontSize: 28, fontWeight: '800', color: '#0D1B2A', marginBottom: 28 },
  profileCard:      { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  avatar:           { width: 64, height: 64, borderRadius: 32, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  avatarText:       { color: '#fff', fontSize: 22, fontWeight: '700' },
  profileInfo:      { flex: 1 },
  name:             { fontSize: 18, fontWeight: '700', color: '#0D1B2A', marginBottom: 2 },
  email:            { fontSize: 14, color: '#6B7280', marginBottom: 6 },
  badge:            { alignSelf: 'flex-start', backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:        { fontSize: 12, color: '#4F46E5', fontWeight: '600' },
  section:          { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 20, marginBottom: 20 },
  sectionTitle:     { fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  langRow:          { flexDirection: 'row', gap: 8 },
  langBtn:          { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  langBtnActive:    { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  langBtnText:      { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  langBtnTextActive:{ color: '#4F46E5', fontWeight: '600' },
  logoutBtn:        { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  logoutText:       { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});
