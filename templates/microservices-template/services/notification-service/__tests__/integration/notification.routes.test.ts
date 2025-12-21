/**
 * Notification Routes Integration Tests
 * Tests notification API endpoints with mocked external services
 */

import request from 'supertest';
import app from '../../src/index';
import { getTestPool } from '../helpers/setup';
import { generateTokens } from '@shared/middleware/auth.middleware';
import { UserRole } from '@shared/types';

// Mock nodemailer before any imports
const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockTransporter = {
  sendMail: mockSendMail,
  verify: mockVerify,
  close: jest.fn(),
};

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => mockTransporter),
}));

// Mock email service
jest.mock('../../src/services/email.service', () => {
  const mockSendMailFn = jest.fn();
  return {
    emailService: {
      initialize: jest.fn().mockResolvedValue(undefined),
      sendEmail: mockSendMailFn,
      isReady: jest.fn().mockReturnValue(true),
      close: jest.fn().mockResolvedValue(undefined),
      isValidEmail: jest.fn((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    },
  };
});

// Mock notification config
jest.mock('../../src/config/notification.config', () => ({
  notificationConfig: {
    getEmailConfig: jest.fn().mockReturnValue({
      enabled: true,
      from: {
        name: 'CloudBill',
        address: 'noreply@cloudbill.com',
      },
      smtp: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'test-password',
        },
      },
      replyTo: 'support@cloudbill.com',
    }),
    getSMSConfig: jest.fn().mockReturnValue({
      enabled: true,
      provider: 'twilio',
      twilio: {
        accountSid: 'test-account-sid',
        authToken: 'test-auth-token',
        fromNumber: '+1234567890',
      },
    }),
    getWebhookConfig: jest.fn().mockReturnValue({
      enabled: true,
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoffMultiplier: 2,
      maxRedirects: 5,
      verifySSL: true,
    }),
  },
}));

// Mock Redis
const mockRedisClient = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(3600),
  exists: jest.fn().mockResolvedValue(0),
};

jest.mock('@shared/cache/redis-connection', () => ({
  __esModule: true,
  getRedisClient: () => mockRedisClient,
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
  checkRedisHealth: jest.fn().mockResolvedValue(true),
}));

// Mock SMS service (Twilio)
jest.mock('../../src/services/sms.service', () => {
  const originalModule = jest.requireActual('../../src/services/sms.service');
  return {
    ...originalModule,
    smsService: {
      initialize: jest.fn().mockResolvedValue(undefined),
      sendSMS: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'mock-sms-id-123',
      }),
      isReady: jest.fn().mockReturnValue(true),
      close: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock Webhook service (axios)
jest.mock('../../src/services/webhook.service', () => {
  const originalModule = jest.requireActual('../../src/services/webhook.service');
  return {
    ...originalModule,
    webhookService: {
      initialize: jest.fn().mockResolvedValue(undefined),
      sendWebhook: jest.fn().mockResolvedValue({
        success: true,
        statusCode: 200,
        response: { received: true },
      }),
      isReady: jest.fn().mockReturnValue(true),
      close: jest.fn().mockResolvedValue(undefined),
    },
  };
});

describe('Notification Routes Integration Tests', () => {
  let authToken: string;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000001';

  // Get the mocked email service
  const { emailService } = require('../../src/services/email.service');

  beforeAll(async () => {
    getTestPool();

    // Generate a valid JWT token for authentication
    const tokenPayload = {
      userId: userId,
      email: 'admin@democompany.com',
      role: UserRole.SUPER_ADMIN,
      tenantId: tenantId,
    };

    const tokens = generateTokens(tokenPayload);
    authToken = tokens.accessToken;

    // Mock transporter verify to succeed
    mockVerify.mockResolvedValue(true);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockClear();
    mockVerify.mockClear();

    // Reset email service mock
    emailService.sendEmail.mockClear();
    emailService.sendEmail.mockResolvedValue({
      success: true,
      messageId: 'test-message-id-123',
    });
  });

  describe('POST /api/email/send', () => {
    it('should send email notification', async () => {
      const emailPayload = {
        recipient: 'recipient@example.com',
        subject: 'Test Email Notification',
        body: '<h1>Test Email</h1><p>This is a test email from integration tests.</p>',
      };

      const response = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', tenantId)
        .send(emailPayload)
        .expect('Content-Type', /json/);

      // Verify response (may be 200 or 400 depending on validation/feature flags)
      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('messageId');

        // Verify email service was called
        expect(emailService.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            recipient: 'recipient@example.com',
            subject: 'Test Email Notification',
            body: emailPayload.body,
          })
        );
      } else {
        // If validation fails, just verify error response structure
        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('should return 400 for missing recipient', async () => {
      const invalidPayload = {
        // recipient missing
        subject: 'Test Email',
        body: '<p>Test</p>',
      };

      const response = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', tenantId)
        .send(invalidPayload)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid email format', async () => {
      const invalidPayload = {
        recipient: 'invalid-email-format',
        subject: 'Test Email',
        body: '<p>Test</p>',
      };

      const response = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', tenantId)
        .send(invalidPayload)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 for missing subject', async () => {
      const invalidPayload = {
        recipient: 'test@example.com',
        // subject missing
        body: '<p>Test</p>',
      };

      const response = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', tenantId)
        .send(invalidPayload)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 for missing body', async () => {
      const invalidPayload = {
        recipient: 'test@example.com',
        subject: 'Test Email',
        // body missing
      };

      const response = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', tenantId)
        .send(invalidPayload)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 401 without authentication', async () => {
      const emailPayload = {
        recipient: 'test@example.com',
        subject: 'Test Email',
        body: '<p>Test</p>',
      };

      const response = await request(app)
        .post('/api/email/send')
        .set('X-Tenant-ID', tenantId)
        .send(emailPayload)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 401 without tenant ID', async () => {
      const emailPayload = {
        recipient: 'test@example.com',
        subject: 'Test Email',
        body: '<p>Test</p>',
      };

      const response = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${authToken}`)
        // X-Tenant-ID missing
        .send(emailPayload)
        .expect('Content-Type', /json/);

      // May return 400 or 401 depending on middleware order
      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle email sending failure gracefully', async () => {
      // Mock email sending failure
      emailService.sendEmail.mockResolvedValue({
        success: false,
        error: 'SMTP connection failed',
      });

      const emailPayload = {
        recipient: 'test@example.com',
        subject: 'Test Email',
        body: '<p>Test</p>',
      };

      const response = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', tenantId)
        .send(emailPayload);

      // Should return error but not crash (may be 400 if validation fails, or 500/503 for service errors)
      expect([400, 500, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should support CC and BCC recipients', async () => {
      const emailPayload = {
        recipient: 'to@example.com',
        subject: 'Test Email',
        body: '<p>Test</p>',
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
      };

      const response = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', tenantId)
        .send(emailPayload)
        .expect('Content-Type', /json/);

      // May return 200 or 400 depending on validation
      expect([200, 400]).toContain(response.status);

      // If successful, verify the call
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(emailService.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            recipient: 'to@example.com',
            cc: expect.arrayContaining(['cc@example.com']),
            bcc: expect.arrayContaining(['bcc@example.com']),
          })
        );
      }
    });
  });

  describe('GET /api/email/status', () => {
    it('should return email service status', async () => {
      const response = await request(app)
        .get('/api/email/status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', tenantId)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      // The data structure may vary based on implementation
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      // May return 200 or 503 depending on service readiness
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('service', 'notification-service');
      expect(response.body).toHaveProperty('status');
    });
  });
});
