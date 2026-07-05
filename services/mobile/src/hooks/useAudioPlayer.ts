import { Audio, AVPlaybackStatus } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface SyncPhrase {
  index: number;
  startTime: number;
  endTime: number;
  type?: string;
}

export interface AudioPlayerState {
  isLoaded: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  speed: number;
  activePhraseIndex: number;
  error: string | null;
}

/**
 * Array index of the phrase being narrated at `positionSecs`.
 *
 * 'heading' / 'paragraph-break' phrases carry startTime === endTime === 0 and
 * are interleaved with the timed text phrases. Because their startTime is 0 they
 * always satisfy `startTime <= position`, so the naive "last index with
 * startTime <= position" drifts onto the marker sitting after the real phrase —
 * the highlight lands on the next/empty phrase or blinks. Skip zero-duration
 * markers so only timed phrases are considered; "last started" keeps the current
 * phrase highlighted through inter-phrase gaps. Exported for unit testing.
 */
export function findActivePhraseIndex(phrases: SyncPhrase[], positionSecs: number): number {
  let idx = -1;
  for (let i = 0; i < phrases.length; i++) {
    const p = phrases[i];
    if ((p.endTime ?? 0) <= (p.startTime ?? 0)) continue; // skip zero-duration markers
    if ((p.startTime ?? 0) > positionSecs) break;         // timed phrases are sorted
    idx = i;                                              // last timed phrase started
  }
  return idx < 0 ? 0 : idx;
}

export function useAudioPlayer(audioUrl: string | null, phrases: SyncPhrase[]) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeedState] = useState(1.0);
  const [activePhraseIndex, setActivePhraseIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phrases.length === 0) return;
    setActivePhraseIndex(findActivePhraseIndex(phrases, position));
  }, [position, phrases]);

  useEffect(() => {
    if (!audioUrl) return;
    const url: string = audioUrl;

    let sound: Audio.Sound | null = null;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
        sound = new Audio.Sound();
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (cancelled || !status.isLoaded) return;
          setPosition(status.positionMillis / 1000);
          setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
          setIsPlaying(status.isPlaying);
        });
        await sound.loadAsync({ uri: url }, { shouldPlay: false });
        if (!cancelled) {
          soundRef.current = sound;
          setIsLoaded(true);
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar el audio.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      sound?.unloadAsync().catch(() => {});
      soundRef.current = null;
      setIsLoaded(false);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    };
  }, [audioUrl]);

  const play = useCallback(async () => {
    await soundRef.current?.playAsync();
  }, []);

  const pause = useCallback(async () => {
    await soundRef.current?.pauseAsync();
  }, []);

  const seekTo = useCallback(async (secs: number) => {
    const clamped = Math.max(0, Math.min(secs, duration));
    await soundRef.current?.setPositionAsync(clamped * 1000);
  }, [duration]);

  const skipBack = useCallback(async () => {
    await soundRef.current?.setPositionAsync(Math.max(0, (position - 15)) * 1000);
  }, [position]);

  const skipForward = useCallback(async () => {
    await soundRef.current?.setPositionAsync(Math.min(position + 15, duration) * 1000);
  }, [position, duration]);

  const setSpeed = useCallback(async (rate: number) => {
    setSpeedState(rate);
    await soundRef.current?.setRateAsync(rate, true);
  }, []);

  const seekToPhrase = useCallback(async (phrase: SyncPhrase) => {
    await soundRef.current?.setPositionAsync((phrase.startTime ?? 0) * 1000);
  }, []);

  return {
    isLoaded, isLoading, isPlaying, position, duration, speed,
    activePhraseIndex, error,
    play, pause, seekTo, skipBack, skipForward, setSpeed, seekToPhrase,
  };
}
