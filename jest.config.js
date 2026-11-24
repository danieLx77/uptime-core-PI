export default {
  testEnvironment: 'node',
  transform: {},
  clearMocks: true,
  coveragePathIgnorePatterns: ['/node_modules/', '/src/generated/'],
  coverageProvider: 'v8',
  setupFiles: ['dotenv/config'],
};
