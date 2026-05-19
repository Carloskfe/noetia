import React, { useState } from 'react';
import {
  ActivityIndicator, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  isLoaded: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  speed: number;
  error: string | null;
  onPlay: () => void;
  onPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onSeek: (secs: number) => void;
  onSetSpeed: (rate: number) => void;
  onClose: () => void;
}

export function AudioPlayerBar({
  isLoaded, isLoading, isPlaying,
  position, duration, speed, error,
  onPlay, onPause, onSkipBack, onSkipForward,
  onSeek, onSetSpeed, onClose,
}: Props) {
  const [barWidth, setBarWidth] = useState(1);
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const speedIndex = SPEEDS.indexOf(speed);
  const nextSpeed = SPEEDS[(speedIndex + 1) % SPEEDS.length];

  return (
    <View style={styles.container}>
      {/* Controls row */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={onSkipBack} style={styles.skipBtn} disabled={!isLoaded}>
          <Text style={[styles.skipText, !isLoaded && styles.disabled]}>◀15</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={isPlaying ? onPause : onPlay}
          style={styles.playBtn}
          disabled={!isLoaded}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.playBtnText}>{isPlaying ? '⏸' : '▶'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onSkipForward} style={styles.skipBtn} disabled={!isLoaded}>
          <Text style={[styles.skipText, !isLoaded && styles.disabled]}>15▶</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSetSpeed(nextSpeed)}
          style={styles.speedBtn}
          disabled={!isLoaded}
        >
          <Text style={[styles.speedText, !isLoaded && styles.disabled]}>
            {speed.toFixed(2).replace('.00', '').replace('.75', '.75')}x
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <TouchableOpacity
        activeOpacity={1}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        onPress={(e) => {
          if (!isLoaded || duration === 0) return;
          const x = e.nativeEvent.locationX;
          onSeek((x / barWidth) * duration);
        }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        <View style={[styles.progressThumb, { left: `${progress * 100}%` as any }]} />
      </TouchableOpacity>

      {/* Time row */}
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        {error
          ? <Text style={styles.errorText}>{error}</Text>
          : isLoading
          ? <Text style={styles.timeText}>Cargando…</Text>
          : null}
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { backgroundColor: '#0D1B2A', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  controls:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 12 },
  skipBtn:        { padding: 6 },
  skipText:       { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  playBtn:        { width: 48, height: 48, borderRadius: 24, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  playBtnText:    { color: '#fff', fontSize: 20 },
  speedBtn:       { backgroundColor: '#1E3A5F', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  speedText:      { color: '#93C5FD', fontSize: 13, fontWeight: '700' },
  closeBtn:       { padding: 6 },
  closeText:      { color: '#64748B', fontSize: 16 },
  disabled:       { opacity: 0.3 },
  progressTrack:  { height: 4, backgroundColor: '#1E3A5F', borderRadius: 2, marginHorizontal: 4, marginBottom: 6, justifyContent: 'center' },
  progressFill:   { height: 4, backgroundColor: '#4F46E5', borderRadius: 2, position: 'absolute', left: 0 },
  progressThumb:  { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', position: 'absolute', marginLeft: -6, top: -4 },
  timeRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeText:       { color: '#64748B', fontSize: 11 },
  errorText:      { color: '#EF4444', fontSize: 11 },
});
