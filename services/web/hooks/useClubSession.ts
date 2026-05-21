'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace('/api', '');

export interface SessionMember { userId: string; socketId: string }

export interface LiveChatMessage {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  positionMs: number;
  hostId: string;
}

export function useClubSession(sessionId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected,   setConnected]   = useState(false);
  const [playback,    setPlayback]    = useState<PlaybackState>({ isPlaying: false, positionMs: 0, hostId: '' });
  const [members,     setMembers]     = useState<SessionMember[]>([]);
  const [messages,    setMessages]    = useState<LiveChatMessage[]>([]);
  const [error,       setError]       = useState('');

  const myUserId = typeof window !== 'undefined' ? localStorage.getItem('user_id') ?? '' : '';
  const token    = typeof window !== 'undefined' ? localStorage.getItem('access_token') ?? '' : '';
  const isHost   = playback.hostId === myUserId;

  useEffect(() => {
    if (!sessionId || !token) return;

    const socket = io(`${WS_URL}/sessions`, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-session', { sessionId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('session:state', (state: PlaybackState & { members: SessionMember[] }) => {
      setPlayback({ isPlaying: state.isPlaying, positionMs: state.positionMs, hostId: state.hostId });
      setMembers(state.members);
    });

    socket.on('playback:state', (state: { isPlaying: boolean; positionMs: number }) => {
      setPlayback(prev => ({ ...prev, ...state }));
    });

    socket.on('session:members', (list: SessionMember[]) => setMembers(list));

    socket.on('chat:message', (msg: LiveChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('error', (e: { message: string }) => setError(e.message));

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [sessionId, token]);

  const play = useCallback((positionMs?: number) => {
    socketRef.current?.emit('playback:play', { sessionId, positionMs });
  }, [sessionId]);

  const pause = useCallback((positionMs?: number) => {
    socketRef.current?.emit('playback:pause', { sessionId, positionMs });
  }, [sessionId]);

  const seek = useCallback((positionMs: number) => {
    socketRef.current?.emit('playback:seek', { sessionId, positionMs });
  }, [sessionId]);

  const sendMessage = useCallback((content: string) => {
    socketRef.current?.emit('chat:message', { sessionId, content });
  }, [sessionId]);

  return { connected, playback, members, messages, error, isHost, play, pause, seek, sendMessage };
}
