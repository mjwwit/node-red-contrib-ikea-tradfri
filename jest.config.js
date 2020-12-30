module.exports = {
  roots: [
    "<rootDir>/src/",
    "<rootDir>/test/",
  ],
  testMatch: [
    "**/test/**/*.spec.ts",
  ],
  collectCoverageFrom: [
    "**/src/**/*",
    "!**/node_modules/**",
    "!**/test/**"
  ],
  globals: {
    'ts-jest': {
      tsConfig: 'test/tsconfig.json',
    }
  },
  preset: 'ts-jest',
  testEnvironment: 'node'
}
