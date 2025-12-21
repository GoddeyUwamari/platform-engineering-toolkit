/**
 * Mock Redis Connection for Testing
 */

console.log('🔴 REDIS MOCK LOADED');

const mockRedisClient = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(3600),
  exists: jest.fn().mockResolvedValue(0),
  sadd: jest.fn().mockResolvedValue(1),
  srem: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  on: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn().mockResolvedValue(undefined),
};

export const getRedisClient = jest.fn(() => mockRedisClient);
export const connectRedis = jest.fn().mockResolvedValue(undefined);
export const disconnectRedis = jest.fn().mockResolvedValue(undefined);
export const checkRedisHealth = jest.fn().mockResolvedValue(true);
