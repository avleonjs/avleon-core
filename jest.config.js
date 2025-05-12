export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: process.cwd(), // Use current working directory
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
};
