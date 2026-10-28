/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: __dirname,
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleFileExtensions: ["ts", "js", "json"],
  // Coverage is opt-in: `npm run test:coverage` (or `jest --coverage`).
  collectCoverage: false,
  coverageDirectory: "<rootDir>/coverage",
  // Set slightly below measured coverage (2026-10-29: 55.1% stmts, 47.2% branches,
  // 44.9% funcs, 56.0% lines). Ratchet up as tests are added.
  coverageThreshold: {
    global: { statements: 53, branches: 45, functions: 43, lines: 54 },
  },
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
  transform: {
    "^.+\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
};
