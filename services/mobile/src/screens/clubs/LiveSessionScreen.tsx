import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { apiClient } from '../../api/client';
import { clubsApi, ClubSession } from '../../api/clubs';
import { useClubSession } from '../../hooks/useClubSession';
import { useTranslation } from '../../i18n';
import type { ClubsStackParamList } from '../../navigation/types';

type Route = RouteProp<ClubsStackParamList, 'LiveSession'>;

export function LiveSessionScreen() {
  const { t } = useTranslation();
  const route = useRoute<Route>();
  const { clubId, sessionId } = route.params;

  const [session,  setSession]  = useState<ClubSession | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [text,     setText]     = useState('');
  const soundRef      = useRef<Audio.Sound | null>(null);
  const currentPosMs  = useRef(0);
  const chatRef       = useRef<FlatList>(null);

  const { connected, playback, members, messages, error, isHost, myUserId, play, pause, seek, sendMessage } =
    useClubSession(sessionId);

  useEffect(() => {
    async function load() {
      try {
        const sessions = await clubsApi.getSessions(clubId);
        const s = sessions.find(s => s.id === sessionId);
        if (!s) return;
        setSession(s);
        const book = await apiClient.get<any>(`/books/${s.book?.id ?? ''}`).catch(() => null);
        if (book?.audioStreamKey) setAudioUrl(book.audioStreamKey);
      } finally {
        setLoading(false);
      }
    }
    load();

    return () => { soundRef.current?.unloadAsync(); };
  }, [clubId, sessionId]);

  // Load audio and track position via status callback
  useEffect(() => {
    if (!audioUrl) return;
    const sound = new Audio.Sound();
    sound.loadAsync({ uri: audioUrl }, {}).catch(() => {});
    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (status.isLoaded) currentPosMs.current = status.positionMillis ?? 0;
    });
    soundRef.current = sound;
    return () => { sound.unloadAsync(); };
  }, [audioUrl]);

  // Sync audio to server playback state
  useEffect(() => {
    if (!soundRef.current) return;
    const { isPlaying, positionMs } = playback;
    const drift = Math.abs(positionMs - currentPosMs.current);
    if (drift > 1500) soundRef.current.setPositionAsync(positionMs);
    if (isPlaying) soundRef.current.playAsync().catch(() => {});
    else           soundRef.current.pauseAsync().catch(() => {});
  }, [playback]);

  function handlePlayPause() {
    const posMs = currentPosMs.current;
    if (playback.isPlaying) pause(posMs);
    else play(posMs);
  }

  function handleSend() {
    if (!text.trim()) return;
    sendMessage(text.trim());
    setText('');
    setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 100);
  }

  function formatTime(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#4F46E5" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.container}>
        {/* Session info */}
        <View style={s.header}>
          <View style={s.statusRow}>
            <View style={[s.dot, { backgroundColor: connected ? '#10B981' : '#D1D5DB' }]} />
            <Text style={s.statusText}>{connected ? `${members.length} escuchando` : 'Conectando…'}</Text>
          </View>
          <Text style={s.title}>{session?.title}</Text>
          <Text style={s.subtitle}>Frases {session?.startPhraseIndex}–{session?.endPhraseIndex}</Text>
          {error ? <Text style={s.errorText}>{error}</Text> : null}
        </View>

        {/* Playback */}
        {audioUrl && (
          <View style={s.player}>
            <Text style={s.timeText}>{formatTime(playback.positionMs)}</Text>
            {isHost ? (
              <TouchableOpacity style={s.playBtn} onPress={handlePlayPause}>
                <Text style={s.playBtnText}>{playback.isPlaying ? '⏸' : '▶'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.listenerPill}>
                <Text style={s.listenerText}>
                  {playback.isPlaying ? '🎧 Sincronizando…' : '⏸ En pausa'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Members */}
        <View style={s.membersRow}>
          {members.slice(0, 8).map(m => (
            <View key={m.socketId} style={[s.avatar, m.userId === myUserId && s.avatarMe]}>
              <Text style={s.avatarText}>{m.userId === myUserId ? 'Tú' : '👤'}</Text>
            </View>
          ))}
          {members.length > 8 && <Text style={s.moreText}>+{members.length - 8}</Text>}
        </View>

        {/* Live chat */}
        <View style={s.chatContainer}>
          <Text style={s.chatTitle}>Chat en vivo</Text>
          <FlatList
            ref={chatRef}
            data={messages}
            keyExtractor={m => m.id}
            style={s.chatList}
            contentContainerStyle={{ gap: 6 }}
            ListEmptyComponent={<Text style={s.emptyText}>{t.clubs.chat.empty}</Text>}
            renderItem={({ item: msg }) => {
              const isMe = msg.userId === myUserId;
              return (
                <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                  <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>{msg.content}</Text>
                </View>
              );
            }}
          />
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={text}
              onChangeText={setText}
              placeholder={t.clubs.chat.placeholder}
              placeholderTextColor="#9CA3AF"
              maxLength={500}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[s.sendBtn, !text.trim() && s.sendBtnOff]}
              onPress={handleSend}
              disabled={!text.trim()}
            >
              <Text style={s.sendBtnText}>{t.clubs.chat.send}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#fff' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  statusText:   { fontSize: 13, color: '#6B7280' },
  title:        { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle:     { fontSize: 13, color: '#6B7280', marginTop: 2 },
  errorText:    { color: '#EF4444', fontSize: 13, marginTop: 6 },
  player:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  timeText:     { fontSize: 14, color: '#6B7280', fontVariant: ['tabular-nums'] },
  playBtn:      { width: 64, height: 64, borderRadius: 32, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  playBtnText:  { fontSize: 28, color: '#fff' },
  listenerPill: { backgroundColor: '#EEF2FF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  listenerText: { fontSize: 14, color: '#4F46E5', fontWeight: '600' },
  membersRow:   { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 12, gap: 6, flexWrap: 'wrap' },
  avatar:       { width: 32, height: 32, borderRadius: 16, backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  avatarMe:     { backgroundColor: '#4F46E5' },
  avatarText:   { fontSize: 10, color: '#fff', fontWeight: '600' },
  moreText:     { fontSize: 12, color: '#9CA3AF', alignSelf: 'center' },
  chatContainer:{ flex: 1, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  chatTitle:    { fontSize: 13, fontWeight: '600', color: '#374151', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  chatList:     { flex: 1, paddingHorizontal: 12 },
  emptyText:    { textAlign: 'center', color: '#9CA3AF', marginTop: 20, fontSize: 13 },
  bubble:       { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMe:     { alignSelf: 'flex-end', backgroundColor: '#4F46E5' },
  bubbleThem:   { alignSelf: 'flex-start', backgroundColor: '#F3F4F6' },
  bubbleText:   { fontSize: 14, color: '#111827' },
  bubbleTextMe: { color: '#fff' },
  inputRow:     { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 8 },
  input:        { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827' },
  sendBtn:      { backgroundColor: '#4F46E5', paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
  sendBtnOff:   { opacity: 0.4 },
  sendBtnText:  { color: '#fff', fontWeight: '600', fontSize: 14 },
});
