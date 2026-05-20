import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { syncOfflineData, SyncClient } from '../offline/sync';

function buildSyncClient(): SyncClient {
  return {
    createFragment: (payload) =>
      apiClient.post('/fragments', payload),
    deleteFragment: (serverId) =>
      apiClient.delete(`/fragments/${serverId}`),
    updateProgress: (payload) =>
      apiClient.post(`/books/${payload.bookId}/progress`, {
        chapterIndex: payload.chapterIndex,
        phraseIndex: payload.phraseIndex,
      }),
  };
}

export function useNetworkSync() {
  const wasOffline = useRef<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = !!(state.isConnected && state.isInternetReachable);

      // Trigger sync only on offline → online transition
      if (wasOffline.current === true && isOnline) {
        syncOfflineData(buildSyncClient()).catch(() => {});
      }

      wasOffline.current = !isOnline;
    });

    return unsubscribe;
  }, []);
}
