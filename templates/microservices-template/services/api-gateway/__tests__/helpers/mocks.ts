/**
 * Mock implementations for API Gateway
 */

import { Response } from 'express';

// Mock HTTP Client (axios)
export const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  request: jest.fn(),
};

// Mock Rate Limiter
export const mockRateLimiter = {
  consume: jest.fn(() => Promise.resolve()),
  get: jest.fn(() => Promise.resolve({ remainingPoints: 100 })),
};

// Mock Service Responses
export const mockServiceResponse = (data: any, status: number = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {},
});

// Mock Express Response
export const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
};

// Mock Logger
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

export function resetAllMocks(): void {
  jest.clearAllMocks();
}

beforeEach(() => {
  resetAllMocks();
});
