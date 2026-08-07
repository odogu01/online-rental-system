module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  verbose: true,
  // Timeout for each test
  testTimeout: 30000,
  // Collect coverage from source, not test files
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    'public/js/**/*.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/'
  ]
};
