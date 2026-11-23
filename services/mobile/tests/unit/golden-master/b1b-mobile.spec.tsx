/**
 * NEM-025 B1-B mobile golden master.
 *
 * Captured on UNCHANGED code (Checkpoint A head 8114379) before any B1-B refactor: the visible text and
 * accessibility attributes of the mobile surfaces in scope, in ES and EN. Later B1-B commits run against
 * this snapshot; every changed entry must be an intentional, documented correction.
 *
 * Dates are masked as `<date:LOCALE>` so the snapshot does not depend on the machine's locale or time zone,
 * while still recording WHICH locale a surface asks for (`device` = no locale passed).
 */
import React from 'react';
import { mockHarness, resetHarness, shallowRender } from './harness';
import { en } from '../../../src/i18n/en';
import { es } from '../../../src/i18n/es';
import { frCA } from '../../../src/i18n/fr-ca';

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return require('./harness').stubHooks(actual);
});

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator', SectionList: 'SectionList', FlatList: 'FlatList',
  TextInput: 'TextInput', KeyboardAvoidingView: 'KeyboardAvoidingView', RefreshControl: 'RefreshControl',
  Image: 'Image', Modal: 'Modal', Switch: 'Switch', Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
  Alert: { alert: jest.fn() }, Linking: { openURL: jest.fn() }, Platform: { OS: 'ios', select: (o: any) => o.ios },
  BackHandler: { exitApp: jest.fn() }, Share: { share: jest.fn() },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => require('./harness').mockHarness.route,
}), { virtual: true });
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({ Navigator: 'TabNavigator', Screen: 'TabScreen' }),
}), { virtual: true });
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: 'StackNavigator', Screen: 'StackScreen' }),
}), { virtual: true });

jest.mock('../../../src/hooks/useNetworkSync', () => ({ useNetworkSync: () => {} }));
jest.mock('../../../src/hooks/usePushNotifications', () => ({ usePushNotifications: () => {} }));
jest.mock('../../../src/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock('../../../src/auth/AuthContext', () => ({ useAuth: () => ({ logout: jest.fn() }) }));
jest.mock('../../../src/components/TourContext', () => ({ useTour: () => ({ startTour: jest.fn() }) }));
jest.mock('../../../src/components/ShareSheet', () => ({ ShareSheet: () => null }));

const mockClubSession = {
  connected: true,
  playback: { isPlaying: false, positionMs: 0 },
  members: [{ socketId: 's1', userId: 'me' }, { socketId: 's2', userId: 'u2' }],
  messages: [] as unknown[],
  error: 'Not a club member',
  isHost: false,
  myUserId: 'me',
  play: jest.fn(), pause: jest.fn(), seek: jest.fn(), sendMessage: jest.fn(),
};
jest.mock('../../../src/hooks/useClubSession', () => ({ useClubSession: () => mockClubSession }));

import { MainNavigator } from '../../../src/navigation/MainNavigator';
import { LanguageScreen } from '../../../src/screens/LanguageScreen';
import { SocialAuthButtons } from '../../../src/auth/SocialAuthButtons';
import { LoginScreen } from '../../../src/screens/auth/LoginScreen';
import { RegisterScreen } from '../../../src/screens/auth/RegisterScreen';
import { ConsentScreen } from '../../../src/screens/ConsentScreen';
import { LibraryScreen } from '../../../src/screens/library/LibraryScreen';
import { AudioPlayerBar } from '../../../src/components/AudioPlayerBar';
import { LiveSessionScreen } from '../../../src/screens/clubs/LiveSessionScreen';
import { ClubScreen } from '../../../src/screens/clubs/ClubScreen';
import { ClubsScreen } from '../../../src/screens/clubs/ClubsScreen';
import { FragmentsScreen } from '../../../src/screens/fragments/FragmentsScreen';
import { AccountScreen } from '../../../src/screens/account/AccountScreen';

const DICTS = { es, en, 'fr-CA': frCA } as const;
type Lang = keyof typeof DICTS;

function setLang(language: Lang) {
  mockHarness.lang = { language, t: DICTS[language] as never, setLanguage: async () => {}, isLoaded: true };
}

// ── Navigation: tab labels and stack header options, read from the navigator configuration ──
export function navigationSurface() {
  const tabs = (MainNavigator as () => any)();
  const out: string[] = [];
  const screens = React.Children.toArray(tabs.props.children) as any[];
  for (const screen of screens) {
    const name = screen.props.name as string;
    const opts = tabs.props.screenOptions({ route: { name } });
    out.push(`tab ${name}: ${opts.tabBarLabel}`);
    if (name === 'Library' || name === 'Clubs') {
      mockHarness.current = screen.props.component.name;
      mockHarness.index = 0;
      const stack = screen.props.component();
      for (const s of React.Children.toArray(stack.props.children) as any[]) {
        const o = typeof s.props.options === 'function'
          ? s.props.options({ route: { params: { bookTitle: '<book>', clubName: '<club>', sessionTitle: '<session>' } } })
          : s.props.options;
        out.push(`stack ${s.props.name}: title=${o.title ?? '-'} back=${o.headerBackTitle ?? '-'}`);
      }
    }
  }
  return out;
}

const SESSION = { id: 'sess1', title: 'Sesión 1', status: 'scheduled', scheduledAt: '2026-11-05T14:30:00Z', startPhraseIndex: 10, endPhraseIndex: 40, book: { id: 'b1', title: 'Libro' } };
const POLL = { id: 'p1', question: '¿Qué libro sigue?', status: 'open', closesAt: '2026-11-05T14:30:00Z', winnerOptionId: null };
const CLUB = { id: 'c1', name: 'Club Uno', description: 'Desc', type: 'public', owner: { name: 'Ana' } };

export const SURFACES: Array<[string, () => unknown]> = [
  ['navigation', () => ({ text: navigationSurface(), attrs: [] })],
  ['language-screen', () => shallowRender(<LanguageScreen onSelect={() => {}} />)],
  ['social-auth-buttons', () => shallowRender(<SocialAuthButtons onSuccess={() => {}} onError={() => {}} />)],
  ['login', () => shallowRender(<LoginScreen onLogin={() => {}} onRegister={() => {}} />)],
  ['register', () => shallowRender(<RegisterScreen onRegister={() => {}} onLogin={() => {}} />)],
  ['consent', () => shallowRender(<ConsentScreen onConsent={() => {}} />)],
  ['library/loaded', () => {
    mockHarness.overrides = { LibraryScreen: { 0: [{ id: 'm1', title: 'Mi Libro', author: 'A', coverUrl: null, isFree: false }], 1: [{ id: 'f1', title: 'Libre', author: 'B', coverUrl: null, isFree: true }], 2: false } };
    return shallowRender(<LibraryScreen />);
  }],
  ['library/empty', () => {
    mockHarness.overrides = { LibraryScreen: { 2: false } };
    return shallowRender(<LibraryScreen />);
  }],
  ['audio-bar/loading', () => shallowRender(
    <AudioPlayerBar isLoaded={false} isLoading isPlaying={false} position={0} duration={0} speed={1} error={null}
      onPlay={() => {}} onPause={() => {}} onSkipBack={() => {}} onSkipForward={() => {}} onSeek={() => {}} onSetSpeed={() => {}} onClose={() => {}} />,
  )],
  ['audio-bar/error', () => shallowRender(
    // The exact value useAudioPlayer sets on a load failure.
    <AudioPlayerBar isLoaded={false} isLoading={false} isPlaying={false} position={0} duration={0} speed={1} error="No se pudo cargar el audio."
      onPlay={() => {}} onPause={() => {}} onSkipBack={() => {}} onSkipForward={() => {}} onSeek={() => {}} onSetSpeed={() => {}} onClose={() => {}} />,
  )],
  ['live-session/connected-paused-error', () => {
    Object.assign(mockClubSession, { connected: true, playback: { isPlaying: false, positionMs: 0 }, error: 'Not a club member' });
    mockHarness.route = { params: { clubId: 'c1', sessionId: 'sess1' } };
    mockHarness.overrides = { LiveSessionScreen: { 0: SESSION, 1: 'https://audio', 2: false } };
    return shallowRender(<LiveSessionScreen />);
  }],
  ['live-session/connecting-playing', () => {
    Object.assign(mockClubSession, { connected: false, playback: { isPlaying: true, positionMs: 65000 }, error: '' });
    mockHarness.route = { params: { clubId: 'c1', sessionId: 'sess1' } };
    mockHarness.overrides = { LiveSessionScreen: { 0: SESSION, 1: 'https://audio', 2: false } };
    return shallowRender(<LiveSessionScreen />);
  }],
  ['club/sessions', () => {
    mockHarness.route = { params: { clubId: 'c1' } };
    mockHarness.overrides = { ClubScreen: { 0: CLUB, 1: null, 3: 'sessions', 4: false }, SessionsTab: { 0: [SESSION], 1: false } };
    return shallowRender(<ClubScreen />);
  }],
  ['club/polls', () => {
    mockHarness.route = { params: { clubId: 'c1' } };
    mockHarness.overrides = { ClubScreen: { 0: CLUB, 1: { userId: 'me', status: 'active' }, 3: 'polls', 4: false }, PollsTab: { 0: [POLL], 1: false } };
    return shallowRender(<ClubScreen />);
  }],
  ['clubs-list', () => {
    mockHarness.overrides = { ClubsScreen: { 1: [CLUB], 3: false } };
    return shallowRender(<ClubsScreen />);
  }],
  ['fragments', () => {
    mockHarness.overrides = { FragmentsScreen: { 0: [{ id: 'fr1', bookId: 'b1', text: 'Una frase.', createdAt: '2026-11-05T14:30:00Z' }], 1: false } };
    return shallowRender(<FragmentsScreen />);
  }],
  ['account', () => {
    mockHarness.overrides = { AccountScreen: { 0: { id: 'u1', name: 'Ana', email: 'ana@example.com', userType: 'personal' }, 1: false } };
    return shallowRender(<AccountScreen />);
  }],
];

const realToLocaleString = Date.prototype.toLocaleString;
const realToLocaleDateString = Date.prototype.toLocaleDateString;
beforeAll(() => {
  Date.prototype.toLocaleString = function (locale?: string | string[]) { return `<date:${locale ?? 'device'}>`; } as never;
  Date.prototype.toLocaleDateString = function (locale?: string | string[]) { return `<date:${locale ?? 'device'}>`; } as never;
});
afterAll(() => {
  Date.prototype.toLocaleString = realToLocaleString;
  Date.prototype.toLocaleDateString = realToLocaleDateString;
});
beforeEach(() => { resetHarness(); delete process.env.EXPO_PUBLIC_FR_CA_ENABLED; });

function renderIn(lang: Lang, make: () => unknown) {
  resetHarness();
  setLang(lang);
  return make();
}

describe('B1-B ES/EN golden master', () => {
  it.each(SURFACES)('%s renders the same ES and EN text and accessibility attributes', (_name, make) => {
    const esOut = renderIn('es', make);
    const enOut = renderIn('en', make);
    expect({ es: esOut, en: enOut }).toMatchSnapshot();
  });
});
