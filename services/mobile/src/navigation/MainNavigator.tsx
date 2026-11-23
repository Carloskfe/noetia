import React from 'react';
import { Text } from 'react-native';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useTranslation } from '../i18n';
import type { MobileTranslations } from '../i18n/en';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LibraryScreen } from '../screens/library/LibraryScreen';
import { ReaderScreen } from '../screens/reader/ReaderScreen';
import { FragmentsScreen } from '../screens/fragments/FragmentsScreen';
import { AccountScreen } from '../screens/account/AccountScreen';
import { ClubsScreen } from '../screens/clubs/ClubsScreen';
import { ClubScreen } from '../screens/clubs/ClubScreen';
import { LiveSessionScreen } from '../screens/clubs/LiveSessionScreen';
import type { LibraryStackParamList, ClubsStackParamList, RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const LibStack   = createNativeStackNavigator<LibraryStackParamList>();
const ClubsStack = createNativeStackNavigator<ClubsStackParamList>();

function LibraryStackNavigator() {
  const { t } = useTranslation();
  return (
    <LibStack.Navigator>
      <LibStack.Screen
        name="LibraryHome"
        component={LibraryScreen}
        options={{ headerShown: false }}
      />
      <LibStack.Screen
        name="Reader"
        component={ReaderScreen}
        options={({ route }) => ({
          title: route.params.bookTitle,
          headerBackTitle: t.nav.library,
        })}
      />
    </LibStack.Navigator>
  );
}

function ClubsStackNavigator() {
  const { t } = useTranslation();
  return (
    <ClubsStack.Navigator>
      <ClubsStack.Screen name="ClubsHome" component={ClubsScreen} options={{ headerShown: false }} />
      <ClubsStack.Screen
        name="ClubDetail"
        component={ClubScreen}
        options={({ route }) => ({ title: route.params.clubName, headerBackTitle: t.nav.clubs })}
      />
      <ClubsStack.Screen
        name="LiveSession"
        component={LiveSessionScreen}
        options={({ route }) => ({ title: route.params.sessionTitle, headerBackTitle: t.nav.club })}
      />
    </ClubsStack.Navigator>
  );
}

const TAB_ICONS: Record<string, string> = {
  Library:   '📚',
  Clubs:     '👥',
  Fragments: '🔖',
  Account:   '👤',
};

// Tab labels come from the active interface language. The navigators re-render when the language
// changes (they read the language context) while keeping the same screens and component references,
// so React Navigation keeps its state: no sign-out, restart or navigation reset (NEM-025 B1-B, M-1).
export function tabLabel(t: MobileTranslations, routeName: string): string {
  const labels: Record<string, string> = {
    Library:   t.nav.library,
    Clubs:     t.nav.clubs,
    Fragments: t.nav.fragments,
    Account:   t.nav.account,
  };
  return labels[routeName] ?? routeName;
}

export function MainNavigator() {
  const { t } = useTranslation();
  useNetworkSync();
  usePushNotifications();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: () => (
          <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name]}</Text>
        ),
        tabBarLabel: tabLabel(t, route.name),
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Library"   component={LibraryStackNavigator} />
      <Tab.Screen name="Clubs"     component={ClubsStackNavigator} />
      <Tab.Screen name="Fragments" component={FragmentsScreen} />
      <Tab.Screen name="Account"   component={AccountScreen} />
    </Tab.Navigator>
  );
}
