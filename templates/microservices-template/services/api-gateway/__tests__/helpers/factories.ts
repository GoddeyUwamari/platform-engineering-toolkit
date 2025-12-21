/**
 * Test Data Factories for API Gateway
 */

import { faker } from '@faker-js/faker';
import { Request } from 'express';

export function mockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    method: 'GET',
    path: '/api/test',
    headers: {},
    body: {},
    query: {},
    params: {},
    ip: faker.internet.ip(),
    get: jest.fn(),
    ...overrides,
  };
}

export function mockAuthRequest(userId: string, tenantId: string): Partial<Request> {
  return mockRequest({
    headers: {
      authorization: 'Bearer mock-token',
      'x-tenant-id': tenantId,
    },
    user: {
      userId,
      tenantId,
      email: faker.internet.email(),
      role: 'USER',
    } as any,
  });
}
