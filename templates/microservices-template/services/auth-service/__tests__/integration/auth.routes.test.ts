/**
 * Auth Routes Integration Tests
 * Tests API endpoints with real database interactions
 */

// Create persistent mock client outside the factory
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
};

// Mock Redis - must be before imports
jest.mock('@shared/cache/redis-connection', () => ({
  __esModule: true,
  getRedisClient: () => mockRedisClient,
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
  checkRedisHealth: jest.fn().mockResolvedValue(true),
}));

import request from 'supertest';
import app from '../../src/index';
import { getTestPool } from '../helpers/setup';
import { createTenant, createUser, generateRegisterRequest } from '../helpers/factories';

describe('Auth Routes Integration Tests', () => {
  let testPool: any;

  beforeAll(async () => {
    testPool = getTestPool();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const registerData = generateRegisterRequest({
        email: 'newuser@example.com',
        password: 'Password123!',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData)
        .expect('Content-Type', /json/);


      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.user.email).toBe(registerData.email);
      expect(response.body.data.user.firstName).toBe(registerData.firstName);
      expect(response.body.data.user.lastName).toBe(registerData.lastName);
      expect(response.body.data.user).not.toHaveProperty('password');
      expect(response.body.data.user).not.toHaveProperty('passwordHash');

      // Verify cookies are set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      expect(cookieArray.some((c: string) => c.startsWith('refreshToken='))).toBe(true);
      expect(cookieArray.some((c: string) => c.startsWith('sessionId='))).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          // Missing password, firstName, lastName, tenantName
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid email format', async () => {
      const registerData = generateRegisterRequest({
        email: 'invalid-email',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 for weak password', async () => {
      const registerData = generateRegisterRequest({
        password: '123', // Too weak
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should allow same email in different tenants', async () => {
      const email = 'duplicate@example.com';

      // Register first user with tenant "Company A"
      const firstRegisterData = generateRegisterRequest({
        email,
        tenantName: 'Company A',
      });

      const firstResponse = await request(app)
        .post('/api/auth/register')
        .send(firstRegisterData);


      expect(firstResponse.status).toBe(201);
      const firstTenantId = firstResponse.body.data.user.tenantId;

      // Register same email with tenant "Company B" (should succeed - different tenant)
      const secondRegisterData = generateRegisterRequest({
        email,
        tenantName: 'Company B',
      });

      const secondResponse = await request(app)
        .post('/api/auth/register')
        .send(secondRegisterData);


      expect(secondResponse.status).toBe(201);
      const secondTenantId = secondResponse.body.data.user.tenantId;

      // Verify different tenants were created
      expect(secondTenantId).not.toBe(firstTenantId);

      // Verify both users have same email
      expect(firstResponse.body.data.user.email).toBe(email);
      expect(secondResponse.body.data.user.email).toBe(email);
    });
  });

  describe('POST /api/auth/login', () => {
    const password = 'Password123!';
    let tenant: any;
    let user: any;

    beforeEach(async () => {
      // Create tenant and user for login tests
      tenant = await createTenant(testPool);
      user = await createUser(testPool, {
        email: 'login@example.com',
        password,
        tenantId: tenant.id,
      });
    });

    it('should login user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-ID', tenant.id)
        .send({
          email: user.email,
          password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.user.email).toBe(user.email);

      // Verify cookies are set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      expect(cookieArray.some((c: string) => c.startsWith('refreshToken='))).toBe(true);
    });

    it('should return 400 for missing credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-ID', tenant.id)
        .send({
          email: user.email,
          // Missing password
        })
        .expect(400);
    });

    it('should return 400 for missing tenant ID', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password,
        })
        .expect(400);
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-ID', tenant.id)
        .send({
          email: user.email,
          password: 'WrongPassword123!',
        });


      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.message).toContain('Invalid email or password');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-ID', tenant.id)
        .send({
          email: 'nonexistent@example.com',
          password,
        });


      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/auth/me', () => {
    let tenant: any;
    let user: any;
    let accessToken: string;

    beforeEach(async () => {
      // Create tenant and user
      tenant = await createTenant(testPool);
      user = await createUser(testPool, {
        tenantId: tenant.id,
      });

      // Login to get access token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-ID', tenant.id)
        .send({
          email: user.email,
          password: 'Password123!',
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should get current user profile', async () => {

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);


      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.user.email).toBe(user.email);
      expect(response.body.data.user.id).toBe(user.id);
    });

    it('should return 401 without authorization token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    let tenant: any;
    let user: any;
    let accessToken: string;

    beforeEach(async () => {
      tenant = await createTenant(testPool);
      user = await createUser(testPool, { tenantId: tenant.id });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-ID', tenant.id)
        .send({
          email: user.email,
          password: 'Password123!',
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should logout user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Logout successful');

      // Verify cookies are cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies)).toBe(true);
    });

    it('should return 401 without authorization', async () => {
      await request(app)
        .post('/api/auth/logout')
        .expect(401);
    });
  });

  describe('GET /api/auth/health', () => {
    it('should return health check status', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.body.data).toHaveProperty('status');
    });
  });

  describe('PATCH /api/auth/profile', () => {
    let tenant: any;
    let user: any;
    let accessToken: string;

    beforeEach(async () => {
      tenant = await createTenant(testPool);
      user = await createUser(testPool, { tenantId: tenant.id });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-ID', tenant.id)
        .send({
          email: user.email,
          password: 'Password123!',
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should update user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
      expect(response.body.data.user.lastName).toBe(updateData.lastName);
    });

    it('should return 401 without authorization', async () => {
      await request(app)
        .patch('/api/auth/profile')
        .send({ firstName: 'Test' })
        .expect(401);
    });
  });
});
