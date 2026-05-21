import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, SafeAreaView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../api/client';
import { clubsApi, ClubMember } from '../../api/clubs';
import { AudioPlayerBar } from '../../components/AudioPlayerBar';
import { DownloadButton } from '../../components/DownloadButton';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useTranslation } from '../../i18n';
import { saveFragment } from '../../offline/fragment-storage';
import { saveProgress } from '../../offline/progress-storage';
import { loadChapter } from '../../offline/book-storage';
import type { LibraryStackParamList } from '../../navigation/types';

type Route = RouteProp<LibraryStackParamList, 'Reader'>;
type Nav = NativeStackNavigationProp<LibraryStackParamList, 'Reader'>;

interface SyncPhrase {
  index: number;
  text: string;
  startTime: number;
  endTime: number;
  type?: 'text' | 'heading' | 'paragraph-break';
}

interface ApiFragment {
  id: string;
  startPhraseIndex: number;
  endPhraseIndex: number;
}

interface BookData {
  textFileUrl?: string;
  audioStreamKey?: string;
}

const PROGRESS_DEBOUNCE = 3000;

export function ReaderScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { bookId, bookTitle } = route.params;

  const [phrases, setPhrases] = useState<SyncPhrase[]>([]);
  const [rawParagraphs, setRawParagraphs] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { t } = useTranslation();
  const [audioMode, setAudioMode] = useState(false);
  const [savedIndex, setSavedIndex] = useState(0);
  const [selectedPhrase, setSelectedPhrase] = useState<SyncPhrase | null>(null);
  const [savingFragment, setSavingFragment]   = useState(false);
  const [loading, setLoading]                  = useState(true);
  const [error, setError]                      = useState('');
  const [showClubPicker, setShowClubPicker]    = useState(false);
  const [clubPickerClubs, setClubPickerClubs]  = useState<ClubMember[]>([]);
  const [clubComment, setClubComment]          = useState('');
  const [postingClub, setPostingClub]          = useState(false);

  const listRef = useRef<FlatList>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedPhraseIds = useRef<Set<number>>(new Set());
  const lastScrolledIndex = useRef(-1);

  const audio = useAudioPlayer(audioMode ? audioUrl : null, phrases);

  // Auto-scroll to active phrase when audio is playing
  useEffect(() => {
    if (!audioMode || !audio.isPlaying) return;
    if (audio.activePhraseIndex === lastScrolledIndex.current) return;
    if (audio.activePhraseIndex < 0 || audio.activePhraseIndex >= phrases.length) return;
    lastScrolledIndex.current = audio.activePhraseIndex;
    listRef.current?.scrollToIndex({ index: audio.activePhraseIndex, animated: true, viewPosition: 0.4 });
  }, [audioMode, audio.isPlaying, audio.activePhraseIndex, phrases.length]);

  useEffect(() => {
    navigation.setOptions({
      title: bookTitle,
      headerRight: () => <DownloadButton bookId={bookId} />,
    });

    async function loadContent() {
      // Check offline cache first
      const cached = await loadChapter(bookId, 0);
      if (cached?.phrases?.length) {
        setPhrases(cached.phrases as SyncPhrase[]);
        const progress = await apiClient.get<{ phraseIndex?: number }>(`/books/${bookId}/progress`).catch(() => null);
        const frags = await apiClient.get<ApiFragment[]>(`/books/${bookId}/fragments`).catch(() => []);
        setSavedIndex(progress?.phraseIndex ?? 0);
        savedPhraseIds.current = new Set((frags ?? []).map((f) => f.startPhraseIndex));
        return;
      }

      // Fetch from API
      const [book, syncMap, progress, frags] = await Promise.all([
        apiClient.get<BookData>(`/books/${bookId}`),
        apiClient.get<{ phrases?: SyncPhrase[] }>(`/books/${bookId}/sync-map`).catch(() => null),
        apiClient.get<{ phraseIndex?: number }>(`/books/${bookId}/progress`).catch(() => null),
        apiClient.get<ApiFragment[]>(`/books/${bookId}/fragments`).catch(() => []),
      ]);

      setSavedIndex(progress?.phraseIndex ?? 0);
      savedPhraseIds.current = new Set((frags ?? []).map((f) => f.startPhraseIndex));

      if (book?.audioStreamKey) setAudioUrl(book.audioStreamKey);

      if (syncMap?.phrases?.length) {
        setPhrases(syncMap.phrases);
      } else if (book?.textFileUrl) {
        fetch(book.textFileUrl)
          .then((r) => r.text())
          .then((txt) => setRawParagraphs(txt.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)))
          .catch(() => setError(t.reader.errorText));
      } else {
        setError(t.reader.errorUnavailable);
      }
    }

    loadContent().catch(() => setError(t.reader.errorBook)).finally(() => setLoading(false));
  }, [bookId, bookTitle, navigation]);

  useEffect(() => {
    if (savedIndex > 0 && phrases.length > 0 && !audioMode) {
      const idx = Math.min(savedIndex, phrases.length - 1);
      setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: true }), 600);
    }
  }, [savedIndex, phrases, audioMode]);

  const trackProgress = useCallback((phraseIndex: number) => {
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => {
      saveProgress({ bookId, chapterIndex: 0, phraseIndex, updatedAt: Date.now(), synced: false }).catch(() => {});
      apiClient.post(`/books/${bookId}/progress`, { phraseIndex }).catch(() => {});
    }, PROGRESS_DEBOUNCE);
  }, [bookId]);

  const handleOpenClubComment = useCallback(async () => {
    try {
      const memberships = await clubsApi.getMyClubs();
      setClubPickerClubs(memberships as ClubMember[]);
      setShowClubPicker(true);
    } catch {}
  }, []);

  const handlePostClubComment = useCallback(async (clubId: string) => {
    if (!selectedPhrase || !clubComment.trim()) return;
    setPostingClub(true);
    try {
      await clubsApi.postDiscussion(clubId, bookId, selectedPhrase.index, clubComment.trim());
      setShowClubPicker(false);
      setClubComment('');
      setSelectedPhrase(null);
    } catch {}
    finally {
      setPostingClub(false);
    }
  }, [bookId, clubComment, selectedPhrase]);

  const handleSaveFragment = useCallback(async () => {
    if (!selectedPhrase) return;
    setSavingFragment(true);
    const text = selectedPhrase.text;
    const idx = selectedPhrase.index;
    try {
      const res = await apiClient.post<{ id: string }>(`/books/${bookId}/fragments`, {
        text, startPhraseIndex: idx, endPhraseIndex: idx,
      });
      savedPhraseIds.current.add(idx);
      await saveFragment({ localId: res.id, serverId: res.id, bookId, text, chapterIndex: 0, createdAt: Date.now(), synced: true });
    } catch {
      const localId = `local_${Date.now()}`;
      savedPhraseIds.current.add(idx);
      await saveFragment({ localId, bookId, text, chapterIndex: 0, createdAt: Date.now(), synced: false }).catch(() => {});
    } finally {
      setSavingFragment(false);
      setSelectedPhrase(null);
    }
  }, [bookId, selectedPhrase]);

  const handlePhrasePress = useCallback((item: SyncPhrase) => {
    if (audioMode && audio.isLoaded) {
      audio.seekToPhrase(item);
      trackProgress(item.index);
    } else {
      trackProgress(item.index);
    }
  }, [audioMode, audio, trackProgress]);

  const renderPhrase = useCallback(({ item }: { item: SyncPhrase }) => {
    if (item.type === 'paragraph-break') return <View style={styles.gap} />;
    const isHeading = item.type === 'heading';
    const isSaved = savedPhraseIds.current.has(item.index);
    const isActive = audioMode && audio.activePhraseIndex === item.index;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handlePhrasePress(item)}
        onLongPress={() => { if (!isHeading) setSelectedPhrase(item); }}
        delayLongPress={400}
      >
        <Text style={[
          styles.phrase,
          isHeading && styles.heading,
          isSaved && styles.saved,
          isActive && styles.active,
        ]}>
          {item.text}
        </Text>
      </TouchableOpacity>
    );
  }, [audioMode, audio.activePhraseIndex, audio.isLoaded, handlePhrasePress]);

  const renderParagraph = useCallback(({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onLongPress={() => setSelectedPhrase({ index, text: item, startTime: 0, endTime: 0, type: 'text' })}
      delayLongPress={400}
    >
      <Text style={[styles.phrase, styles.gap]}>{item}</Text>
    </TouchableOpacity>
  ), []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4F46E5" /></View>;

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t.reader.back}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {phrases.length > 0 ? (
        <FlatList
          ref={listRef}
          data={phrases}
          keyExtractor={(item) => String(item.index)}
          renderItem={renderPhrase}
          contentContainerStyle={[styles.content, audioMode && styles.contentWithPlayer]}
          onScrollToIndexFailed={() => {}}
        />
      ) : (
        <FlatList
          data={rawParagraphs}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderParagraph}
          contentContainerStyle={[styles.content, audioMode && styles.contentWithPlayer]}
        />
      )}

      {/* Audio mode FAB — only shown when audio is available */}
      {audioUrl && !audioMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setAudioMode(true)}
          accessibilityLabel={t.reader.audioMode}
        >
          <Text style={styles.fabText}>🎧</Text>
        </TouchableOpacity>
      )}

      {/* Audio player bar */}
      {audioMode && (
        <AudioPlayerBar
          isLoaded={audio.isLoaded}
          isLoading={audio.isLoading}
          isPlaying={audio.isPlaying}
          position={audio.position}
          duration={audio.duration}
          speed={audio.speed}
          error={audio.error}
          onPlay={audio.play}
          onPause={audio.pause}
          onSkipBack={audio.skipBack}
          onSkipForward={audio.skipForward}
          onSeek={audio.seekTo}
          onSetSpeed={audio.setSpeed}
          onClose={() => {
            audio.pause();
            setAudioMode(false);
          }}
        />
      )}

      {/* Fragment save modal */}
      <Modal
        visible={selectedPhrase !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPhrase(null)}
      >
        <TouchableOpacity style={styles.overlay} onPress={() => setSelectedPhrase(null)} activeOpacity={1}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetExcerpt} numberOfLines={3}>{selectedPhrase?.text}</Text>
            <TouchableOpacity
              style={[styles.saveBtn, savingFragment && styles.saveBtnOff]}
              onPress={handleSaveFragment}
              disabled={savingFragment}
            >
              {savingFragment
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>{t.reader.saveFragment}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.clubBtn} onPress={handleOpenClubComment}>
              <Text style={styles.clubBtnText}>👥  {t.clubs.commentInClub}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedPhrase(null)}>
              <Text style={styles.cancelBtnText}>{t.reader.cancel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Club picker + comment modal */}
      <Modal
        visible={showClubPicker}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowClubPicker(false); setClubComment(''); }}
      >
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => { setShowClubPicker(false); setClubComment(''); }}
          activeOpacity={1}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetExcerpt} numberOfLines={2}>{selectedPhrase?.text}</Text>
            <TextInput
              style={styles.clubCommentInput}
              value={clubComment}
              onChangeText={setClubComment}
              placeholder={t.clubs.discussion.placeholder}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={2000}
            />
            {clubPickerClubs.length === 0 ? (
              <Text style={styles.cancelBtnText}>{t.clubs.noClubs}</Text>
            ) : (
              clubPickerClubs.map((m: any) => {
                const club = m.club ?? m;
                return (
                  <TouchableOpacity
                    key={club.id ?? m.clubId}
                    style={[styles.saveBtn, { marginBottom: 8 }, (!clubComment.trim() || postingClub) && styles.saveBtnOff]}
                    onPress={() => handlePostClubComment(club.id ?? m.clubId)}
                    disabled={!clubComment.trim() || postingClub}
                  >
                    {postingClub
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.saveBtnText}>→ {club.name}</Text>}
                  </TouchableOpacity>
                );
              })
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowClubPicker(false); setClubComment(''); }}>
              <Text style={styles.cancelBtnText}>{t.reader.cancel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#fff' },
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content:           { padding: 20, paddingBottom: 60 },
  contentWithPlayer: { paddingBottom: 120 },
  phrase:            { fontSize: 17, lineHeight: 28, color: '#1F2937', marginBottom: 2 },
  heading:           { fontSize: 20, fontWeight: '700', color: '#0D1B2A', marginTop: 20, marginBottom: 4 },
  saved:             { backgroundColor: '#EDE9FE' },
  active:            { backgroundColor: '#DBEAFE', borderRadius: 4 },
  gap:               { marginBottom: 16 },
  errorText:         { fontSize: 15, color: '#EF4444', textAlign: 'center', marginBottom: 16 },
  backBtn:           { paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText:       { color: '#4F46E5', fontSize: 16, fontWeight: '600' },
  fab:               { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0D1B2A', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  fabText:           { fontSize: 24 },
  overlay:           { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:             { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  handle:            { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetExcerpt:      { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 20, fontStyle: 'italic' },
  saveBtn:           { backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  saveBtnOff:        { opacity: 0.6 },
  saveBtnText:       { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn:         { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText:     { color: '#6B7280', fontSize: 15 },
  clubBtn:           { backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  clubBtnText:       { color: '#4F46E5', fontSize: 15, fontWeight: '600' },
  clubCommentInput:  { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', minHeight: 70, marginBottom: 14, textAlignVertical: 'top' },
});
