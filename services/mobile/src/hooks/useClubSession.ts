import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace('/api', '');

export interface SessionMember { userId: string; socketId: string }
export interface LiveChatMessage { id: string; userId: string; content: string; createdAt: string }
export interface PlaybackState   { isPlaying: boolean; positionMs: number; hostId: string }

export function useClubSession(sessionId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [playback,  setPlayback]  = useState<PlaybackState>({ isPlaying: false, positionMs: 0, hostId: '' });
  const [members,   setMembers]   = useState<SessionMember[]>([]);
  const [messages,  setMessages]  = useState<LiveChatMessage[]>([]);
  const [error,     setError]     = useState('');
  const [myUserId,  setMyUserId]  = useState('');

  useEffect(() => {
    AsyncStorage.getItem('noetia_user_id').then(id => setMyUserId(id ?? ''));
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let socket: Socket;

    AsyncStorage.getItem('noetia_access_token').then(token => {
      if (!token) return;

      socket = io(`${BASE_URL}/sessions`, {
        auth: { token: `Bearer ${token}` },
        transports: ['websocket'],
      });
      socketRef.current = socket;

      socket.on('connect',    () => { setConnected(true); socket.emit('join-session', { sessionId }); });
      socket.on('disconnect', () => setConnected(false));

      socket.on('session:state', (state: PlaybackState & { members: SessionMember[] }) => {
        setPlayback({ isPlaying: state.isPlaying, positionMs: state.positionMs, hostId: state.hostId });
        setMembers(state.members);
      });

      socket.on('playback:state', (state: { isPlaying: boolean; positionMs: number }) =>
        setPlayback(prev => ({ ...prev, ...state })));

      socket.on('session:members', setMembers);
      socket.on('chat:message', (msg: LiveChatMessage) => setMessages(prev => [...prev, msg]));
      socket.on('error', (e: { message: string }) => setError(e.message));
    });

    return () => { socket?.disconnect(); socketRef.current = null; };
  }, [sessionId]);

  const isHost = playback.hostId === myUserId;

  const play  = useCallback((posMs?: number) => { socketRef.current?.emit('playback:play',  { sessionId, positionMs: posMs }); }, [sessionId]);
  const pause = useCallback((posMs?: number) => { socketRef.current?.emit('playback:pause', { sessionId, positionMs: posMs }); }, [sessionId]);
  const seek  = useCallback((posMs: number)  => { socketRef.current?.emit('playback:seek',  { sessionId, positionMs: posMs }); }, [sessionId]);

  const sendMessage = useCallback((content: string) => {
    socketRef.current?.emit('chat:message', { sessionId, content });
  }, [sessionId]);

  return { connected, playback, members, messages, error, isHost, myUserId, play, pause, seek, sendMessage };
}
