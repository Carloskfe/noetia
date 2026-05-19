export const Audio = {
  Sound: class {
    setOnPlaybackStatusUpdate = jest.fn();
    loadAsync = jest.fn().mockResolvedValue({});
    playAsync = jest.fn().mockResolvedValue({});
    pauseAsync = jest.fn().mockResolvedValue({});
    setPositionAsync = jest.fn().mockResolvedValue({});
    setRateAsync = jest.fn().mockResolvedValue({});
    unloadAsync = jest.fn().mockResolvedValue({});
  },
  setAudioModeAsync: jest.fn().mockResolvedValue({}),
};
