import { defineConfig, devices } from '@playwright/test';

// E2E target (CI-1).
// - CI: always the checked-out web app, served from its own production build on loopback. Build it first
//   (`pnpm --filter @noetia/web build`); `webServer` then starts it with `next start` and waits until it answers.
//   If the build is missing or the server cannot start, the run fails before any test. Any BASE_URL supplied under
//   CI, including a loopback one, is refused at configuration load (F-CI1-1): it would replace the managed build
//   and switch off the browser host restriction below.
// - Local default: the same managed local build.
// - Manual only, outside CI: set BASE_URL to test an already-running deployment (e.g. BASE_URL=https://noetia.app).
const LOCAL_HOST = '127.0.0.1';
// CI always uses 3000; E2E_PORT lets a developer pick a free port locally (e.g. when a dev server holds 3000).
const LOCAL_PORT = Number(process.env.E2E_PORT ?? 3000);
const LOCAL_URL = `http://${LOCAL_HOST}:${LOCAL_PORT}`;

const isCI = Boolean(process.env.CI);

if (isCI && process.env.BASE_URL !== undefined) {
  throw new Error(
    `E2E: BASE_URL must not be set under CI (got "${process.env.BASE_URL}"). CI always tests the checked-out build ` +
      `served by the managed webServer on ${LOCAL_URL}; unset BASE_URL.`,
  );
}

const explicitBaseURL = isCI ? undefined : process.env.BASE_URL?.trim() || undefined;
const baseURL = explicitBaseURL ?? LOCAL_URL;
// Under CI this is always true (BASE_URL is refused above).
const targetsLocalBuild = isCI || explicitBaseURL === undefined;

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
    // Against the local build, the test BROWSER cannot resolve any hostname except loopback. Tests mock the API
    // with page.route (intercepted before DNS), so a browser request that is not mocked fails locally instead of
    // reaching noetia.app, storage.noetia.app or any other external host. This restricts the browser only; it is
    // not a network sandbox for the Next.js server process (see INTERNAL_API_URL below).
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
          // Server-rendered pages and the /api rewrite use INTERNAL_API_URL, which points at a closed loopback
          // port, so those API calls fail locally instead of reaching a deployed API. The rewrite target is fixed
          // at build time; CI builds with the same value. This covers the configured API paths only: it does not
          // stop other server-side code from opening external connections, and the runner itself has network access.
          INTERNAL_API_URL: 'http://127.0.0.1:9',
        },
      }
    : undefined,
});
