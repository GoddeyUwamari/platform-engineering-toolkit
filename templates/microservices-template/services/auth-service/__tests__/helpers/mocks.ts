/**
 * Mock implementations for external services
 */

import { AuthTokens, User, UserRole, UserStatus, UUID } from '@shared/types';

// ============================================================================
// Redis Mock
// ============================================================================

export const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  exists: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  connect: jest.fn(),
};

export const mockRedisConnection = {
  getRedisClient: jest.fn(() => mockRedisClient),
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
  checkRedisHealth: jest.fn(() => Promise.resolve(true)),
};

// ============================================================================
// Session Service Mock
// ============================================================================

export const mockSessionService = {
  createSession: jest.fn((userId: string, refreshToken: string) =>
    Promise.resolve()
  ),
  getSession: jest.fn((sessionId: string) =>
    Promise.resolve({ userId: 'test-user-id', refreshToken: 'test-token' })
  ),
  deleteSession: jest.fn((sessionId: string) =>
    Promise.resolve()
  ),
  invalidateUserSessions: jest.fn((userId: string) =>
    Promise.resolve()
  ),
};

// ============================================================================
// Password Service Mock
// ============================================================================

export const mockPasswordService = {
  hashPassword: jest.fn((password: string) =>
    Promise.resolve('$2b$10$hashedpassword')
  ),
  comparePassword: jest.fn((password: string, hash: string) =>
    Promise.resolve(true)
  ),
  validatePasswordStrength: jest.fn((password: string) => ({
    isValid: true,
    errors: [],
  })),
};

// ============================================================================
// JWT/Auth Middleware Mock
// ============================================================================

export const mockGenerateAccessToken = jest.fn((payload: any) =>
  'mock-access-token'
);

export const mockGenerateRefreshToken = jest.fn((payload: any) =>
  'mock-refresh-token'
);

export const mockVerifyToken = jest.fn((token: string) => ({
  userId: 'test-user-id',
  email: 'test@example.com',
  role: UserRole.USER,
  tenantId: 'test-tenant-id',
}));

// ============================================================================
// Database Mock Data
// ============================================================================

export const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  tenantId: '123e4567-e89b-12d3-a456-426614174001',
  emailVerified: true,
  lastLoginAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockAuthTokens: AuthTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 900,
  tokenType: 'Bearer',
};

export const mockTenant = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Company',
  slug: 'test-company',
  domain: 'test.example.com',
  status: 'ACTIVE',
  settings: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Database Connection Mock
// ============================================================================

export const mockQuery = jest.fn();
export const mockQueryOne = jest.fn();
export const mockGetClient = jest.fn();
export const mockSetTenantContext = jest.fn();
export const mockClearTenantContext = jest.fn();

export const mockDatabaseConnection = {
  query: mockQuery,
  queryOne: mockQueryOne,
  getClient: mockGetClient,
  setTenantContext: mockSetTenantContext,
  clearTenantContext: mockClearTenantContext,
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
};

// ============================================================================
// Logger Mock
// ============================================================================

export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// ============================================================================
// Mock Reset Helpers
// ============================================================================

export function resetAllMocks(): void {
  jest.clearAllMocks();
  mockRedisClient.get.mockReset();
  mockRedisClient.set.mockReset();
  mockRedisClient.setex.mockReset();
  mockRedisClient.del.mockReset();
  mockSessionService.createSession.mockReset();
  mockSessionService.getSession.mockReset();
  mockSessionService.deleteSession.mockReset();
  mockPasswordService.hashPassword.mockReset();
  mockPasswordService.comparePassword.mockReset();
  mockGenerateAccessToken.mockReset();
  mockGenerateRefreshToken.mockReset();
  mockVerifyToken.mockReset();
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockLogger.info.mockReset();
  mockLogger.error.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.debug.mockReset();
}

// Reset mocks before each test
beforeEach(() => {
  resetAllMocks();
});
