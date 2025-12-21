import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ApiResponse } from '@shared/types';
import {
  ValidationError,
  NotFoundError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import subscriptionService from '../services/subscription.service';
import {
  CreateTenantSubscriptionDTO,
  UpdateTenantSubscriptionDTO,
  TenantSubscriptionFilters,
  SubscriptionStatus,
  BillingCycle,
} from '../models/tenant-subscription.model';
// Import express type augmentation
import '../types/express-augmentation';

/**
 * Subscription Controller
 * Handles HTTP requests for subscription endpoints
 */

export class SubscriptionController {
  /**
   * Create a new subscription
   * POST /api/billing/subscriptions
   */
  public static createSubscription = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const {
        planId,
        billingCycle,
        currentPrice,
        currency,
        startedAt,
        currentPeriodStart,
        currentPeriodEnd,
        autoRenew,
        isTrial,
        trialEndsAt,
      } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      // Validate authentication
      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      // Validate required fields
      if (!planId || !billingCycle || currentPrice === undefined || !currentPeriodEnd) {
        throw new ValidationError('Missing required fields', {
          planId: !planId ? 'Plan ID is required' : undefined,
          billingCycle: !billingCycle ? 'Billing cycle is required' : undefined,
          currentPrice: currentPrice === undefined ? 'Current price is required' : undefined,
          currentPeriodEnd: !currentPeriodEnd ? 'Current period end is required' : undefined,
        });
      }

      // Validate billing cycle
      if (!Object.values(BillingCycle).includes(billingCycle)) {
        throw new ValidationError('Invalid billing cycle');
      }

      // Validate price
      if (currentPrice < 0) {
        throw new ValidationError('Price must be non-negative');
      }

      // Create subscription DTO
      const subscriptionData: CreateTenantSubscriptionDTO = {
        tenantId,
        planId,
        billingCycle,
        currentPrice,
        currency,
        startedAt,
        currentPeriodStart,
        currentPeriodEnd,
        autoRenew,
        isTrial,
        trialEndsAt,
      };

      // Create subscription
      const subscription = await subscriptionService.createSubscription(subscriptionData);

      const response: ApiResponse = {
        success: true,
        data: { subscription },
        message: 'Subscription created successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Subscription created', {
        subscriptionId: subscription.id,
        tenantId,
        userId,
      });

      res.status(201).json(response);
    }
  );

  /**
   * Get subscriptions for the tenant
   * GET /api/billing/subscriptions
   */
  public static getSubscriptions = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      // Parse filters from query
      const filters: TenantSubscriptionFilters = {
        status: req.query.status as SubscriptionStatus,
        planId: req.query.planId as string,
        billingCycle: req.query.billingCycle as BillingCycle,
        isTrial: req.query.isTrial ? req.query.isTrial === 'true' : undefined,
        isActive: req.query.isActive === 'true',
      };

      // Get subscriptions
      const subscriptions = await subscriptionService.getSubscriptionsByTenant(
        tenantId,
        filters
      );

      const response: ApiResponse = {
        success: true,
        data: {
          subscriptions,
          count: subscriptions.length,
        },
        timestamp: new Date().toISOString(),
      };

      logger.info('Subscriptions retrieved', {
        tenantId,
        count: subscriptions.length,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get a specific subscription by ID
   * GET /api/billing/subscriptions/:id
   */
  public static getSubscriptionById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Subscription ID is required');
      }

      // Get subscription
      const subscription = await subscriptionService.getSubscriptionById(id);

      // Verify tenant ownership
      if (subscription.tenantId !== tenantId) {
        throw new NotFoundError('Subscription');
      }

      const response: ApiResponse = {
        success: true,
        data: { subscription },
        timestamp: new Date().toISOString(),
      };

      logger.info('Subscription retrieved', {
        subscriptionId: id,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get subscription with plan details
   * GET /api/billing/subscriptions/:id/plan
   */
  public static getSubscriptionWithPlan = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Subscription ID is required');
      }

      // Get subscription with plan
      const subscription = await subscriptionService.getSubscriptionWithPlan(id);

      // Verify tenant ownership
      if (subscription.tenantId !== tenantId) {
        throw new NotFoundError('Subscription');
      }

      const response: ApiResponse = {
        success: true,
        data: { subscription },
        timestamp: new Date().toISOString(),
      };

      logger.info('Subscription with plan retrieved', {
        subscriptionId: id,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get active subscription for the tenant
   * GET /api/billing/subscriptions/active
   */
  public static getActiveSubscription = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      // Get active subscription
      const subscription = await subscriptionService.getActiveSubscription(tenantId);

      if (!subscription) {
        const response: ApiResponse = {
          success: true,
          data: { subscription: null },
          message: 'No active subscription found',
          timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { subscription },
        timestamp: new Date().toISOString(),
      };

      logger.info('Active subscription retrieved', {
        subscriptionId: subscription.id,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Update a subscription
   * PATCH /api/billing/subscriptions/:id
   */
  public static updateSubscription = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updates = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Subscription ID is required');
      }

      // Get subscription to verify ownership
      const existingSubscription = await subscriptionService.getSubscriptionById(id);
      if (existingSubscription.tenantId !== tenantId) {
        throw new NotFoundError('Subscription');
      }

      // Validate at least one field to update
      if (Object.keys(updates).length === 0) {
        throw new ValidationError('At least one field is required to update');
      }

      // Create update DTO
      const updateData: UpdateTenantSubscriptionDTO = {};

      if (updates.status !== undefined) {
        if (!Object.values(SubscriptionStatus).includes(updates.status)) {
          throw new ValidationError('Invalid subscription status');
        }
        updateData.status = updates.status;
      }

      if (updates.currentPrice !== undefined) {
        if (updates.currentPrice < 0) {
          throw new ValidationError('Price must be non-negative');
        }
        updateData.currentPrice = updates.currentPrice;
      }

      if (updates.currentPeriodStart !== undefined) {
        updateData.currentPeriodStart = updates.currentPeriodStart;
      }

      if (updates.currentPeriodEnd !== undefined) {
        updateData.currentPeriodEnd = updates.currentPeriodEnd;
      }

      if (updates.autoRenew !== undefined) {
        updateData.autoRenew = updates.autoRenew;
      }

      // Update subscription
      const subscription = await subscriptionService.updateSubscription(id, updateData);

      const response: ApiResponse = {
        success: true,
        data: { subscription },
        message: 'Subscription updated successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Subscription updated', {
        subscriptionId: id,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Change subscription plan
   * POST /api/billing/subscriptions/:id/change-plan
   */
  public static changePlan = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { planId } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Subscription ID is required');
      }

      if (!planId) {
        throw new ValidationError('Plan ID is required');
      }

      // Get subscription to verify ownership
      const existingSubscription = await subscriptionService.getSubscriptionById(id);
      if (existingSubscription.tenantId !== tenantId) {
        throw new NotFoundError('Subscription');
      }

      // Change plan
      const subscription = await subscriptionService.changePlan(id, planId);

      const response: ApiResponse = {
        success: true,
        data: { subscription },
        message: 'Subscription plan changed successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Subscription plan changed', {
        subscriptionId: id,
        newPlanId: planId,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Cancel a subscription
   * POST /api/billing/subscriptions/:id/cancel
   */
  public static cancelSubscription = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { immediately } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Subscription ID is required');
      }

      // Get subscription to verify ownership
      const existingSubscription = await subscriptionService.getSubscriptionById(id);
      if (existingSubscription.tenantId !== tenantId) {
        throw new NotFoundError('Subscription');
      }

      // Cancel subscription
      const subscription = await subscriptionService.cancelSubscription(
        id,
        immediately === true
      );

      const response: ApiResponse = {
        success: true,
        data: { subscription },
        message: immediately
          ? 'Subscription cancelled immediately'
          : 'Subscription will be cancelled at period end',
        timestamp: new Date().toISOString(),
      };

      logger.info('Subscription cancelled', {
        subscriptionId: id,
        immediately,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Renew a subscription
   * POST /api/billing/subscriptions/:id/renew
   */
  public static renewSubscription = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Subscription ID is required');
      }

      // Get subscription to verify ownership
      const existingSubscription = await subscriptionService.getSubscriptionById(id);
      if (existingSubscription.tenantId !== tenantId) {
        throw new NotFoundError('Subscription');
      }

      // Renew subscription
      const subscription = await subscriptionService.renewSubscription(id);

      const response: ApiResponse = {
        success: true,
        data: { subscription },
        message: 'Subscription renewed successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Subscription renewed', {
        subscriptionId: id,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Suspend a subscription
   * POST /api/billing/subscriptions/:id/suspend
   */
  public static suspendSubscription = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Subscription ID is required');
      }

      // Get subscription to verify ownership
      const existingSubscription = await subscriptionService.getSubscriptionById(id);
      if (existingSubscription.tenantId !== tenantId) {
        throw new NotFoundError('Subscription');
      }

      // Suspend subscription
      const subscription = await subscriptionService.suspendSubscription(id);

      const response: ApiResponse = {
        success: true,
        data: { subscription },
        message: 'Subscription suspended successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Subscription suspended', {
        subscriptionId: id,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Reactivate a subscription
   * POST /api/billing/subscriptions/:id/reactivate
   */
  public static reactivateSubscription = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Subscription ID is required');
      }

      // Get subscription to verify ownership
      const existingSubscription = await subscriptionService.getSubscriptionById(id);
      if (existingSubscription.tenantId !== tenantId) {
        throw new NotFoundError('Subscription');
      }

      // Reactivate subscription
      const subscription = await subscriptionService.reactivateSubscription(id);

      const response: ApiResponse = {
        success: true,
        data: { subscription },
        message: 'Subscription reactivated successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Subscription reactivated', {
        subscriptionId: id,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get expiring subscriptions (admin only)
   * GET /api/billing/subscriptions/expiring
   */
  public static getExpiringSubscriptions = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      // This could be restricted to admin users
      // For now, we'll allow all authenticated users

      const days = parseInt(req.query.days as string) || 7;

      if (days < 1 || days > 90) {
        throw new ValidationError('Days must be between 1 and 90');
      }

      // Get expiring subscriptions
      const subscriptions = await subscriptionService.getExpiringSubscriptions(days);

      // Filter to only show subscriptions for the current tenant (unless admin)
      const filteredSubscriptions = subscriptions.filter(
        (sub) => sub.tenantId === tenantId
      );

      const response: ApiResponse = {
        success: true,
        data: {
          subscriptions: filteredSubscriptions,
          count: filteredSubscriptions.length,
          days,
        },
        timestamp: new Date().toISOString(),
      };

      logger.info('Expiring subscriptions retrieved', {
        tenantId,
        count: filteredSubscriptions.length,
        days,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Health check endpoint
   * GET /api/billing/subscriptions/health
   */
  public static healthCheck = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const response: ApiResponse = {
        success: true,
        data: {
          service: 'billing-service',
          endpoint: 'subscriptions',
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );
}
