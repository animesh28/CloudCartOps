module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: true
};
