// Pure-logic tests for the helpers extracted from the hook, followed (CI-4.1) by behavioural
// tests of the hook itself rendered through react-test-renderer with a test-local expo-av fake.
// Import the REAL findActivePhraseIndex (previously reimplemented here, which
// hid the interleaved zero-duration marker bug from the test suite).
import { act } from 'react-test-renderer';
import { Audio } from 'expo-av';
import {
  findActivePhraseIndex,
  effectiveDuration,
  useAudioPlayer,
  type SyncPhrase,
} from '../../../src/hooks/useAudioPlayer';
import { renderHook, deferred } from '../../support/render-hook';
import { flush } from '../../support/render';

const PHRASES: SyncPhrase[] = [
  { index: 0, startTime: 0,  endTime: 5  },
  { index: 1, startTime: 5,  endTime: 12 },
  { index: 2, startTime: 12, endTime: 20 },
  { index: 3, startTime: 20, endTime: 30 },
];

describe('findActivePhraseIndex', () => {
  it('returns 0 at position 0', () => {
    expect(findActivePhraseIndex(PHRASES, 0)).toBe(0);
  });

  it('returns 1 at exact startTime of second phrase', () => {
    expect(findActivePhraseIndex(PHRASES, 5)).toBe(1);
  });

  it('returns 1 in the middle of second phrase', () => {
    expect(findActivePhraseIndex(PHRASES, 8)).toBe(1);
  });

  it('returns 2 at startTime 12', () => {
    expect(findActivePhraseIndex(PHRASES, 12)).toBe(2);
  });

  it('returns last phrase for position past all phrases', () => {
    expect(findActivePhraseIndex(PHRASES, 999)).toBe(3);
  });

  it('returns 0 for empty phrases', () => {
    expect(findActivePhraseIndex([], 5)).toBe(0);
  });

  it('returns 0 for single phrase', () => {
    const single = [{ index: 0, startTime: 0, endTime: 100 }];
    expect(findActivePhraseIndex(single, 50)).toBe(0);
  });

  // Regression: heading / paragraph-break markers carry startTime===endTime===0
  // and are interleaved with timed phrases. Their startTime (0) always satisfies
  // "startTime <= position", so the old logic drifted the active index onto the
  // marker after the real phrase — highlighting the wrong/empty phrase.
  it('ignores interleaved zero-duration markers (heading / paragraph-break)', () => {
    const mixed: SyncPhrase[] = [
      { index: 0, startTime: 0,  endTime: 5,  type: 'text' },
      { index: 1, startTime: 0,  endTime: 0,  type: 'heading' },
      { index: 2, startTime: 5,  endTime: 12, type: 'text' },
      { index: 3, startTime: 0,  endTime: 0,  type: 'paragraph-break' },
      { index: 4, startTime: 12, endTime: 20, type: 'text' },
    ];
    expect(findActivePhraseIndex(mixed, 2)).toBe(0);  // inside first text phrase
    expect(findActivePhraseIndex(mixed, 8)).toBe(2);  // inside second — NOT the break at idx 3
    expect(findActivePhraseIndex(mixed, 15)).toBe(4);
  });

  it('keeps the current phrase highlighted through an inter-phrase gap', () => {
    const gapped: SyncPhrase[] = [
      { index: 0, startTime: 0, endTime: 2, type: 'text' },
      { index: 1, startTime: 5, endTime: 7, type: 'text' }, // 3s gap after phrase 0
    ];
    expect(findActivePhraseIndex(gapped, 3.5)).toBe(0); // in the gap → stay on 0
    expect(findActivePhraseIndex(gapped, 5)).toBe(1);
  });
});

describe('useAudioPlayer exports', () => {
  it('exports useAudioPlayer as a function', () => {
    // Dynamically import to avoid expo-av loading in test environment
    const mod = require('../../../src/hooks/useAudioPlayer');
    expect(typeof mod.useAudioPlayer).toBe('function');
  });
});

// seek-on-load logic — pure helper tests for the ReaderScreen fix
// When audio mode is first enabled and the file loads, the reader must seek
// to the user's saved reading position rather than starting at 0.
describe('seek-on-load: phrase selection logic', () => {
  function pickSeekTarget(phrases: SyncPhrase[], savedIndex: number): SyncPhrase | null {
    if (savedIndex <= 0 || phrases.length === 0) return null;
    const idx = Math.min(savedIndex, phrases.length - 1);
    const phrase = phrases[idx];
    return phrase?.startTime ? phrase : null;
  }

  it('returns null when savedIndex is 0 — no seek needed', () => {
    expect(pickSeekTarget(PHRASES, 0)).toBeNull();
  });

  it('returns null when phrases array is empty', () => {
    expect(pickSeekTarget([], 2)).toBeNull();
  });

  it('returns null when the target phrase has startTime 0 (already at start)', () => {
    const phrasesAtZero: SyncPhrase[] = [{ index: 0, startTime: 0, endTime: 5 }];
    expect(pickSeekTarget(phrasesAtZero, 0)).toBeNull();
  });

  it('returns the phrase at savedIndex when it has a non-zero startTime', () => {
    const result = pickSeekTarget(PHRASES, 2);
    expect(result).not.toBeNull();
    expect(result?.index).toBe(2);
    expect(result?.startTime).toBe(12);
  });

  it('clamps to last phrase when savedIndex exceeds array length', () => {
    const result = pickSeekTarget(PHRASES, 999);
    expect(result).not.toBeNull();
    expect(result?.index).toBe(3);
    expect(result?.startTime).toBe(20);
  });

  it('seeks to position 1 (first non-start phrase) correctly', () => {
    const result = pickSeekTarget(PHRASES, 1);
    expect(result?.startTime).toBe(5);
  });
});

describe('effectiveDuration', () => {
  it('uses the last phrase end when durationMillis under-reports (concatenated MP3)', () => {
    // Header reports ~one chapter (10s) but the book runs to 30s (PHRASES end).
    expect(effectiveDuration(10, PHRASES)).toBe(30);
  });

  it('uses the raw duration when it already exceeds the sync map (single-file book)', () => {
    expect(effectiveDuration(3600, PHRASES)).toBe(3600);
  });

  it('falls back to the raw duration when there are no phrases', () => {
    expect(effectiveDuration(500, [])).toBe(500);
  });

  it('handles NaN/0 raw duration via the sync map', () => {
    expect(effectiveDuration(NaN, PHRASES)).toBe(30);
    expect(effectiveDuration(0, PHRASES)).toBe(30);
  });

  it('returns 0 with neither a duration nor phrases', () => {
    expect(effectiveDuration(0, [])).toBe(0);
  });
});

// ── useAudioPlayer hook behaviour (CI-4.1) ───────────────────────────────────────────────
// The hook renders through react-test-renderer (tests/support/render-hook.ts). expo-av is
// replaced by a test-local factory that records every Sound instance so each test can drive
// loading, status updates and failures, and assert on the calls the hook makes.

interface MockSound {
  setOnPlaybackStatusUpdate: jest.Mock;
  loadAsync: jest.Mock;
  playAsync: jest.Mock;
  pauseAsync: jest.Mock;
  setPositionAsync: jest.Mock;
  setRateAsync: jest.Mock;
  unloadAsync: jest.Mock;
}

const mockSounds: MockSound[] = [];

jest.mock('expo-av', () => ({
  Audio: {
    Sound: jest.fn().mockImplementation(() => {
      const sound = {
        setOnPlaybackStatusUpdate: jest.fn(),
        loadAsync: jest.fn().mockResolvedValue({}),
        playAsync: jest.fn().mockResolvedValue({}),
        pauseAsync: jest.fn().mockResolvedValue({}),
        setPositionAsync: jest.fn().mockResolvedValue({}),
        setRateAsync: jest.fn().mockResolvedValue({}),
        unloadAsync: jest.fn().mockResolvedValue({}),
      };
      mockSounds.push(sound);
      return sound;
    }),
    setAudioModeAsync: jest.fn().mockResolvedValue({}),
  },
}));

const setAudioModeAsync = Audio.setAudioModeAsync as unknown as jest.Mock;
const URL_A = 'https://storage.test/audio/book-a.mp3';
const URL_B = 'https://storage.test/audio/book-b.mp3';

type HookProps = { url: string | null; phrases: SyncPhrase[] };
const useHook = ({ url, phrases }: HookProps) => useAudioPlayer(url, phrases);

/** Pushes an expo-av playback status into the hook through the sound's registered listener. */
function emitStatus(sound: MockSound, status: Record<string, unknown>) {
  const listener = sound.setOnPlaybackStatusUpdate.mock.calls[0][0] as (s: unknown) => void;
  act(() => listener(status));
}

async function mountLoaded(phrases: SyncPhrase[] = PHRASES) {
  const hook = renderHook(useHook, { url: URL_A, phrases });
  await flush();
  return { ...hook, sound: mockSounds[mockSounds.length - 1] };
}

describe('useAudioPlayer hook', () => {
  beforeEach(() => {
    mockSounds.length = 0;
    (Audio.Sound as unknown as jest.Mock).mockClear();
    setAudioModeAsync.mockReset();
    setAudioModeAsync.mockResolvedValue({});
  });

  describe('loading', () => {
    it('does nothing without an audio URL', async () => {
      const { result } = renderHook(useHook, { url: null, phrases: PHRASES });
      await flush();
      expect(setAudioModeAsync).not.toHaveBeenCalled();
      expect(mockSounds).toHaveLength(0);
      expect(result.current).toMatchObject({ isLoaded: false, isLoading: false, isPlaying: false, error: null });
    });

    it('reports isLoading while the file loads, then isLoaded', async () => {
      const gate = deferred<object>();
      setAudioModeAsync.mockReturnValueOnce(gate.promise);
      const { result } = renderHook(useHook, { url: URL_A, phrases: PHRASES });
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isLoaded).toBe(false);

      await act(async () => { gate.resolve({}); });
      await flush();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isLoaded).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('configures background/silent-mode audio and loads the URL without autoplay', async () => {
      const { sound } = await mountLoaded();
      expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentModeIOS: true, staysActiveInBackground: true });
      expect(sound.loadAsync).toHaveBeenCalledWith({ uri: URL_A }, { shouldPlay: false });
      expect(sound.playAsync).not.toHaveBeenCalled();
    });

    it('surfaces an error and stays unloaded when the file fails to load', async () => {
      const gate = deferred<object>();
      setAudioModeAsync.mockReturnValueOnce(gate.promise);
      const { result } = renderHook(useHook, { url: URL_A, phrases: PHRASES });
      mockSoundsNextLoadFails();
      await act(async () => { gate.resolve({}); });
      await flush();
      expect(result.current.isLoaded).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(expect.any(String));
      expect(result.current.error).not.toBe('');
    });

    it('surfaces an error when the audio mode cannot be configured', async () => {
      setAudioModeAsync.mockRejectedValueOnce(new Error('audio session busy'));
      const { result } = renderHook(useHook, { url: URL_A, phrases: PHRASES });
      await flush();
      expect(mockSounds).toHaveLength(0);
      expect(result.current).toMatchObject({ isLoaded: false, isLoading: false });
      expect(result.current.error).toEqual(expect.any(String));
    });

    it('clears a previous error when a new URL starts loading', async () => {
      setAudioModeAsync.mockRejectedValueOnce(new Error('boom'));
      const { result, rerender } = renderHook(useHook, { url: URL_A, phrases: PHRASES });
      await flush();
      expect(result.current.error).not.toBeNull();
      rerender({ url: URL_B, phrases: PHRASES });
      await flush();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoaded).toBe(true);
    });
  });

  describe('playback status', () => {
    it('maps position, duration and playing state from expo-av status (ms → s)', async () => {
      const { result, sound } = await mountLoaded();
      emitStatus(sound, { isLoaded: true, positionMillis: 8000, durationMillis: 3_600_000, isPlaying: true });
      expect(result.current.position).toBe(8);
      expect(result.current.duration).toBe(3600);
      expect(result.current.isPlaying).toBe(true);
    });

    it('moves the active phrase with the playback position', async () => {
      const { result, sound } = await mountLoaded();
      expect(result.current.activePhraseIndex).toBe(0);
      emitStatus(sound, { isLoaded: true, positionMillis: 13_000, durationMillis: 30_000, isPlaying: true });
      expect(result.current.activePhraseIndex).toBe(2);
      emitStatus(sound, { isLoaded: true, positionMillis: 5_000, durationMillis: 30_000, isPlaying: true });
      expect(result.current.activePhraseIndex).toBe(1);
    });

    it('keeps the active phrase at 0 when there is no sync map', async () => {
      const { result, sound } = await mountLoaded([]);
      emitStatus(sound, { isLoaded: true, positionMillis: 50_000, durationMillis: 90_000, isPlaying: true });
      expect(result.current.activePhraseIndex).toBe(0);
      expect(result.current.duration).toBe(90);
    });

    it('uses the sync map length when expo-av under-reports or omits duration', async () => {
      const { result, sound } = await mountLoaded();
      emitStatus(sound, { isLoaded: true, positionMillis: 1000, durationMillis: 10_000, isPlaying: false });
      expect(result.current.duration).toBe(30);
      emitStatus(sound, { isLoaded: true, positionMillis: 1000, durationMillis: undefined, isPlaying: false });
      expect(result.current.duration).toBe(30);
    });

    it('ignores statuses for an unloaded sound', async () => {
      const { result, sound } = await mountLoaded();
      emitStatus(sound, { isLoaded: true, positionMillis: 6000, durationMillis: 30_000, isPlaying: true });
      emitStatus(sound, { isLoaded: false, error: 'decoder reset' });
      expect(result.current.position).toBe(6);
      expect(result.current.isPlaying).toBe(true);
    });
  });

  describe('controls', () => {
    it('play and pause drive the loaded sound', async () => {
      const { result, sound } = await mountLoaded();
      await act(async () => { await result.current.play(); });
      expect(sound.playAsync).toHaveBeenCalledTimes(1);
      await act(async () => { await result.current.pause(); });
      expect(sound.pauseAsync).toHaveBeenCalledTimes(1);
    });

    it('controls are safe no-ops before the sound has loaded', async () => {
      const gate = deferred<object>();
      setAudioModeAsync.mockReturnValueOnce(gate.promise);
      const { result } = renderHook(useHook, { url: URL_A, phrases: PHRASES });
      await act(async () => {
        await result.current.play();
        await result.current.pause();
        await result.current.seekTo(10);
        await result.current.skipBack();
        await result.current.skipForward();
        await result.current.seekToPhrase(PHRASES[2]);
      });
      expect(mockSounds).toHaveLength(0);
      await act(async () => { gate.resolve({}); });
    });

    it('seekTo converts seconds to ms and clamps to [0, full-book length]', async () => {
      const { result, sound } = await mountLoaded();
      emitStatus(sound, { isLoaded: true, positionMillis: 0, durationMillis: 10_000, isPlaying: false });
      await act(async () => { await result.current.seekTo(12.5); });
      expect(sound.setPositionAsync).toHaveBeenLastCalledWith(12_500);
      await act(async () => { await result.current.seekTo(-4); });
      expect(sound.setPositionAsync).toHaveBeenLastCalledWith(0);
      // Past chapter 1's reported 10 s but within the sync map's 30 s: allowed.
      await act(async () => { await result.current.seekTo(25); });
      expect(sound.setPositionAsync).toHaveBeenLastCalledWith(25_000);
      await act(async () => { await result.current.seekTo(999); });
      expect(sound.setPositionAsync).toHaveBeenLastCalledWith(30_000);
    });

    it('skipBack jumps 15 s back from the current position, never below 0', async () => {
      const { result, sound } = await mountLoaded();
      emitStatus(sound, { isLoaded: true, positionMillis: 20_000, durationMillis: 30_000, isPlaying: true });
      await act(async () => { await result.current.skipBack(); });
      expect(sound.setPositionAsync).toHaveBeenLastCalledWith(5000);
      emitStatus(sound, { isLoaded: true, positionMillis: 6000, durationMillis: 30_000, isPlaying: true });
      await act(async () => { await result.current.skipBack(); });
      expect(sound.setPositionAsync).toHaveBeenLastCalledWith(0);
    });

    it('skipForward jumps 15 s ahead, capped at the full-book length', async () => {
      const { result, sound } = await mountLoaded();
      emitStatus(sound, { isLoaded: true, positionMillis: 6000, durationMillis: 10_000, isPlaying: true });
      await act(async () => { await result.current.skipForward(); });
      expect(sound.setPositionAsync).toHaveBeenLastCalledWith(21_000);
      emitStatus(sound, { isLoaded: true, positionMillis: 20_000, durationMillis: 10_000, isPlaying: true });
      await act(async () => { await result.current.skipForward(); });
      expect(sound.setPositionAsync).toHaveBeenLastCalledWith(30_000);
    });

    it('setSpeed updates the speed and applies it pitch-corrected', async () => {
      const { result, sound } = await mountLoaded();
      expect(result.current.speed).toBe(1);
      await act(async () => { await result.current.setSpeed(1.5); });
      expect(result.current.speed).toBe(1.5);
      expect(sound.setRateAsync).toHaveBeenCalledWith(1.5, true);
    });

    it('setSpeed records the chosen speed even before the sound loads', async () => {
      const { result } = renderHook(useHook, { url: null, phrases: PHRASES });
      await act(async () => { await result.current.setSpeed(0.75); });
      expect(result.current.speed).toBe(0.75);
    });

    it('seekToPhrase seeks to the phrase start in ms', async () => {
      const { result, sound } = await mountLoaded();
      await act(async () => { await result.current.seekToPhrase(PHRASES[2]); });
      expect(sound.setPositionAsync).toHaveBeenLastCalledWith(12_000);
    });
  });

  describe('incomplete sync-map entries (API rows with missing timings)', () => {
    // SyncPhrase timings are typed as numbers, but the hook defends against missing values
    // with `?? 0`; these rows exercise that defence through the public behaviour.
    const partial = [
      { index: 0, startTime: 0, endTime: 4 },
      { index: 1 } as unknown as SyncPhrase,                 // untimed marker without fields
      { index: 2, startTime: 4, endTime: 9 },
      { index: 3, startTime: 9 } as unknown as SyncPhrase,   // trailing row missing endTime
    ];

    it('skips untimed rows when tracking the active phrase', async () => {
      const { result, sound } = await mountLoaded(partial);
      emitStatus(sound, { isLoaded: true, positionMillis: 6000, durationMillis: 60_000, isPlaying: true });
      expect(result.current.activePhraseIndex).toBe(2);
    });

    it('falls back to the raw duration when the last row has no end time', async () => {
      const { result, sound } = await mountLoaded(partial);
      emitStatus(sound, { isLoaded: true, positionMillis: 0, durationMillis: 12_000, isPlaying: false });
      expect(result.current.duration).toBe(12);
    });

    it('seekToPhrase treats a missing start time as the beginning', async () => {
      const { result, sound } = await mountLoaded(partial);
      await act(async () => { await result.current.seekToPhrase(partial[1]); });
      expect(sound.setPositionAsync).toHaveBeenLastCalledWith(0);
    });
  });

  describe('cleanup', () => {
    it('unloads the sound on unmount', async () => {
      const { unmount, sound } = await mountLoaded();
      unmount();
      expect(sound.unloadAsync).toHaveBeenCalledTimes(1);
    });

    it('swallows an unload failure on unmount', async () => {
      const { unmount, sound } = await mountLoaded();
      sound.unloadAsync.mockRejectedValueOnce(new Error('already released'));
      expect(() => unmount()).not.toThrow();
      await flush();
    });

    it('switching URL unloads the old sound, resets progress and loads the new one', async () => {
      const { result, rerender, sound } = await mountLoaded();
      emitStatus(sound, { isLoaded: true, positionMillis: 12_000, durationMillis: 60_000, isPlaying: true });
      rerender({ url: URL_B, phrases: PHRASES });
      expect(sound.unloadAsync).toHaveBeenCalledTimes(1);
      expect(result.current).toMatchObject({ isLoaded: false, isPlaying: false, position: 0 });
      await flush();
      expect(mockSounds).toHaveLength(2);
      expect(mockSounds[1].loadAsync).toHaveBeenCalledWith({ uri: URL_B }, { shouldPlay: false });
      expect(result.current.isLoaded).toBe(true);
      await act(async () => { await result.current.play(); });
      expect(mockSounds[1].playAsync).toHaveBeenCalledTimes(1);
      expect(sound.playAsync).not.toHaveBeenCalled();
    });

    it('ignores late status updates from a replaced sound', async () => {
      const { result, rerender, sound } = await mountLoaded();
      rerender({ url: URL_B, phrases: PHRASES });
      await flush();
      emitStatus(sound, { isLoaded: true, positionMillis: 25_000, durationMillis: 30_000, isPlaying: true });
      expect(result.current.position).toBe(0);
      expect(result.current.isPlaying).toBe(false);
    });

    it('a load that finishes after the URL changed never becomes the active sound', async () => {
      const slowLoad = deferred<object>();
      const gate = deferred<object>();
      setAudioModeAsync.mockReturnValueOnce(gate.promise);
      const { result, rerender } = renderHook(useHook, { url: URL_A, phrases: PHRASES });
      mockSoundsNextLoadReturns(slowLoad.promise);
      await act(async () => { gate.resolve({}); });
      const first = mockSounds[0];
      expect(first.loadAsync).toHaveBeenCalled();

      rerender({ url: URL_B, phrases: PHRASES });
      expect(first.unloadAsync).toHaveBeenCalledTimes(1); // in-flight sound released
      await flush();
      await act(async () => { slowLoad.resolve({}); });
      await flush();

      await act(async () => { await result.current.play(); });
      expect(first.playAsync).not.toHaveBeenCalled();
      expect(mockSounds[1].playAsync).toHaveBeenCalledTimes(1);
    });

    it('a load failure after unmount is not reported', async () => {
      const slowLoad = deferred<object>();
      const gate = deferred<object>();
      setAudioModeAsync.mockReturnValueOnce(gate.promise);
      const { result, unmount } = renderHook(useHook, { url: URL_A, phrases: PHRASES });
      mockSoundsNextLoadReturns(slowLoad.promise);
      await act(async () => { gate.resolve({}); });
      unmount();
      const errorBefore = result.current.error;
      await act(async () => { slowLoad.reject(new Error('network gone')); });
      expect(result.current.error).toBe(errorBefore);
    });

    // DEFECT M-D3 (documented, not fixed in CI-4.1 — test-only mission). If the component
    // unmounts (or the URL changes) while Audio.setAudioModeAsync is still pending, cleanup
    // runs while `sound` is still null; load() then resumes, creates a Sound and loads the file
    // anyway, and nothing ever unloads it → the audio resource leaks. Marked `failing` so the
    // suite stays green today and turns red (prompting removal of `.failing`) once fixed.
    it.failing('M-D3: a sound created after unmount is unloaded (currently leaks)', async () => {
      const gate = deferred<object>();
      setAudioModeAsync.mockReturnValueOnce(gate.promise);
      const { unmount } = renderHook(useHook, { url: URL_A, phrases: PHRASES });
      unmount();
      await act(async () => { gate.resolve({}); });
      await flush();
      const leaked = mockSounds.filter((s) => s.loadAsync.mock.calls.length > 0 && s.unloadAsync.mock.calls.length === 0);
      expect(leaked).toHaveLength(0);
    });
  });
});

/** Makes the next Sound created by the hook fail in loadAsync. */
function mockSoundsNextLoadFails() {
  mockSoundsNextLoadReturns(Promise.reject(new Error('404 audio not found')));
}

/** Makes the next Sound created by the hook return `promise` from loadAsync. */
function mockSoundsNextLoadReturns(promise: Promise<unknown>) {
  promise.catch(() => {});
  const Sound = Audio.Sound as unknown as jest.Mock;
  const base = Sound.getMockImplementation() as () => MockSound;
  Sound.mockImplementationOnce(() => {
    const sound = base();
    sound.loadAsync.mockReturnValueOnce(promise);
    return sound;
  });
}
