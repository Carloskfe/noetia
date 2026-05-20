import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

// Show notifications while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  useEffect(() => {
    async function register() {
      const { granted } = await Notifications.requestPermissionsAsync();
      if (!granted) return;

      const { data: token } = await Notifications.getExpoPushTokenAsync();
      await apiClient.post('/push/register', {
        token,
        platform: Platform.OS,
      }).catch(() => {});
    }

    register();

    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Notification tapped — future: navigate based on response.notification.request.content.data.type
    });

    return () => sub.remove();
  }, []);
}
