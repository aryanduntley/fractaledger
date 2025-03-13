/**
 * Test Setup
 * 
 * This file sets up the test environment for the FractaLedger system.
 */

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.API_PORT = '3001';
process.env.API_HOST = 'localhost';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1d';

// Set up global test timeout
jest.setTimeout(30000);

// Mock the console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn
};

// Set up global beforeAll and afterAll hooks
beforeAll(() => {
  // Any setup that should run before all tests
});

afterAll(() => {
  // Any cleanup that should run after all tests
});

// Set up global beforeEach and afterEach hooks
beforeEach(() => {
  // Any setup that should run before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Any cleanup that should run after each test
});
