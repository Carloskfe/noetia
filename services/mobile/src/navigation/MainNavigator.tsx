import React from 'react';
import { Text } from 'react-native';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LibraryScreen } from '../screens/library/LibraryScreen';
import { ReaderScreen } from '../screens/reader/ReaderScreen';
import { FragmentsScreen } from '../screens/fragments/FragmentsScreen';
import { AccountScreen } from '../screens/account/AccountScreen';
import type { LibraryStackParamList, RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const LibStack = createNativeStackNavigator<LibraryStackParamList>();

function LibraryStackNavigator() {
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
          headerBackTitle: 'Biblioteca',
        })}
      />
    </LibStack.Navigator>
  );
}

const TAB_ICONS: Record<string, string> = {
  Library: '📚',
  Fragments: '🔖',
  Account: '👤',
};

const TAB_LABELS: Record<string, string> = {
  Library: 'Biblioteca',
  Fragments: 'Fragmentos',
  Account: 'Cuenta',
};

export function MainNavigator() {
  useNetworkSync();
  usePushNotifications();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: () => (
          <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name]}</Text>
        ),
        tabBarLabel: TAB_LABELS[route.name] ?? route.name,
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Library" component={LibraryStackNavigator} />
      <Tab.Screen name="Fragments" component={FragmentsScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
