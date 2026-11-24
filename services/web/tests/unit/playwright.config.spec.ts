/**
 * @jest-environment node
 *
 * CI-1 / F-CI1-1 — configuration-level controls for playwright.config.ts.
 *
 * Loads the real config module under different environments. `@playwright/test` is replaced by a pass-through
 * `defineConfig`, so the exact object Playwright would receive is inspected. No browser starts, no server starts and
 * no network request is made.
 */
jest.mock('@playwright/test', () => ({
  defineConfig: (config: unknown) => config,
  devices: { 'Desktop Chrome': { browserName: 'chromium' } },
}));

type LoadedConfig = {
  use: { baseURL: string; launchOptions: { args?: string[] } };
  webServer?: { command: string; url: string; reuseExistingServer: boolean; env: Record<string, string> };
  forbidOnly: boolean;
};

const ENV_KEYS = ['CI', 'BASE_URL', 'E2E_PORT'] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function load(env: Partial<Record<(typeof ENV_KEYS)[number], string>>): LoadedConfig {
  Object.assign(process.env, env);
  let config: LoadedConfig | undefined;
  jest.isolateModules(() => {
    config = require('../../playwright.config').default;
  });
  return config as LoadedConfig;
}

const HOST_RULE = '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost';

function expectManagedLocalBuild(config: LoadedConfig) {
  expect(config.use.baseURL).toBe('http://127.0.0.1:3000');
  expect(config.webServer).toBeDefined();
  expect(config.webServer?.url).toBe('http://127.0.0.1:3000');
  expect(config.webServer?.command).toContain('next start --hostname 127.0.0.1 --port 3000');
  expect(config.webServer?.reuseExistingServer).toBe(false);
  expect(config.webServer?.env.INTERNAL_API_URL).toBe('http://127.0.0.1:9');
  expect(config.use.launchOptions.args).toEqual([HOST_RULE]);
}

describe('playwright.config under CI', () => {
  it('without BASE_URL: managed local build, webServer and browser host isolation are on', () => {
    const config = load({ CI: 'true' });
    expectManagedLocalBuild(config);
    expect(config.forbidOnly).toBe(true);
  });

  it.each([
    ['production', 'https://noetia.app'],
    ['storage host', 'https://storage.noetia.app'],
    ['loopback IPv4', 'http://127.0.0.1:3000'],
    ['localhost', 'http://localhost:3000'],
    ['loopback IPv6', 'http://[::1]:3000'],
    ['empty string', ''],
    ['whitespace', '   '],
  ])('rejects BASE_URL (%s) at configuration load', (_label, value) => {
    expect(() => load({ CI: 'true', BASE_URL: value })).toThrow(/BASE_URL must not be set under CI/);
  });

  it('any non-empty CI value counts as CI (fail closed), e.g. CI=1 with a loopback BASE_URL', () => {
    expect(() => load({ CI: '1', BASE_URL: 'http://127.0.0.1:3000' })).toThrow(/BASE_URL must not be set under CI/);
  });
});

describe('playwright.config outside CI (manual use stays compatible)', () => {
  it('default: the same managed local build as CI', () => {
    const config = load({});
    expectManagedLocalBuild(config);
    expect(config.forbidOnly).toBe(false);
  });

  it('E2E_PORT moves the managed local build to another port', () => {
    const config = load({ E2E_PORT: '3100' });
    expect(config.use.baseURL).toBe('http://127.0.0.1:3100');
    expect(config.webServer?.url).toBe('http://127.0.0.1:3100');
  });

  it('explicit BASE_URL: tests that deployment, with no managed server and no host restriction', () => {
    const config = load({ BASE_URL: 'https://noetia.app' });
    expect(config.use.baseURL).toBe('https://noetia.app');
    expect(config.webServer).toBeUndefined();
    expect(config.use.launchOptions).toEqual({});
  });

  it('explicit loopback BASE_URL is honoured outside CI', () => {
    const config = load({ BASE_URL: ' http://localhost:4000 ' });
    expect(config.use.baseURL).toBe('http://localhost:4000');
    expect(config.webServer).toBeUndefined();
  });

  it('blank BASE_URL outside CI falls back to the managed local build', () => {
    expectManagedLocalBuild(load({ BASE_URL: '   ' }));
  });
});
