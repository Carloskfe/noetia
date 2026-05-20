import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { apiClient } from '../../api/client';
import { loadFragments, deleteFragment } from '../../offline/fragment-storage';
import { useTranslation } from '../../i18n';

interface Fragment {
  id: string;
  bookId: string;
  text: string;
  createdAt: string;
}

export function FragmentsScreen() {
  const { t } = useTranslation();
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [apiRes, offlineRes] = await Promise.allSettled([
      apiClient.get<Fragment[]>('/fragments'),
      loadFragments(),
    ]);

    const api = apiRes.status === 'fulfilled' ? (apiRes.value ?? []) : [];
    const offline = offlineRes.status === 'fulfilled' ? offlineRes.value : [];

    const apiIds = new Set(api.map((f) => f.id));
    const offlineOnly = offline
      .filter((f) => !f.synced && !apiIds.has(f.serverId ?? ''))
      .map((f) => ({
        id: f.localId,
        bookId: f.bookId,
        text: f.text,
        createdAt: new Date(f.createdAt).toISOString(),
      }));

    setFragments([...api, ...offlineOnly]);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDelete = useCallback((frag: Fragment) => {
    Alert.alert(t.fragments.deleteTitle, t.fragments.deleteConfirm, [
      { text: t.fragments.cancel, style: 'cancel' },
      {
        text: t.fragments.delete, style: 'destructive',
        onPress: async () => {
          await apiClient.delete(`/fragments/${frag.id}`).catch(() => {});
          await deleteFragment(frag.id).catch(() => {});
          setFragments((prev) => prev.filter((f) => f.id !== frag.id));
        },
      },
    ]);
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#4F46E5" /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t.fragments.title}</Text>
      {fragments.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔖</Text>
          <Text style={styles.emptyTitle}>{t.fragments.empty}</Text>
          <Text style={styles.emptyBody}>{t.fragments.emptySubtitle}</Text>
        </View>
      ) : (
        <FlatList
          data={fragments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onLongPress={() => handleDelete(item)}
              activeOpacity={0.75}
            >
              <Text style={styles.cardText} numberOfLines={5}>{item.text}</Text>
              <Text style={styles.cardMeta}>
                {new Date(item.createdAt).toLocaleDateString('es', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { fontSize: 28, fontWeight: '800', color: '#0D1B2A', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0D1B2A', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  listContent: { padding: 20, paddingBottom: 32 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16 },
  cardText: { fontSize: 15, color: '#1F2937', lineHeight: 22, fontStyle: 'italic', marginBottom: 10 },
  cardMeta: { fontSize: 12, color: '#9CA3AF' },
  sep: { height: 12 },
});
