/** @type {import('jest').Config} */
// Integration tests run against a REAL PostgreSQL (transactions, row locks, unique
// constraints) — mocks cannot prove concurrency safety. They are kept out of the
// unit run (`jest.config.js` only matches tests/unit/) and need a throwaway server:
//
//   INTEGRATION_DATABASE_URL=postgres://user:pass@127.0.0.1:55432/postgres npm run test:integration
//
// Each test file creates its own database, runs every migration, and drops it.
// Never point this at a shared or production database.
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'tests/integration/.*\\.int-spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 120_000,
};
