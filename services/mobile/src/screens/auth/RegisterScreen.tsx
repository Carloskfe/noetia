import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { apiClient } from '../../api/client';
import { saveToken, saveUserType } from '../../auth/token-storage';
import { SocialAuthButtons } from '../../auth/SocialAuthButtons';

interface Props {
  onRegister: () => void;
  onLogin: () => void;
}

export function RegisterScreen({ onRegister, onLogin }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Completa todos los campos.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.post<{ accessToken: string; userType?: string }>(
        '/auth/register',
        { name: name.trim(), email: email.trim().toLowerCase(), password },
      );
      await saveToken(data.accessToken);
      if (data.userType) await saveUserType(data.userType);
      onRegister();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      setError(
        status === 409
          ? 'Ya existe una cuenta con ese correo.'
          : 'Error al crear la cuenta. Inténtalo de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8 && !loading;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Noetia</Text>
        <Text style={styles.subtitle}>Crea tu cuenta gratis</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
          />

          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleRegister}
          />

          {error !== '' && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit}
            accessibilityLabel="Crear cuenta"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Crear cuenta</Text>}
          </TouchableOpacity>

          <SocialAuthButtons
            onSuccess={onRegister}
            onError={(msg) => setError(msg)}
          />

          <TouchableOpacity onPress={onLogin} style={styles.switchRow}>
            <Text style={styles.switchText}>¿Ya tienes cuenta? </Text>
            <Text style={styles.switchLink}>Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: '#fff' },
  container:  { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo:       { fontSize: 38, fontWeight: '800', color: '#0D1B2A', marginBottom: 6 },
  subtitle:   { fontSize: 15, color: '#6B7280', marginBottom: 44 },
  form:       { width: '100%' },
  label:      { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:      {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 14, fontSize: 16, color: '#0D1B2A',
    backgroundColor: '#F9FAFB', marginBottom: 16,
  },
  error:      { fontSize: 13, color: '#EF4444', marginBottom: 12, textAlign: 'center' },
  btn:        { backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  switchText: { fontSize: 14, color: '#6B7280' },
  switchLink: { fontSize: 14, color: '#4F46E5', fontWeight: '600' },
});
