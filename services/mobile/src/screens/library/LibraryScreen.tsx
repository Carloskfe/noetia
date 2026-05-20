import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../api/client';
import { useTranslation } from '../../i18n';
import type { LibraryStackParamList } from '../../navigation/types';

interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  isFree: boolean;
}

type Nav = NativeStackNavigationProp<LibraryStackParamList, 'LibraryHome'>;

const COVER_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#059669', '#D97706', '#DC2626'];

function coverColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COVER_COLORS[Math.abs(h) % COVER_COLORS.length];
}

function BookCard({ book, onPress }: { book: Book; onPress: () => void }) {
  const initials = book.title.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.cover, { backgroundColor: coverColor(book.id) }]}>
        <Text style={styles.coverText}>{initials}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.cardAuthor} numberOfLines={1}>{book.author}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function LibraryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [freeBooks, setFreeBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [libraryRes, booksRes] = await Promise.allSettled([
      apiClient.get<{ books?: Book[] } | Book[]>('/library'),
      apiClient.get<Book[]>('/books?published=true'),
    ]);

    if (libraryRes.status === 'fulfilled') {
      const val = libraryRes.value;
      setMyBooks(Array.isArray(val) ? val : (val as { books?: Book[] }).books ?? []);
    }
    if (booksRes.status === 'fulfilled') {
      setFreeBooks((booksRes.value ?? []).filter((b) => b.isFree));
    }
    if (libraryRes.status === 'rejected' && booksRes.status === 'rejected') {
      setError(t.library.errorLoading);
    }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openBook = useCallback(
    (book: Book) => navigation.navigate('Reader', { bookId: book.id, bookTitle: book.title }),
    [navigation],
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#4F46E5" /></View>;
  }

  const sections = [
    ...(myBooks.length > 0 ? [{ title: t.library.mySection, data: myBooks }] : []),
    ...(freeBooks.length > 0 ? [{ title: t.library.generalSection, data: freeBooks }] : []),
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Biblioteca</Text>
      {error !== '' && <Text style={styles.errorText}>{error}</Text>}
      {sections.length === 0 && !error && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t.library.empty}</Text>
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BookCard book={item} onPress={() => openBook(item)} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { fontSize: 28, fontWeight: '800', color: '#0D1B2A', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  sectionHeader: {
    fontSize: 12, fontWeight: '700', color: '#6B7280',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  listContent: { paddingBottom: 24 },
  errorText: { color: '#EF4444', fontSize: 14, paddingHorizontal: 20, marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#6B7280' },
  card: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  cover: { width: 52, height: 72, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  coverText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0D1B2A', marginBottom: 3 },
  cardAuthor: { fontSize: 13, color: '#6B7280' },
});
