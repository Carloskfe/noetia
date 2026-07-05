import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { clubsApi, Club, ClubMember } from '../../api/clubs';
import { useTranslation } from '../../i18n';
import type { ClubsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ClubsStackParamList, 'ClubsHome'>;

const COVER_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#059669', '#D97706'];

function coverColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COVER_COLORS[Math.abs(h) % COVER_COLORS.length];
}

function ClubRow({ club, onPress }: { club: Club; onPress: () => void }) {
  const { t } = useTranslation();
  const initials = club.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {club.coverUrl ? (
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        <View style={[styles.cover, { backgroundColor: coverColor(club.id) }]}>
          <Text style={styles.coverText}>{initials}</Text>
        </View>
      ) : (
        <View style={[styles.cover, { backgroundColor: coverColor(club.id) }]}>
          <Text style={styles.coverText}>{initials}</Text>
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{club.name}</Text>
        {club.description && <Text style={styles.rowDesc} numberOfLines={1}>{club.description}</Text>}
        <Text style={styles.rowMeta}>{club.type === 'public' ? '🌐' : '🔒'} {club.owner?.name}</Text>
      </View>
      {club.tokenRequired && <Text style={styles.tokenBadge}>{t.clubs.tokenRequired}</Text>}
    </TouchableOpacity>
  );
}

export function ClubsScreen() {
  const { t } = useTranslation();
  const c = t.clubs;
  const navigation = useNavigation<Nav>();

  const [tab, setTab]         = useState<'explore' | 'mine'>('explore');
  const [search, setSearch]   = useState('');
  const [clubs, setClubs]     = useState<Club[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadExplore(); loadMine(); }, []);

  useEffect(() => {
    const timer = setTimeout(loadExplore, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadExplore = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clubsApi.list(search || undefined);
      setClubs(data.clubs ?? []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadMine = useCallback(async () => {
    try {
      const memberships = await clubsApi.getMyClubs();
      setMyClubs((memberships as any[]).map((m: any) => m.club ?? m).filter(Boolean));
    } catch {}
  }, []);

  const displayed = tab === 'explore' ? clubs : myClubs;
  const emptyText = tab === 'explore' ? c.empty : c.myEmpty;

  function goToClub(club: Club) {
    navigation.navigate('ClubDetail', { clubId: club.id, clubName: club.name });
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{c.nav}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={c.searchPlaceholder}
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['explore', 'mine'] as const).map(key => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === 'explore' ? c.explore : c.myClubs}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && tab === 'explore' ? (
        <ActivityIndicator style={styles.loader} color="#4F46E5" />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ClubRow club={item} onPress={() => goToClub(item)} />}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header:    { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  title:     { fontSize: 26, fontWeight: '700', color: '#111827' },
  searchWrap:{ paddingHorizontal: 16, marginBottom: 8 },
  search:    { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827' },
  tabs:      { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  tab:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: '#4F46E5' },
  tabText:   { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#fff' },
  list:      { paddingHorizontal: 16, paddingBottom: 40 },
  loader:    { marginTop: 40 },
  empty:     { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 15 },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  cover:     { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  coverText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rowInfo:   { flex: 1 },
  rowName:   { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowDesc:   { fontSize: 13, color: '#6B7280', marginTop: 2 },
  rowMeta:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  tokenBadge:{ fontSize: 11, color: '#D97706', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
});
