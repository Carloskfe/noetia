import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { apiClient } from '../../api/client';
import { saveToken, saveRefreshToken, saveUserType } from '../../auth/token-storage';
import { SocialAuthButtons } from '../../auth/SocialAuthButtons';
import { useTranslation } from '../../i18n';

interface Props {
  onLogin: () => void;
  onRegister: () => void;
}

export function LoginScreen({ onLogin, onRegister }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setError(t.auth.login.errors.empty); return; }
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.post<{ accessToken: string; refreshToken?: string; userType?: string }>(
        '/auth/login', { email: email.trim().toLowerCase(), password },
      );
      await saveToken(data.accessToken);
      if (data.refreshToken) await saveRefreshToken(data.refreshToken);
      if (data.userType) await saveUserType(data.userType);
      onLogin();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      setError(status === 401 ? t.auth.login.errors.invalid : t.auth.login.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Noetia</Text>
        <Text style={styles.subtitle}>{t.auth.login.subtitle}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t.auth.login.email}</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
            placeholder={t.auth.login.emailPlaceholder} placeholderTextColor="#9CA3AF"
            keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" />

          <Text style={styles.label}>{t.auth.login.password}</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder={t.auth.login.passwordPlaceholder} placeholderTextColor="#9CA3AF"
            secureTextEntry returnKeyType="go" onSubmitEditing={handleLogin} />

          {error !== '' && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handleLogin} disabled={!canSubmit} accessibilityLabel={t.auth.login.submit}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.auth.login.submit}</Text>}
          </TouchableOpacity>

          <SocialAuthButtons onSuccess={onLogin} onError={(msg) => setError(msg)} />

          <TouchableOpacity onPress={onRegister} style={styles.switchRow}>
            <Text style={styles.switchText}>{t.auth.login.noAccount} </Text>
            <Text style={styles.switchLink}>{t.auth.login.register}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: '#fff' },
  container:   { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo:        { fontSize: 38, fontWeight: '800', color: '#0D1B2A', marginBottom: 6 },
  subtitle:    { fontSize: 15, color: '#6B7280', marginBottom: 44 },
  form:        { width: '100%' },
  label:       { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:       { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 14, fontSize: 16, color: '#0D1B2A', backgroundColor: '#F9FAFB', marginBottom: 16 },
  error:       { fontSize: 13, color: '#EF4444', marginBottom: 12, textAlign: 'center' },
  btn:         { backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchRow:   { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  switchText:  { fontSize: 14, color: '#6B7280' },
  switchLink:  { fontSize: 14, color: '#4F46E5', fontWeight: '600' },
});
