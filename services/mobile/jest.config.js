/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: '.',
  testRegex: 'tests/unit/.*\\.spec\\.tsx?$',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '@react-native-async-storage/async-storage':
      '<rootDir>/tests/__mocks__/@react-native-async-storage/async-storage.ts',
    '^react-native$': '<rootDir>/tests/__mocks__/react-native.ts',
    '^expo-av$': '<rootDir>/tests/__mocks__/expo-av.ts',
    '^@react-native-community/netinfo$': '<rootDir>/tests/__mocks__/@react-native-community/netinfo.ts',
    '^expo-notifications$': '<rootDir>/tests/__mocks__/expo-notifications.ts',
    '^expo-apple-authentication$': '<rootDir>/tests/__mocks__/expo-apple-authentication.ts',
    '^expo-auth-session$': '<rootDir>/tests/__mocks__/expo-auth-session.ts',
    '^expo-web-browser$': '<rootDir>/tests/__mocks__/expo-web-browser.ts',
  },
  collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx', '!src/navigation/**'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
};
