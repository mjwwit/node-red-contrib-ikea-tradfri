module.exports = {
  roots: [
    "<rootDir>/src/",
    "<rootDir>/test/",
  ],
  testMatch: [
    "<rootDir>/test/**/*.spec.ts",
  ],
  collectCoverageFrom: [
    "<rootDir>/src/**/*",
    "!<rootDir>/node_modules/**",
    "!<rootDir>/test/**"
  ],
  globals: {
    'ts-jest': {
      tsconfig: 'test/tsconfig.json',
    }
  },
  preset: 'ts-jest',
  testEnvironment: 'node'
}
