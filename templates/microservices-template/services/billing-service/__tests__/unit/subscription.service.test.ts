/**
 * Subscription Service Unit Tests
 * Tests business logic for subscription operations
 */

import { SubscriptionStatus, BillingCycle } from '../../src/models/tenant-subscription.model';
import { NotFoundError, BusinessRuleError } from '@shared/middleware/error-handler';

// Mock dependencies
jest.mock('@shared/database/connection');
jest.mock('@shared/utils/logger');

// Import after mocks
import * as dbConnection from '@shared/database/connection';
import SubscriptionServiceModule from '../../src/services/subscription.service';

// Type the exports
const SubscriptionService = SubscriptionServiceModule;

describe('Subscription Service', () => {
  const mockQuery = dbConnection.query as jest.MockedFunction<typeof dbConnection.query>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSubscriptionById', () => {
    const subscriptionId = '123e4567-e89b-12d3-a456-426614174003';
    const mockSubscription = {
      id: subscriptionId,
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      planId: '123e4567-e89b-12d3-a456-426614174002',
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      currentPrice: 49.99,
      currency: 'USD',
      startedAt: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: true,
      isTrial: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should retrieve subscription by ID successfully', async () => {
      mockQuery.mockResolvedValue([mockSubscription]);

      const result = await SubscriptionService.getSubscriptionById(subscriptionId);

      expect(result).toEqual(mockSubscription);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM tenant_subscriptions'),
        [subscriptionId]
      );
    });

    it('should throw NotFoundError when subscription does not exist', async () => {
      mockQuery.mockResolvedValue([]);

      await expect(SubscriptionService.getSubscriptionById(subscriptionId))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw error when database query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(SubscriptionService.getSubscriptionById(subscriptionId))
        .rejects.toThrow();
    });
  });

  describe('getSubscriptionsByTenant', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174001';
    const mockSubscriptions = [
      {
        id: '123e4567-e89b-12d3-a456-426614174003',
        tenantId,
        planId: '123e4567-e89b-12d3-a456-426614174002',
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        currentPrice: 49.99,
        createdAt: new Date().toISOString(),
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174004',
        tenantId,
        planId: '123e4567-e89b-12d3-a456-426614174002',
        status: SubscriptionStatus.CANCELLED,
        billingCycle: BillingCycle.YEARLY,
        currentPrice: 499.99,
        createdAt: new Date().toISOString(),
      },
    ];

    it('should retrieve all subscriptions for tenant', async () => {
      mockQuery.mockResolvedValue(mockSubscriptions);

      const result = await SubscriptionService.getSubscriptionsByTenant(tenantId);

      expect(result).toEqual(mockSubscriptions);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        [tenantId]
      );
    });

    it('should filter subscriptions by status', async () => {
      mockQuery.mockResolvedValue([mockSubscriptions[0]]);

      const result = await SubscriptionService.getSubscriptionsByTenant(tenantId, {
        status: SubscriptionStatus.ACTIVE,
      });

      expect(result).toHaveLength(1);
      expect(result?.[0]?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $2'),
        [tenantId, SubscriptionStatus.ACTIVE]
      );
    });

    it('should filter subscriptions by billing cycle', async () => {
      mockQuery.mockResolvedValue([mockSubscriptions[0]]);

      const result = await SubscriptionService.getSubscriptionsByTenant(tenantId, {
        billingCycle: BillingCycle.MONTHLY,
      });

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND billing_cycle'),
        expect.arrayContaining([tenantId, BillingCycle.MONTHLY])
      );
    });

    it('should return empty array when no subscriptions found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await SubscriptionService.getSubscriptionsByTenant(tenantId);

      expect(result).toEqual([]);
    });
  });

  describe('createSubscription', () => {
    const validCreateData = {
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      planId: '123e4567-e89b-12d3-a456-426614174002',
      billingCycle: BillingCycle.MONTHLY,
      currentPrice: 49.99,
      currency: 'USD',
      startedAt: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      isTrial: false,
    };

    const mockCreatedSubscription = {
      id: '123e4567-e89b-12d3-a456-426614174003',
      ...validCreateData,
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should create subscription successfully', async () => {
      // Mock getActiveSubscription to return null (no existing active subscription)
      jest.spyOn(SubscriptionService, 'getActiveSubscription').mockResolvedValue(null);
      mockQuery.mockResolvedValue([mockCreatedSubscription]);

      const result = await SubscriptionService.createSubscription(validCreateData);

      expect(result).toEqual(mockCreatedSubscription);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenant_subscriptions'),
        expect.any(Array)
      );
    });

    it('should create trial subscription with trial end date', async () => {
      const trialData = {
        ...validCreateData,
        isTrial: true,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      };

      // Mock getActiveSubscription to return null (no existing active subscription)
      jest.spyOn(SubscriptionService, 'getActiveSubscription').mockResolvedValue(null);
      mockQuery.mockResolvedValue([{ ...mockCreatedSubscription, isTrial: true }]);

      const result = await SubscriptionService.createSubscription(trialData);

      expect(result.isTrial).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should throw error when database insertion fails', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(SubscriptionService.createSubscription(validCreateData))
        .rejects.toThrow();
    });
  });

  describe('updateSubscription', () => {
    const subscriptionId = '123e4567-e89b-12d3-a456-426614174003';
    const updateData = {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date(),
    };

    const mockUpdatedSubscription = {
      id: subscriptionId,
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: updateData.cancelledAt.toISOString(),
    };

    it('should update subscription successfully', async () => {
      mockQuery.mockResolvedValue([mockUpdatedSubscription]);

      const result = await SubscriptionService.updateSubscription(subscriptionId, updateData);

      expect(result).toEqual(mockUpdatedSubscription);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tenant_subscriptions'),
        expect.any(Array)
      );
    });

    it('should throw NotFoundError when subscription does not exist', async () => {
      mockQuery.mockResolvedValue([]);

      await expect(SubscriptionService.updateSubscription(subscriptionId, updateData))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('cancelSubscription', () => {
    const subscriptionId = '123e4567-e89b-12d3-a456-426614174003';
    const mockActiveSubscription = {
      id: subscriptionId,
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      planId: '123e4567-e89b-12d3-a456-426614174002',
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      currentPrice: 49.99,
      currency: 'USD',
      startedAt: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: true,
      isTrial: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should cancel subscription successfully', async () => {
      mockQuery
        .mockResolvedValueOnce([mockActiveSubscription]) // getById in cancelSubscription
        .mockResolvedValueOnce([mockActiveSubscription]) // getById in updateSubscription
        .mockResolvedValueOnce([{
          ...mockActiveSubscription,
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]); // UPDATE query in updateSubscription

      const result = await SubscriptionService.cancelSubscription(subscriptionId, false);

      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundError when subscription does not exist', async () => {
      mockQuery.mockResolvedValue([]);

      await expect(SubscriptionService.cancelSubscription(subscriptionId, false))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when cancelling already cancelled subscription', async () => {
      const cancelledSubscription = {
        ...mockActiveSubscription,
        status: SubscriptionStatus.CANCELLED,
      };
      mockQuery.mockResolvedValue([cancelledSubscription]);

      await expect(SubscriptionService.cancelSubscription(subscriptionId, false))
        .rejects.toThrow(BusinessRuleError);
    });

    it('should cancel immediately when immediate flag is true', async () => {
      mockQuery
        .mockResolvedValueOnce([mockActiveSubscription]) // getById in cancelSubscription
        .mockResolvedValueOnce([mockActiveSubscription]) // getById in updateSubscription
        .mockResolvedValueOnce([{
          ...mockActiveSubscription,
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]); // UPDATE query in updateSubscription

      const result = await SubscriptionService.cancelSubscription(subscriptionId, true);

      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
    });
  });

  describe('reactivateSubscription', () => {
    const subscriptionId = '123e4567-e89b-12d3-a456-426614174003';
    const mockCancelledSubscription = {
      id: subscriptionId,
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      planId: '123e4567-e89b-12d3-a456-426614174002',
      status: SubscriptionStatus.CANCELLED,
      billingCycle: BillingCycle.MONTHLY,
      currentPrice: 49.99,
      currency: 'USD',
      startedAt: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: true,
      isTrial: false,
      cancelledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should reactivate cancelled subscription successfully', async () => {
      mockQuery
        .mockResolvedValueOnce([mockCancelledSubscription]) // getById in reactivateSubscription
        .mockResolvedValueOnce([mockCancelledSubscription]) // getById in updateSubscription
        .mockResolvedValueOnce([{
          ...mockCancelledSubscription,
          status: SubscriptionStatus.ACTIVE,
          cancelledAt: null,
          updatedAt: new Date().toISOString()
        }]); // UPDATE query in updateSubscription

      const result = await SubscriptionService.reactivateSubscription(subscriptionId);

      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundError when subscription does not exist', async () => {
      mockQuery.mockResolvedValue([]);

      await expect(SubscriptionService.reactivateSubscription(subscriptionId))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when reactivating active subscription', async () => {
      const activeSubscription = {
        ...mockCancelledSubscription,
        status: SubscriptionStatus.ACTIVE,
      };
      mockQuery.mockResolvedValue([activeSubscription]);

      await expect(SubscriptionService.reactivateSubscription(subscriptionId))
        .rejects.toThrow(BusinessRuleError);
    });
  });
});
