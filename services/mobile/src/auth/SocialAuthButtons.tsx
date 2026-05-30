import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../api/client';
import { saveToken, saveUserType } from './token-storage';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? '';

interface Props {
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function SocialAuthButtons({ onSuccess, onError }: Props) {
  const [loading, setLoading] = useState<'google' | 'facebook' | 'apple' | null>(null);

  // ── Google ──────────────────────────────────────────────────────────────────
  const googleDiscovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  const googleRedirectUri = AuthSession.makeRedirectUri({ scheme: 'noetia' });
  const [googleRequest, googleResponse, promptGoogleAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: googleRedirectUri,
    },
    googleDiscovery,
  );

  React.useEffect(() => {
    if (googleResponse?.type === 'success') {
      const auth = (googleResponse as any).authentication;
      handleGoogleToken(auth?.idToken ?? (googleResponse as any).params?.id_token);
    } else if (googleResponse?.type === 'error') {
      setLoading(null);
      onError('Error al conectar con Google. Inténtalo de nuevo.');
    }
  }, [googleResponse]);

  async function handleGoogleToken(idToken: string | undefined) {
    if (!idToken) { setLoading(null); onError('No se recibió token de Google.'); return; }
    try {
      const data = await apiClient.post<{ accessToken: string; user: { userType?: string } }>(
        '/auth/google/mobile',
        { idToken },
      );
      await saveToken(data.accessToken);
      if (data.user?.userType) await saveUserType(data.user.userType);
      onSuccess();
    } catch {
      onError('Error al iniciar sesión con Google.');
    } finally {
      setLoading(null);
    }
  }

  async function signInWithGoogle() {
    setLoading('google');
    await promptGoogleAsync();
  }

  // ── Facebook ────────────────────────────────────────────────────────────────
  const facebookDiscovery = {
    authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
  };

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'noetia' });

  const [fbRequest, fbResponse, promptFacebookAsync] = AuthSession.useAuthRequest(
    {
      clientId: FACEBOOK_APP_ID,
      scopes: ['public_profile', 'email'],
      redirectUri,
    },
    facebookDiscovery,
  );

  React.useEffect(() => {
    if (fbResponse?.type === 'success') {
      const fbToken = (fbResponse as any).params?.access_token ?? fbResponse.authentication?.accessToken;
      handleFacebookToken(fbToken);
    } else if (fbResponse?.type === 'error') {
      setLoading(null);
      onError('Error al conectar con Facebook. Inténtalo de nuevo.');
    }
  }, [fbResponse]);

  async function handleFacebookToken(accessToken: string | undefined) {
    if (!accessToken) { setLoading(null); onError('No se recibió token de Facebook.'); return; }
    try {
      const data = await apiClient.post<{ accessToken: string; user: { userType?: string } }>(
        '/auth/facebook/mobile',
        { accessToken },
      );
      await saveToken(data.accessToken);
      if (data.user?.userType) await saveUserType(data.user.userType);
      onSuccess();
    } catch {
      onError('Error al iniciar sesión con Facebook.');
    } finally {
      setLoading(null);
    }
  }

  async function signInWithFacebook() {
    if (!FACEBOOK_APP_ID) { onError('Facebook no está configurado.'); return; }
    setLoading('facebook');
    await promptFacebookAsync();
  }

  // ── Apple (iOS only) ────────────────────────────────────────────────────────
  async function signInWithApple() {
    setLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : undefined;
      const data = await apiClient.post<{ accessToken: string; user: { userType?: string } }>(
        '/auth/apple/mobile',
        { identityToken: credential.identityToken, fullName },
      );
      await saveToken(data.accessToken);
      if (data.user?.userType) await saveUserType(data.user.userType);
      onSuccess();
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        onError('Error al iniciar sesión con Apple.');
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>o continúa con</Text>
        <View style={styles.line} />
      </View>

      {/* Google */}
      <TouchableOpacity
        style={styles.btn}
        onPress={signInWithGoogle}
        disabled={!!loading || !googleRequest}
        accessibilityLabel="Continuar con Google"
      >
        {loading === 'google'
          ? <ActivityIndicator color="#374151" />
          : <Text style={styles.btnText}>🅶  Continuar con Google</Text>}
      </TouchableOpacity>

      {/* Facebook */}
      <TouchableOpacity
        style={[styles.btn, styles.fbBtn]}
        onPress={signInWithFacebook}
        disabled={!!loading}
        accessibilityLabel="Continuar con Facebook"
      >
        {loading === 'facebook'
          ? <ActivityIndicator color="#fff" />
          : <Text style={[styles.btnText, styles.fbText]}>f  Continuar con Facebook</Text>}
      </TouchableOpacity>

      {/* Apple — iOS only */}
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10}
          style={styles.appleBtn}
          onPress={signInWithApple}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginTop: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 10, fontSize: 13, color: '#9CA3AF' },
  btn: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
    backgroundColor: '#fff',
  },
  btnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  fbBtn: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  fbText: { color: '#fff' },
  appleBtn: { width: '100%', height: 48, marginBottom: 10 },
});
