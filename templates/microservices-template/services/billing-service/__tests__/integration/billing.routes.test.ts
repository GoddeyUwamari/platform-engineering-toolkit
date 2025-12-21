/**
 * Billing Routes Integration Tests
 * Tests API endpoints with real database interactions
 */

// Mock Redis before imports
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
import {
  createTenant,
  createSubscriptionPlan,
  createTenantSubscription,
  createInvoice,
  createUsageRecord,
  createBillingTestData,
} from '../helpers/factories';
import { createAuthToken } from '../helpers/mocks';
import { SubscriptionStatus, BillingCycle } from '../../src/models/tenant-subscription.model';
import { InvoiceStatus } from '../../src/models/invoice.model';

describe('Billing Routes Integration Tests', () => {
  let testPool: any;
  let defaultAuthToken: string;
  let defaultTenantId: string;

  beforeAll(async () => {
    testPool = getTestPool();
    // Create a default auth token for tests that don't need specific tenant context
    defaultTenantId = '00000000-0000-0000-0000-000000000001';
    defaultAuthToken = createAuthToken({ tenantId: defaultTenantId });
  });

  // ========================================================================
  // Health Check Tests
  // ========================================================================

  describe('GET /health', () => {
    it('should return service health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('service', 'billing-service');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(['healthy', 'degraded']).toContain(response.body.status);
    });
  });

  // ========================================================================
  // Subscription Routes Tests
  // ========================================================================

  describe('Subscription Routes', () => {
    describe('GET /subscriptions/tenant/:tenantId', () => {
      it('should retrieve all subscriptions for a tenant', async () => {
        // Setup test data
        const tenant = await createTenant(testPool);
        const plan = await createSubscriptionPlan(testPool);
        const subscription = await createTenantSubscription(testPool, {
          tenantId: tenant.id,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
        });
        const authToken = createAuthToken({ tenantId: tenant.id });

        console.log('Created subscription:', subscription);
        console.log('Query params:', { tenantId: tenant.id });

        const response = await request(app)
          .get(`/subscriptions/tenant/${tenant.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        if (response.status === 500) {
          console.log('Error response:', response.body);
        }

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(subscription.id);
        expect(response.body.data[0].status).toBe(SubscriptionStatus.ACTIVE);
      });

      it('should filter subscriptions by status', async () => {
        const tenant = await createTenant(testPool);
        const plan = await createSubscriptionPlan(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        await createTenantSubscription(testPool, {
          tenantId: tenant.id,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
        });

        await createTenantSubscription(testPool, {
          tenantId: tenant.id,
          planId: plan.id,
          status: SubscriptionStatus.CANCELLED,
        });

        const response = await request(app)
          .get(`/subscriptions/tenant/${tenant.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ status: SubscriptionStatus.ACTIVE })
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].status).toBe(SubscriptionStatus.ACTIVE);
      });

      it('should return empty array when tenant has no subscriptions', async () => {
        const tenant = await createTenant(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        const response = await request(app)
          .get(`/subscriptions/tenant/${tenant.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data).toEqual([]);
        expect(response.body.count).toBe(0);
      });
    });

    describe('GET /subscriptions/:id', () => {
      it('should retrieve a subscription by ID', async () => {
        const { tenant, plan, subscription } = await createBillingTestData(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        const response = await request(app)
          .get(`/subscriptions/${subscription.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.id).toBe(subscription.id);
        expect(response.body.data.tenantId).toBe(tenant.id);
        expect(response.body.data.planId).toBe(plan.id);
      });

      it('should return 404 when subscription does not exist', async () => {
        const fakeId = '123e4567-e89b-12d3-a456-426614174999';

        const response = await request(app)
          .get(`/subscriptions/${fakeId}`)
          .set('Authorization', `Bearer ${defaultAuthToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /subscriptions', () => {
      it('should create a new subscription', async () => {
        const tenant = await createTenant(testPool);
        const plan = await createSubscriptionPlan(testPool);

        console.log('Created tenant:', tenant.id);
        console.log('Created plan:', plan.id);

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1); // Monthly billing cycle

        const subscriptionData = {
          tenantId: tenant.id,
          planId: plan.id,
          billingCycle: BillingCycle.MONTHLY,
          currentPrice: plan.priceMonthly,
          currency: 'USD',
          startedAt: startDate,
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
          autoRenew: true,
          isTrial: false,
        };

        console.log('Subscription data:', subscriptionData);

        const authToken = createAuthToken({ tenantId: tenant.id });

        const response = await request(app)
          .post('/subscriptions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(subscriptionData)
          .expect('Content-Type', /json/);

        console.log('Response status:', response.status);
        console.log('Response body:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data.tenantId).toBe(tenant.id);
        expect(response.body.data.planId).toBe(plan.id);
        expect(response.body.data.status).toBe(SubscriptionStatus.ACTIVE);
      });

      it('should return 400 for invalid subscription data', async () => {
        const response = await request(app)
          .post('/subscriptions')
          .set('Authorization', `Bearer ${defaultAuthToken}`)
          .send({ tenantId: 'invalid', planId: 'invalid' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /subscriptions/:id/cancel', () => {
      it('should cancel a subscription', async () => {
        const { tenant, subscription } = await createBillingTestData(testPool, {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
        });
        const authToken = createAuthToken({ tenantId: tenant.id });

        const response = await request(app)
          .post(`/subscriptions/${subscription.id}/cancel`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ immediately: false })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.status).toBe(SubscriptionStatus.CANCELLED);
      });
    });
  });

  // ========================================================================
  // Invoice Routes Tests
  // ========================================================================

  describe('Invoice Routes', () => {
    describe('GET /invoices/tenant/:tenantId', () => {
      it('should retrieve all invoices for a tenant', async () => {
        const { tenant, invoice } = await createBillingTestData(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        console.log('Created invoice:', invoice);
        console.log('Query params:', { tenantId: tenant.id });

        const response = await request(app)
          .get(`/invoices/tenant/${tenant.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        if (response.status === 500) {
          console.log('Error response:', response.body);
        }

        expect(response.body).toHaveProperty('success', true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0].id).toBe(invoice.id);
      });

      it('should filter invoices by status', async () => {
        const { tenant } = await createBillingTestData(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        await createInvoice(testPool, {
          tenantId: tenant.id,
          status: InvoiceStatus.OPEN,
        });

        const response = await request(app)
          .get(`/invoices/tenant/${tenant.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ status: InvoiceStatus.OPEN })
          .expect(200);

        expect(response.body.data.every((inv: any) => inv.status === InvoiceStatus.OPEN)).toBe(true);
      });

      it('should return empty array when tenant has no invoices', async () => {
        const tenant = await createTenant(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        const response = await request(app)
          .get(`/invoices/tenant/${tenant.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data).toEqual([]);
      });
    });

    describe('GET /invoices/:id', () => {
      it('should retrieve an invoice by ID', async () => {
        const { tenant, invoice } = await createBillingTestData(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        const response = await request(app)
          .get(`/invoices/${invoice.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.id).toBe(invoice.id);
        expect(response.body.data).toHaveProperty('invoiceNumber');
        expect(response.body.data).toHaveProperty('totalAmount');
      });

      it('should return 404 when invoice does not exist', async () => {
        const fakeId = '123e4567-e89b-12d3-a456-426614174999';

        const response = await request(app)
          .get(`/invoices/${fakeId}`)
          .set('Authorization', `Bearer ${defaultAuthToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /invoices', () => {
      it('should create a new invoice', async () => {
        const { tenant, subscription } = await createBillingTestData(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        const invoiceData = {
          tenantId: tenant.id,
          subscriptionId: subscription.id,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          currency: 'USD',
          notes: 'Test invoice',
        };

        const response = await request(app)
          .post('/invoices')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invoiceData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('invoiceNumber');
        expect(response.body.data.status).toBe(InvoiceStatus.DRAFT);
      });

      it('should return 400 for invalid invoice data', async () => {
        const response = await request(app)
          .post('/invoices')
          .set('Authorization', `Bearer ${defaultAuthToken}`)
          .send({ tenantId: 'invalid' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /invoices/:id/finalize', () => {
      it('should finalize a draft invoice', async () => {
        const { tenant, invoice } = await createBillingTestData(testPool, {
          invoiceStatus: InvoiceStatus.DRAFT,
        });
        const authToken = createAuthToken({ tenantId: tenant.id });

        console.log('Created invoice for finalize:', invoice);
        console.log('Request URL:', `/invoices/${invoice.id}/finalize`);

        const response = await request(app)
          .post(`/invoices/${invoice.id}/finalize`)
          .set('Authorization', `Bearer ${authToken}`);

        console.log('Response status:', response.status);
        console.log('Response body:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.status).toBe(InvoiceStatus.OPEN);
      });
    });

    describe('POST /invoices/:id/payment', () => {
      it('should mark invoice as paid', async () => {
        const { tenant, invoice } = await createBillingTestData(testPool, {
          invoiceStatus: InvoiceStatus.OPEN,
        });
        const authToken = createAuthToken({ tenantId: tenant.id });

        console.log('Created invoice for payment:', invoice);
        console.log('Invoice totalAmount:', invoice.totalAmount, 'type:', typeof invoice.totalAmount);

        // Convert string to number if needed
        const paymentAmount = typeof invoice.totalAmount === 'string'
          ? parseFloat(invoice.totalAmount)
          : invoice.totalAmount;

        const paymentData = {
          paymentMethod: 'stripe',
          paymentReference: 'ch_123456',
          paymentAmount,
        };

        console.log('Payment data:', paymentData);

        const response = await request(app)
          .post(`/invoices/${invoice.id}/payment`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(paymentData);

        console.log('Response status:', response.status);
        console.log('Response body:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.status).toBe(InvoiceStatus.PAID);
      });
    });
  });

  // ========================================================================
  // Usage Routes Tests
  // ========================================================================

  describe('Usage Routes', () => {
    describe('GET /usage/health', () => {
      it('should return usage API health status', async () => {
        const response = await request(app)
          .get('/usage/health')
          .set('Authorization', `Bearer ${defaultAuthToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('status', 'healthy');
      });
    });

    describe('POST /usage', () => {
      it('should record a new usage event', async () => {
        const { tenant, subscription } = await createBillingTestData(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        const usageData = {
          tenantId: tenant.id,
          subscriptionId: subscription.id,
          usageType: 'api_calls',
          quantity: 100,
          unit: 'requests',
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
          metadata: { source: 'test' },
        };

        const response = await request(app)
          .post('/usage')
          .set('Authorization', `Bearer ${authToken}`)
          .send(usageData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('usageRecord');
        expect(response.body.data.usageRecord).toHaveProperty('id');
        expect(response.body.data.usageRecord.usageType).toBe('api_calls');
        expect(response.body.data.usageRecord.quantity).toBe(100);
      });

      it('should return 401 for missing auth token', async () => {
        const response = await request(app)
          .post('/usage')
          .send({ usageType: 'api_calls', quantity: 100, unit: 'requests' })
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should return 400 for invalid usage data', async () => {
        const { tenant } = await createBillingTestData(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        const response = await request(app)
          .post('/usage')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ tenantId: 'invalid' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('GET /usage', () => {
      it('should retrieve usage records with pagination', async () => {
        const { tenant, subscription } = await createBillingTestData(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        const usageRecord = await createUsageRecord(testPool, {
          tenantId: tenant.id,
          subscriptionId: subscription.id,
          usageType: 'api_calls',
          quantity: 100,
        });

        console.log('Created usage record:', usageRecord);
        console.log('Query params:', { tenantId: tenant.id, page: 1, limit: 10 });

        const response = await request(app)
          .get('/usage')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ tenantId: tenant.id, page: 1, limit: 10 })
          .expect(200);

        if (response.status === 500) {
          console.log('Error response:', response.body);
        }

        console.log('Response body structure:', JSON.stringify(response.body, null, 2));

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      });
    });

    describe('GET /usage/summary', () => {
      it('should retrieve usage summary', async () => {
        const { tenant, subscription } = await createBillingTestData(testPool);
        const authToken = createAuthToken({ tenantId: tenant.id });

        await createUsageRecord(testPool, {
          tenantId: tenant.id,
          subscriptionId: subscription.id,
          usageType: 'api_calls',
          quantity: 500,
        });

        const response = await request(app)
          .get('/usage/summary')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ tenantId: tenant.id })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      });
    });
  });
});
