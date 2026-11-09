/**
 * NEM-019 integration tests against a DISPOSABLE local PostgreSQL and Redis.
 * Not part of `npm test` or CI. Run explicitly, in band:
 *
 *   NEM019_DISPOSABLE_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=nem019_test \
 *   DB_USER=noetia DB_PASS=test NEM019_REDIS_URL=redis://127.0.0.1:56379 \
 *   npx jest -c jest.integration.config.js --runInBand
 *
 * The suite refuses to run unless the database is local and its name ends in `_test`.
 */
/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'tests/integration/.*\\.int-spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 60000,
};
