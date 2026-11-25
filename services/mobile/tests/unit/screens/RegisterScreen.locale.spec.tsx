/**
 * NEM-025 B2-A2a — RegisterScreen sends the active interface language on local registration.
 * Uses the B1-B shallow harness (no React renderer in this package): hooks are stubbed, the screen is
 * called directly, and the submit button's onPress is invoked.
 */
import { mockHarness, resetHarness } from '../golden-master/harness';
import { en } from '../../../src/i18n/en';
import { es } from '../../../src/i18n/es';
import { frCA } from '../../../src/i18n/fr-ca';

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return require('../golden-master/harness').stubHooks(actual);
});
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity',
  TextInput: 'TextInput', KeyboardAvoidingView: 'KeyboardAvoidingView', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: unknown) => s }, Platform: { OS: 'ios' },
}));
const mockPost = jest.fn();
jest.mock('../../../src/api/client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }));
jest.mock('../../../src/auth/token-storage', () => ({
  saveToken: jest.fn(async () => undefined),
  saveRefreshToken: jest.fn(async () => undefined),
  saveUserType: jest.fn(async () => undefined),
}));
const mockSocial = jest.fn((_p: unknown) => null);
jest.mock('../../../src/auth/SocialAuthButtons', () => ({ SocialAuthButtons: (p: unknown) => mockSocial(p) }));

import { RegisterScreen } from '../../../src/screens/auth/RegisterScreen';

type Node = { type: unknown; props: Record<string, any> };
function find(node: unknown, pred: (n: Node) => boolean): Node[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((n) => find(n, pred));
  const n = node as Node;
  if (!('props' in n)) return [];
  return [...(pred(n) ? [n] : []), ...find(n.props.children, pred)];
}

const DICTS = { es, en, 'fr-CA': frCA } as const;

async function submitAs(language: 'es' | 'en' | 'fr-CA') {
  resetHarness();
  mockHarness.lang = { language, t: DICTS[language] as never, setLanguage: async () => {}, isLoaded: true };
  mockHarness.overrides = { RegisterScreen: { 0: ' Ana ', 1: ' Ana@Example.com ', 2: 'password123' } };
  mockHarness.current = 'RegisterScreen';
  mockHarness.index = 0;
  const onRegister = jest.fn();
  const tree = RegisterScreen({ onRegister, onLogin: jest.fn() });
  const [button] = find(tree, (n) => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === DICTS[language].auth.register.submit);
  expect(button.props.disabled).toBe(false);
  await button.props.onPress();
  return { onRegister, tree };
}

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ accessToken: 'acc', refreshToken: 'u:rt' });
  mockSocial.mockClear();
});

describe('RegisterScreen (B2-A2a)', () => {
  it.each(['es', 'en'] as const)('%s UI → POST /auth/register carries that uiLanguage', async (lang) => {
    const { onRegister } = await submitAs(lang);
    expect(mockPost).toHaveBeenCalledWith('/auth/register', {
      name: 'Ana', email: 'ana@example.com', password: 'password123', uiLanguage: lang,
    });
    expect(onRegister).toHaveBeenCalled();
  });

  it('fr-CA UI → no uiLanguage is sent (API default Spanish)', async () => {
    await submitAs('fr-CA');
    expect(mockPost).toHaveBeenCalledWith('/auth/register', {
      name: 'Ana', email: 'ana@example.com', password: 'password123',
    });
  });

  it('OAuth entry point is rendered unchanged and is not called by local registration', async () => {
    const { tree, onRegister } = await submitAs('en');
    const social = find(tree, (n) => typeof n.type === 'function' && n.props.onSuccess !== undefined);
    expect(social).toHaveLength(1);
    // Same contract as before B2-A2a: onSuccess = the screen's onRegister, onError = local error setter.
    expect(Object.keys(social[0].props).sort()).toEqual(['onError', 'onSuccess']);
    expect(social[0].props.onSuccess).toBe(onRegister);
    expect(mockSocial).not.toHaveBeenCalled(); // shallow tree: the OAuth component is never invoked here
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
