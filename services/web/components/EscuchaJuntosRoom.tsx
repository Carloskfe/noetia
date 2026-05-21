'use client';

import { useEffect, useRef, useState } from 'react';
import { useClubSession } from '@/hooks/useClubSession';
import { useTranslation } from '@/lib/i18n';
import { ClubSession } from '@/lib/clubs';

export default function EscuchaJuntosRoom({ session, audioUrl }: { session: ClubSession; audioUrl: string | null }) {
  const { t } = useTranslation();
  const c = t.clubs.sessions;

  const { connected, playback, members, messages, error, isHost, play, pause, seek, sendMessage } =
    useClubSession(session.id);

  const audioRef   = useRef<HTMLAudioElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [text, setText]    = useState('');
  const lastSyncMs = useRef(0);
  const myUserId   = typeof window !== 'undefined' ? localStorage.getItem('user_id') ?? '' : '';

  // Sync audio to server playback state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const serverMs = playback.positionMs;
    const localMs  = audio.currentTime * 1000;
    const drift    = Math.abs(serverMs - localMs);

    if (drift > 1500) {
      audio.currentTime = serverMs / 1000;
      lastSyncMs.current = serverMs;
    }

    if (playback.isPlaying && audio.paused)  audio.play().catch(() => {});
    if (!playback.isPlaying && !audio.paused) audio.pause();
  }, [playback, audioUrl]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handlePlayPause() {
    if (!audioRef.current) return;
    const posMs = audioRef.current.currentTime * 1000;
    if (playback.isPlaying) pause(posMs);
    else play(posMs);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const posMs = parseFloat(e.target.value);
    seek(posMs);
    if (audioRef.current) audioRef.current.currentTime = posMs / 1000;
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text.trim());
    setText('');
  }

  const durationMs = audioRef.current ? audioRef.current.duration * 1000 : 0;
  const pct = durationMs > 0 ? (playback.positionMs / durationMs) * 100 : 0;

  function formatTime(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-200px)]">
      {/* Hidden audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      {/* Left — player */}
      <div className="flex-1 flex flex-col justify-between border rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm text-gray-500">{connected ? `${members.length} escuchando` : 'Conectando…'}</span>
          </div>

          <h2 className="text-lg font-bold mb-1">{session.title}</h2>
          <p className="text-sm text-gray-500 mb-6">
            Frases {session.startPhraseIndex}–{session.endPhraseIndex} · {session.book?.title}
          </p>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        </div>

        {/* Playback controls — host only */}
        {audioUrl ? (
          <div className="space-y-4">
            {/* Progress bar */}
            <input
              type="range"
              min={0}
              max={durationMs || 100}
              value={playback.positionMs}
              onChange={isHost ? handleSeek : undefined}
              disabled={!isHost}
              className="w-full accent-blue-600"
              aria-label="Playback position"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatTime(playback.positionMs)}</span>
              <span>{durationMs > 0 ? formatTime(durationMs) : '--:--'}</span>
            </div>

            {isHost ? (
              <button
                onClick={handlePlayPause}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition text-lg"
              >
                {playback.isPlaying ? '⏸ Pausar' : '▶ Reproducir'}
              </button>
            ) : (
              <div className="w-full bg-gray-100 text-gray-400 py-3 rounded-xl text-center text-sm">
                {playback.isPlaying ? '🎧 Escuchando en sincronía…' : '⏸ En pausa — esperando al anfitrión'}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center">Este libro no tiene audio disponible.</p>
        )}

        {/* Members */}
        <div className="mt-6 flex flex-wrap gap-2">
          {members.map(m => (
            <div
              key={m.socketId}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${m.userId === myUserId ? 'bg-blue-600' : 'bg-gray-400'}`}
              title={m.userId === myUserId ? 'Tú' : m.userId.slice(0, 6)}
            >
              {m.userId === myUserId ? 'Tú' : '👤'}
            </div>
          ))}
        </div>
      </div>

      {/* Right — live chat */}
      <div className="w-full lg:w-80 flex flex-col border rounded-2xl">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold">{t.clubs.chat.placeholder.replace('…', '')}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">{t.clubs.chat.empty}</p>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.userId === myUserId ? 'flex-row-reverse' : ''}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${msg.userId === myUserId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2 p-3 border-t">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t.clubs.chat.placeholder}
            maxLength={500}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t.clubs.chat.placeholder}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 transition"
          >
            {t.clubs.chat.send}
          </button>
        </form>
      </div>
    </div>
  );
}
