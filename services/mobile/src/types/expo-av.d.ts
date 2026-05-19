declare module 'expo-av' {
  export interface AVPlaybackStatus {
    isLoaded: boolean;
    positionMillis: number;
    durationMillis?: number;
    isPlaying: boolean;
  }

  export namespace Audio {
    function setAudioModeAsync(mode: Record<string, unknown>): Promise<void>;

    class Sound {
      setOnPlaybackStatusUpdate(callback: (status: AVPlaybackStatus) => void): void;
      loadAsync(source: { uri: string }, initialStatus?: Record<string, unknown>): Promise<void>;
      playAsync(): Promise<void>;
      pauseAsync(): Promise<void>;
      setPositionAsync(positionMillis: number): Promise<void>;
      setRateAsync(rate: number, shouldCorrectPitch: boolean): Promise<void>;
      unloadAsync(): Promise<void>;
    }
  }
}
