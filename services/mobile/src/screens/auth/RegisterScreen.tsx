import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { apiClient } from '../../api/client';
import { saveToken, saveUserType } from '../../auth/token-storage';
import { SocialAuthButtons } from '../../auth/SocialAuthButtons';
import { useTranslation } from '../../i18n';

interface Props {
  onRegister: () => void;
  onLogin: () => void;
}

export function RegisterScreen({ onRegister, onLogin }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) { setError(t.auth.register.errors.empty); return; }
    if (password.length < 8) { setError(t.auth.register.errors.passwordShort); return; }
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.post<{ accessToken: string; userType?: string }>(
        '/auth/register', { name: name.trim(), email: email.trim().toLowerCase(), password },
      );
      await saveToken(data.accessToken);
      if (data.userType) await saveUserType(data.userType);
      onRegister();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      setError(status === 409 ? t.auth.register.errors.emailTaken : t.auth.register.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8 && !loading;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Noetia</Text>
        <Text style={styles.subtitle}>{t.auth.register.subtitle}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t.auth.register.name}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder={t.auth.register.namePlaceholder} placeholderTextColor="#9CA3AF"
            autoCapitalize="words" autoComplete="name" returnKeyType="next" />

          <Text style={styles.label}>{t.auth.register.email}</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
            placeholder={t.auth.register.emailPlaceholder} placeholderTextColor="#9CA3AF"
            keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" />

          <Text style={styles.label}>{t.auth.register.password}</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder={t.auth.register.passwordPlaceholder} placeholderTextColor="#9CA3AF"
            secureTextEntry returnKeyType="go" onSubmitEditing={handleRegister} />

          {error !== '' && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handleRegister} disabled={!canSubmit} accessibilityLabel={t.auth.register.submit}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.auth.register.submit}</Text>}
          </TouchableOpacity>

          <SocialAuthButtons onSuccess={onRegister} onError={(msg) => setError(msg)} />

          <TouchableOpacity onPress={onLogin} style={styles.switchRow}>
            <Text style={styles.switchText}>{t.auth.register.hasAccount} </Text>
            <Text style={styles.switchLink}>{t.auth.register.login}</Text>
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
