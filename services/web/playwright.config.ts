import { defineConfig, devices } from '@playwright/test';

// E2E target (CI-1).
// - Default (local and CI): the checked-out web app, served from its own production build on loopback.
//   Build it first (`pnpm --filter @noetia/web build`); `webServer` then starts it with `next start` and waits
//   until it answers. If the build is missing or the server cannot start, the run fails before any test.
// - Manual only: set BASE_URL to test an already-running deployment (e.g. BASE_URL=https://noetia.app). This is
//   refused under CI, so CI can never test, or send traffic to, production.
const LOCAL_HOST = '127.0.0.1';
// CI always uses 3000; E2E_PORT lets a developer pick a free port locally (e.g. when a dev server holds 3000).
const LOCAL_PORT = Number(process.env.E2E_PORT ?? 3000);
const LOCAL_URL = `http://${LOCAL_HOST}:${LOCAL_PORT}`;

const isCI = Boolean(process.env.CI);
const explicitBaseURL = process.env.BASE_URL?.trim() || undefined;

function isLoopback(url: string): boolean {
  try {
    return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

if (isCI && explicitBaseURL && !isLoopback(explicitBaseURL)) {
  throw new Error(
    `E2E: BASE_URL=${explicitBaseURL} is not a loopback address. CI must test the checked-out build on ${LOCAL_URL}, never a deployed site.`,
  );
}

const baseURL = explicitBaseURL ?? LOCAL_URL;
const targetsLocalBuild = explicitBaseURL === undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  forbidOnly: isCI,

  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    // Against the local build, the browser cannot resolve any hostname except loopback. Tests mock the API with
    // page.route (intercepted before DNS), so a request that is not mocked fails locally instead of reaching
    // noetia.app, storage.noetia.app or any other external host.
    launchOptions: targetsLocalBuild
      ? { args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] }
      : {},
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: targetsLocalBuild
    ? {
        command: `node ./node_modules/next/dist/bin/next start --hostname ${LOCAL_HOST} --port ${LOCAL_PORT}`,
        url: LOCAL_URL,
        timeout: 120_000,
        // Never reuse whatever already listens on the port (e.g. a dev server): it would not be the build under test.
        reuseExistingServer: false,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NEXT_TELEMETRY_DISABLED: '1',
          // Server-rendered pages that call the API (INTERNAL_API_URL) reach a closed loopback port, so an API
          // call the tests do not mock fails locally and never leaves the runner. The /api rewrite target is
          // fixed at build time; CI builds with the same value.
          INTERNAL_API_URL: 'http://127.0.0.1:9',
        },
      }
    : undefined,
});
