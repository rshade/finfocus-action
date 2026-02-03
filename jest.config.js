export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'esbuild-jest',
      {
        sourcemap: true,
        loaders: {
          '.ts': 'ts',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@actions/github)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@actions/core$': '<rootDir>/__mocks__/@actions/core.js',
    '^@actions/exec$': '<rootDir>/__mocks__/@actions/exec.js',
    '^@actions/github$': '<rootDir>/__mocks__/@actions/github.js',
    '^@actions/tool-cache$': '<rootDir>/__mocks__/@actions/tool-cache.js',
    '^(\\.\\.?/.+)\\.js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage',
};
