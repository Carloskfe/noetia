declare module 'expo-notifications' {
  export interface NotificationPermissionsStatus {
    status: 'granted' | 'denied' | 'undetermined';
    granted: boolean;
  }
  export interface ExpoPushToken {
    data: string;
    type: 'expo';
  }
  export interface Notification {
    request: { content: { title?: string; body?: string; data?: Record<string, unknown> } };
  }
  export interface NotificationResponse {
    notification: Notification;
  }

  export function requestPermissionsAsync(): Promise<NotificationPermissionsStatus>;
  export function getExpoPushTokenAsync(): Promise<ExpoPushToken>;
  export function setNotificationHandler(handler: {
    handleNotification: (n: Notification) => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }): void;
  export function addNotificationResponseReceivedListener(
    listener: (response: NotificationResponse) => void,
  ): { remove: () => void };
}
