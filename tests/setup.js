const path = require('path');

// Set extension path for tests
process.env.EXTENSION_PATH = path.resolve(__dirname, '../');

// Increase timeout for extension loading
jest.setTimeout(30000);

// Global test configuration
beforeAll(async () => {
  // Set up any global test configuration here
  console.log('[Test Setup] Extension path:', process.env.EXTENSION_PATH);
});

afterAll(async () => {
  // Cleanup after all tests
});

