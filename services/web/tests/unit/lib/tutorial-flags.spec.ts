import {
  hasSeenWelcome, markWelcomeSeen,
  hasSeenFragmentsTutorial, markFragmentsTutorialSeen,
  hasSeenAudioTutorial, markAudioTutorialSeen,
  hasSeenClubsTutorial, markClubsTutorialSeen,
} from '../../../lib/tutorial-flags';

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });
});

const CASES = [
  { label: 'welcome',   hasSeen: hasSeenWelcome,          markSeen: markWelcomeSeen,          key: 'noetia_welcome_seen' },
  { label: 'fragments', hasSeen: hasSeenFragmentsTutorial, markSeen: markFragmentsTutorialSeen, key: 'noetia_fragments_tutorial_seen' },
  { label: 'audio',     hasSeen: hasSeenAudioTutorial,     markSeen: markAudioTutorialSeen,     key: 'noetia_audio_tutorial_seen' },
  { label: 'clubs',     hasSeen: hasSeenClubsTutorial,     markSeen: markClubsTutorialSeen,     key: 'noetia_clubs_tutorial_seen' },
];

for (const { label, hasSeen, markSeen, key } of CASES) {
  describe(`${label} tutorial flag`, () => {
    it('returns false when not yet seen', () => {
      expect(hasSeen()).toBe(false);
    });

    it('returns true after markSeen is called', () => {
      markSeen();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(key, '1');
      mockStorage[key] = '1';
      expect(hasSeen()).toBe(true);
    });

    it('returns true in a server-side (no window) context', () => {
      const windowSpy = jest.spyOn(global, 'window', 'get').mockReturnValue(undefined as any);
      expect(hasSeen()).toBe(true);
      windowSpy.mockRestore();
    });
  });
}
