import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { clubsApi, Club, ClubBook, ClubDiscussion, ClubMessage, ClubMember, ClubPoll, ClubSession } from '../../api/clubs';
import { useTranslation } from '../../i18n';
import type { ClubsStackParamList } from '../../navigation/types';

type Route = RouteProp<ClubsStackParamList, 'ClubDetail'>;
type Tab = 'chat' | 'discussion' | 'polls' | 'sessions';

// ── Chat Tab ──────────────────────────────────────────────────────────────────

function ChatTab({ clubId, canWrite }: { clubId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const c = t.clubs.chat;
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const listRef = useRef<FlatList>(null);
  const myUserId = useRef('');

  useEffect(() => {
    AsyncStorage.getItem('noetia_user_id').then(id => { myUserId.current = id ?? ''; });
    clubsApi.getMessages(clubId)
      .then(data => setMessages([...data].reverse()))
      .finally(() => setLoading(false));
  }, [clubId]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const msg = await clubsApi.sendMessage(clubId, text.trim());
      setMessages(prev => [...prev, msg]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#4F46E5" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.chatList}
        ListEmptyComponent={<Text style={styles.emptyText}>{c.empty}</Text>}
        renderItem={({ item: msg }) => {
          const isMe = msg.userId === myUserId.current;
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              {!isMe && <Text style={styles.bubbleName}>{msg.user?.name}</Text>}
              <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                {msg.deletedAt ? <Text style={styles.deleted}>{c.deleted}</Text> : msg.content}
              </Text>
            </View>
          );
        }}
      />
      {canWrite && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={c.placeholder}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnOff]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            <Text style={styles.sendBtnText}>{c.send}</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Discussion Tab ────────────────────────────────────────────────────────────

function DiscussionTab({ clubId, activeBook, canWrite }: { clubId: string; activeBook: ClubBook | null; canWrite: boolean }) {
  const { t } = useTranslation();
  const c = t.clubs.discussion;
  const [items, setItems]       = useState<ClubDiscussion[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [phraseNum, setPhraseNum] = useState('');
  const [content, setContent]   = useState('');
  const [posting, setPosting]   = useState(false);

  useEffect(() => {
    if (!activeBook) return;
    setLoading(true);
    clubsApi.getDiscussions(clubId, activeBook.bookId)
      .then(data => setItems(data.filter(d => !d.deletedAt)))
      .finally(() => setLoading(false));
  }, [clubId, activeBook?.bookId]);

  async function post() {
    if (!activeBook || !content.trim()) return;
    const idx = parseInt(phraseNum, 10);
    if (isNaN(idx) || idx < 0) return;
    setPosting(true);
    try {
      const disc = await clubsApi.postDiscussion(clubId, activeBook.bookId, idx, content.trim());
      setItems(prev => [...prev, disc].sort((a, b) => a.phraseIndex - b.phraseIndex));
      setContent(''); setPhraseNum(''); setShowForm(false);
    } finally {
      setPosting(false);
    }
  }

  if (!activeBook) return <Text style={styles.emptyText}>{c.noBook}</Text>;
  if (loading)     return <ActivityIndicator style={{ marginTop: 40 }} color="#4F46E5" />;

  return (
    <ScrollView contentContainerStyle={styles.tabPad}>
      {canWrite && (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
          <Text style={styles.addBtnText}>+ {c.phraseLabel}</Text>
        </TouchableOpacity>
      )}

      {showForm && (
        <View style={styles.formCard}>
          <TextInput
            style={styles.phraseInput}
            value={phraseNum}
            onChangeText={setPhraseNum}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
          />
          <TextInput
            style={[styles.input, { marginTop: 8, minHeight: 60 }]}
            value={content}
            onChangeText={setContent}
            placeholder={c.placeholder}
            placeholderTextColor="#9CA3AF"
            multiline maxLength={2000}
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={[styles.sendBtn, (posting || !content.trim()) && styles.sendBtnOff]} onPress={post} disabled={posting || !content.trim()}>
              <Text style={styles.sendBtnText}>{c.post}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowForm(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {items.length === 0 ? (
        <Text style={styles.emptyText}>{c.empty}</Text>
      ) : (
        items.map(d => (
          <View key={d.id} style={styles.discCard}>
            <View style={styles.discHeader}>
              <View style={styles.phraseTag}><Text style={styles.phraseTagText}>#{d.phraseIndex}</Text></View>
              <Text style={styles.discAuthor}>{d.user?.name}</Text>
            </View>
            <Text style={styles.discContent}>{d.content}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ── Polls Tab ─────────────────────────────────────────────────────────────────

function PollsTab({ clubId }: { clubId: string }) {
  const { t } = useTranslation();
  const c = t.clubs.polls;
  const [polls, setPolls]   = useState<ClubPoll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clubsApi.getPolls(clubId).then(setPolls).finally(() => setLoading(false));
  }, [clubId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#4F46E5" />;

  return (
    <ScrollView contentContainerStyle={styles.tabPad}>
      {polls.length === 0 ? (
        <Text style={styles.emptyText}>{c.empty}</Text>
      ) : (
        polls.map(p => (
          <View key={p.id} style={styles.pollCard}>
            <View style={styles.pollHeader}>
              <Text style={styles.pollQuestion}>{p.question}</Text>
              <View style={[styles.statusBadge, p.status === 'open' ? styles.badgeOpen : styles.badgeClosed]}>
                <Text style={styles.statusText}>{p.status === 'open' ? c.open : c.closed}</Text>
              </View>
            </View>
            {p.winnerOptionId && <Text style={styles.winner}>🏆 {c.winner}</Text>}
            <Text style={styles.pollMeta}>{new Date(p.closesAt).toLocaleString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ── Sessions Tab ──────────────────────────────────────────────────────────────

function SessionsTab({ clubId }: { clubId: string }) {
  const { t } = useTranslation();
  const c = t.clubs.sessions;
  const [sessions, setSessions] = useState<ClubSession[]>([]);
  const [loading, setLoading]   = useState(true);

  const statusLabel: Record<string, string> = {
    scheduled: c.upcoming, live: c.live, completed: c.completed, cancelled: c.cancelled,
  };

  useEffect(() => {
    clubsApi.getSessions(clubId).then(setSessions).finally(() => setLoading(false));
  }, [clubId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#4F46E5" />;

  return (
    <ScrollView contentContainerStyle={styles.tabPad}>
      {sessions.length === 0 ? (
        <Text style={styles.emptyText}>{c.empty}</Text>
      ) : (
        sessions.map(s => (
          <View key={s.id} style={styles.sessionCard}>
            <View style={styles.pollHeader}>
              <Text style={styles.pollQuestion}>{s.title}</Text>
              <View style={[styles.statusBadge, s.status === 'live' ? styles.badgeOpen : styles.badgeClosed]}>
                <Text style={styles.statusText}>{statusLabel[s.status]}</Text>
              </View>
            </View>
            <Text style={styles.pollMeta}>{new Date(s.scheduledAt).toLocaleString()}</Text>
            <Text style={styles.pollMeta}>Frases {s.startPhraseIndex}–{s.endPhraseIndex} · {s.book?.title}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ── Main ClubScreen ───────────────────────────────────────────────────────────

export function ClubScreen() {
  const { t } = useTranslation();
  const c = t.clubs;
  const route = useRoute<Route>();
  const { clubId } = route.params;

  const [club, setClub]           = useState<Club | null>(null);
  const [me, setMe]               = useState<ClubMember | null>(null);
  const [activeBook, setActiveBook] = useState<ClubBook | null>(null);
  const [tab, setTab]             = useState<Tab>('chat');
  const [loading, setLoading]     = useState(true);
  const [joining, setJoining]     = useState(false);

  useEffect(() => { loadAll(); }, [clubId]);

  async function loadAll() {
    setLoading(true);
    try {
      const myId = await AsyncStorage.getItem('noetia_user_id') ?? '';
      const [clubData, members, books] = await Promise.all([
        clubsApi.get(clubId),
        clubsApi.getMembers(clubId).catch(() => [] as ClubMember[]),
        clubsApi.getBooks(clubId).catch(() => [] as ClubBook[]),
      ]);
      setClub(clubData);
      setMe(members.find(m => m.userId === myId && m.status === 'active') ?? null);
      setActiveBook(books.find(b => b.status === 'active') ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setJoining(true);
    try {
      await clubsApi.join(clubId);
      await loadAll();
    } catch (err: any) {
      const code = err?.data?.error;
      const errors = c.errors;
      Alert.alert(
        'Error',
        code === 'club_full'                  ? errors.clubFull
        : code === 'must_own_active_book_to_join' ? errors.mustOwnBook
        : code === 'user_banned_from_club'    ? errors.banned
        : t.common.error,
      );
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#4F46E5" /></View>;
  if (!club)   return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat',       label: c.tabs.chat },
    { key: 'discussion', label: c.tabs.discussion },
    { key: 'polls',      label: c.tabs.polls },
    { key: 'sessions',   label: c.tabs.sessions },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Club header */}
      <View style={styles.clubHeader}>
        <View style={[styles.clubCover, { backgroundColor: '#4F46E5' }]}>
          <Text style={styles.coverText}>{club.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.clubMeta}>
          <Text style={styles.clubName}>{club.name}</Text>
          {club.description && <Text style={styles.clubDesc} numberOfLines={2}>{club.description}</Text>}
        </View>
        {!me ? (
          <TouchableOpacity style={[styles.joinBtn, joining && styles.joinBtnOff]} onPress={handleJoin} disabled={joining}>
            <Text style={styles.joinBtnText}>{joining ? '…' : c.join}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.joinedBadge}><Text style={styles.joinedText}>{c.joined}</Text></View>
        )}
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {tabs.map(({ key, label }) => (
          <TouchableOpacity key={key} style={[styles.tabPill, tab === key && styles.tabPillActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabPillText, tab === key && styles.tabPillTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {tab === 'chat'       && <ChatTab clubId={clubId} canWrite={!!me} />}
        {tab === 'discussion' && <DiscussionTab clubId={clubId} activeBook={activeBook} canWrite={!!me} />}
        {tab === 'polls'      && <PollsTab clubId={clubId} />}
        {tab === 'sessions'   && <SessionsTab clubId={clubId} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clubHeader:    { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  clubCover:     { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  coverText:     { color: '#fff', fontWeight: '700', fontSize: 20 },
  clubMeta:      { flex: 1 },
  clubName:      { fontSize: 16, fontWeight: '700', color: '#111827' },
  clubDesc:      { fontSize: 13, color: '#6B7280', marginTop: 2 },
  joinBtn:       { backgroundColor: '#4F46E5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  joinBtnOff:    { opacity: 0.5 },
  joinBtnText:   { color: '#fff', fontSize: 13, fontWeight: '600' },
  joinedBadge:   { backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  joinedText:    { color: '#059669', fontSize: 12, fontWeight: '600' },
  tabBar:        { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tabPill:       { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6' },
  tabPillActive: { backgroundColor: '#4F46E5' },
  tabPillText:   { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabPillTextActive: { color: '#fff' },
  tabPad:        { padding: 16, paddingBottom: 40 },
  chatList:      { padding: 16, paddingBottom: 8, gap: 8 },
  emptyText:     { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 15 },
  bubble:        { maxWidth: '80%', padding: 10, borderRadius: 16 },
  bubbleMe:      { alignSelf: 'flex-end', backgroundColor: '#4F46E5' },
  bubbleThem:    { alignSelf: 'flex-start', backgroundColor: '#F3F4F6' },
  bubbleName:    { fontSize: 11, color: '#6B7280', marginBottom: 3 },
  bubbleText:    { fontSize: 14, color: '#111827' },
  bubbleTextMe:  { color: '#fff' },
  deleted:       { fontStyle: 'italic', opacity: 0.5 },
  inputRow:      { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 8, alignItems: 'flex-end' },
  input:         { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', maxHeight: 100 },
  sendBtn:       { backgroundColor: '#4F46E5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  sendBtnOff:    { opacity: 0.4 },
  sendBtnText:   { color: '#fff', fontWeight: '600', fontSize: 14 },
  addBtn:        { marginBottom: 12 },
  addBtnText:    { color: '#4F46E5', fontWeight: '600', fontSize: 14 },
  formCard:      { backgroundColor: '#EEF2FF', borderRadius: 14, padding: 14, marginBottom: 16 },
  phraseInput:   { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#111827', width: 100 },
  formActions:   { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  cancelBtn:     { paddingVertical: 8 },
  cancelBtnText: { color: '#6B7280', fontSize: 14 },
  discCard:      { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginBottom: 10 },
  discHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  phraseTag:     { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  phraseTagText: { fontSize: 12, fontFamily: 'monospace', color: '#6B7280' },
  discAuthor:    { fontSize: 13, fontWeight: '600', color: '#374151' },
  discContent:   { fontSize: 14, color: '#374151', lineHeight: 20 },
  pollCard:      { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginBottom: 10 },
  pollHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  pollQuestion:  { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', marginRight: 8 },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeOpen:     { backgroundColor: '#D1FAE5' },
  badgeClosed:   { backgroundColor: '#F3F4F6' },
  statusText:    { fontSize: 12, fontWeight: '600', color: '#374151' },
  winner:        { fontSize: 13, color: '#059669', fontWeight: '600', marginBottom: 4 },
  pollMeta:      { fontSize: 12, color: '#9CA3AF' },
  sessionCard:   { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginBottom: 10 },
});
