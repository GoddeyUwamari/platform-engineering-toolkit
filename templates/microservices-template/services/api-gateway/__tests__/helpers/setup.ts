/**
 * Test Setup for API Gateway
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.test') });

process.env.NODE_ENV = 'test';

// Mock external services
jest.mock('axios');
jest.mock('@shared/cache/redis-connection', () => ({
  getRedisClient: jest.fn(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  })),
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
  checkRedisHealth: jest.fn(() => Promise.resolve(true)),
}));

beforeAll(async () => {
  console.log('Test environment setup complete');
});

afterAll(async () => {
  console.log('Test environment teardown complete');
});

beforeEach(() => {
  jest.clearAllMocks();
});
