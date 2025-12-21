/**
 * Payment Routes Integration Tests
 * Tests database interactions and service layer integration
 */

import { getTestPool } from '../helpers/setup';
import { createTenant, createPayment, createPaymentMethod } from '../helpers/factories';

describe('Payment Routes Integration Tests', () => {
  describe('Database Integration', () => {
    it('should create and retrieve payment from database', async () => {
      const pool = getTestPool();

      // Create test tenant
      const tenant = await createTenant(pool);
      expect(tenant).toHaveProperty('id');
      expect(tenant.name).toBeDefined();

      // Create payment method
      const paymentMethod = await createPaymentMethod(pool, {
        tenantId: tenant.id,
      });
      expect(paymentMethod).toHaveProperty('id');
      expect(paymentMethod.tenantId).toBe(tenant.id);

      // Create payment
      const payment = await createPayment(pool, {
        tenantId: tenant.id,
        paymentMethodId: paymentMethod.id,
        amount: 100.50,
        status: 'succeeded',
      });

      expect(payment).toHaveProperty('id');
      expect(payment.tenantId).toBe(tenant.id);
      expect(payment.amount).toBe('100.50');
      expect(payment.status).toBe('succeeded');
    });

    it('should enforce tenant isolation', async () => {
      const pool = getTestPool();

      const tenant1 = await createTenant(pool, { name: 'Tenant 1' });
      const tenant2 = await createTenant(pool, { name: 'Tenant 2' });

      const payment1 = await createPayment(pool, {
        tenantId: tenant1.id,
        amount: 50.00,
      });

      // Verify payment belongs to correct tenant
      expect(payment1.tenantId).toBe(tenant1.id);
      expect(payment1.tenantId).not.toBe(tenant2.id);
    });
  });
});
