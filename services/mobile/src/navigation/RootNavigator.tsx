import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { fetchSubscriptionStatus, requiresPaywall } from '../api/subscriptions';
import { AuthProvider } from '../auth/AuthContext';
import { isLoggedIn } from '../auth/token-storage';
import { LanguageProvider, hasStoredLanguage } from '../i18n';
import { consentIsCurrent } from '../offline/consent-storage';
import { ConsentScreen } from '../screens/ConsentScreen';
import { LanguageScreen } from '../screens/LanguageScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { MainNavigator } from './MainNavigator';

type AppState = 'loading' | 'language' | 'consent' | 'login' | 'register' | 'paywall' | 'app';

async function resolveInitialState(): Promise<AppState> {
  const [hasLang, consent, authed] = await Promise.all([
    hasStoredLanguage(),
    consentIsCurrent(),
    isLoggedIn(),
  ]);
  if (!hasLang) return 'language';
  if (!consent) return 'consent';
  if (!authed) return 'login';
  const status = await fetchSubscriptionStatus();
  return requiresPaywall(status) ? 'paywall' : 'app';
}

function AppNavigator() {
  const [state, setState] = useState<AppState>('loading');

  useEffect(() => {
    resolveInitialState().then(setState);
  }, []);

  async function handleAuthenticated() {
    const status = await fetchSubscriptionStatus();
    setState(requiresPaywall(status) ? 'paywall' : 'app');
  }

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (state === 'language') return <LanguageScreen onSelect={() => setState('consent')} />;
  if (state === 'consent') return <ConsentScreen onConsent={() => setState('login')} />;
  if (state === 'login') return (
    <LoginScreen onLogin={handleAuthenticated} onRegister={() => setState('register')} />
  );
  if (state === 'register') return (
    <RegisterScreen onRegister={handleAuthenticated} onLogin={() => setState('login')} />
  );
  if (state === 'paywall') return <PaywallScreen onSubscribed={() => setState('app')} />;

  return (
    <AuthProvider onLogout={() => setState('login')}>
      <MainNavigator />
    </AuthProvider>
  );
}

export function RootNavigator() {
  return (
    <LanguageProvider>
      <AppNavigator />
    </LanguageProvider>
  );
}
