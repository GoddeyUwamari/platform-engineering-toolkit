/**
 * Subscription Routes
 * RESTful API endpoints for subscription management
 *
 * Base path: /api/billing/subscriptions
 */

import { Router, Request, Response, NextFunction } from 'express';
import subscriptionService from '../services/subscription.service';
import { logger } from '@shared/utils/logger';
import { 
  NotFoundError, 
  ValidationError,
} from '@shared/middleware/error-handler';
import { 
  SubscriptionStatus,
  BillingCycle,
  TenantSubscriptionFilters,
  CreateTenantSubscriptionDTO,
  UpdateTenantSubscriptionDTO,
} from '../models/tenant-subscription.model';

const router = Router();

// ============================================================================
// QUERY ROUTES
// ============================================================================

/**
 * GET /api/billing/subscriptions
 * Get all subscriptions for the authenticated tenant with optional filters
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get tenantId from tenant middleware (set by resolveTenant())
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID not found in request context');
      }

      // Parse query filters
      const filters: TenantSubscriptionFilters = {};

      if (req.query.status) {
        filters.status = req.query.status as SubscriptionStatus;
      }

      if (req.query.planId) {
        filters.planId = req.query.planId as string;
      }

      if (req.query.billingCycle) {
        filters.billingCycle = req.query.billingCycle as BillingCycle;
      }

      if (req.query.isTrial === 'true') {
        filters.isTrial = true;
      }

      if (req.query.isActive === 'true') {
        filters.isActive = true;
      }

      // Parse limit and offset for pagination
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

      let subscriptions = await subscriptionService.getSubscriptionsByTenant(tenantId, filters);

      // Apply pagination if specified
      if (offset !== undefined) {
        subscriptions = subscriptions.slice(offset);
      }
      if (limit !== undefined) {
        subscriptions = subscriptions.slice(0, limit);
      }

      logger.info('Retrieved subscriptions for authenticated tenant', {
        tenantId,
        count: subscriptions.length,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: subscriptions,
        count: subscriptions.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/billing/subscriptions/tenant/:tenantId
 * Get all subscriptions for a tenant with optional filters
 */
router.get(
  '/tenant/:tenantId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params;
      
      if (!tenantId) {
        throw new ValidationError('tenantId is required');
      }
      
      // Parse query filters
      const filters: TenantSubscriptionFilters = {};
      
      if (req.query.status) {
        filters.status = req.query.status as SubscriptionStatus;
      }
      
      if (req.query.planId) {
        filters.planId = req.query.planId as string;
      }
      
      if (req.query.billingCycle) {
        filters.billingCycle = req.query.billingCycle as BillingCycle;
      }
      
      if (req.query.isTrial === 'true') {
        filters.isTrial = true;
      }
      
      if (req.query.isActive === 'true') {
        filters.isActive = true;
      }

      const subscriptions = await subscriptionService.getSubscriptionsByTenant(tenantId, filters);

      logger.info('Retrieved subscriptions for tenant', {
        tenantId,
        count: subscriptions.length,
      });

      res.json({
        success: true,
        data: subscriptions,
        count: subscriptions.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/subscriptions/:id
 * Get subscription by ID
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      
      const subscription = await subscriptionService.getSubscriptionById(id);

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/subscriptions/:id/with-plan
 * Get subscription with plan details
 */
router.get(
  '/:id/with-plan',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      
      const subscriptionWithPlan = await subscriptionService.getSubscriptionWithPlan(id);

      res.json({
        success: true,
        data: subscriptionWithPlan,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/subscriptions/tenant/:tenantId/active
 * Get active subscription for tenant
 */
router.get(
  '/tenant/:tenantId/active',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params;
      
      if (!tenantId) {
        throw new ValidationError('tenantId is required');
      }
      
      const subscription = await subscriptionService.getActiveSubscription(tenantId);

      if (!subscription) {
        throw new NotFoundError('Active subscription');
      }

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/subscriptions/expiring
 * Get expiring subscriptions (within specified days)
 */
router.get(
  '/expiring',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      
      const subscriptions = await subscriptionService.getExpiringSubscriptions(days);

      res.json({
        success: true,
        data: subscriptions,
        count: subscriptions.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// CREATE ROUTES
// ============================================================================

/**
 * POST /api/v1/subscriptions
 * Create a new subscription
 */
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscriptionData: CreateTenantSubscriptionDTO = req.body;

      // UUID validation regex
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Validate required fields
      if (!subscriptionData.tenantId) {
        throw new ValidationError('tenantId is required');
      }

      // Validate tenantId format
      if (!uuidRegex.test(subscriptionData.tenantId)) {
        throw new ValidationError('tenantId must be a valid UUID');
      }

      if (!subscriptionData.planId) {
        throw new ValidationError('planId is required');
      }

      // Validate planId format
      if (!uuidRegex.test(subscriptionData.planId)) {
        throw new ValidationError('planId must be a valid UUID');
      }

      if (!subscriptionData.billingCycle) {
        throw new ValidationError('billingCycle is required');
      }

      if (!subscriptionData.currentPrice && subscriptionData.currentPrice !== 0) {
        throw new ValidationError('currentPrice is required');
      }

      if (!subscriptionData.currentPeriodEnd) {
        throw new ValidationError('currentPeriodEnd is required');
      }

      const subscription = await subscriptionService.createSubscription(subscriptionData);

      logger.info('Created subscription via API', {
        subscriptionId: subscription.id,
        tenantId: subscriptionData.tenantId,
        planId: subscriptionData.planId,
      });

      res.status(201).json({
        success: true,
        data: subscription,
        message: 'Subscription created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// UPDATE ROUTES
// ============================================================================

/**
 * PATCH /api/v1/subscriptions/:id
 * Update subscription details
 */
router.patch(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      
      const updateData: UpdateTenantSubscriptionDTO = req.body;

      const subscription = await subscriptionService.updateSubscription(id, updateData);

      logger.info('Updated subscription via API', {
        subscriptionId: id,
      });

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/subscriptions/:id/change-plan
 * Change subscription plan
 */
router.post(
  '/:id/change-plan',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      
      const { newPlanId } = req.body;

      if (!newPlanId) {
        throw new ValidationError('newPlanId is required');
      }

      const subscription = await subscriptionService.changePlan(id, newPlanId);

      logger.info('Changed subscription plan via API', {
        subscriptionId: id,
        newPlanId,
      });

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription plan changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// LIFECYCLE ROUTES
// ============================================================================

/**
 * POST /api/v1/subscriptions/:id/cancel
 * Cancel a subscription
 */
router.post(
  '/:id/cancel',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      
      const { immediately } = req.body;

      const subscription = await subscriptionService.cancelSubscription(id, immediately || false);

      logger.info('Canceled subscription via API', {
        subscriptionId: id,
        immediately,
      });

      res.json({
        success: true,
        data: subscription,
        message: immediately 
          ? 'Subscription canceled immediately' 
          : 'Subscription will be canceled at period end',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/subscriptions/:id/renew
 * Renew a subscription for another period
 */
router.post(
  '/:id/renew',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      
      const subscription = await subscriptionService.renewSubscription(id);

      logger.info('Renewed subscription via API', {
        subscriptionId: id,
      });

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription renewed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/subscriptions/:id/suspend
 * Suspend a subscription
 */
router.post(
  '/:id/suspend',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      
      const subscription = await subscriptionService.suspendSubscription(id);

      logger.info('Suspended subscription via API', {
        subscriptionId: id,
      });

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription suspended successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/subscriptions/:id/reactivate
 * Reactivate a suspended subscription
 */
router.post(
  '/:id/reactivate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      
      const subscription = await subscriptionService.reactivateSubscription(id);

      logger.info('Reactivated subscription via API', {
        subscriptionId: id,
      });

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription reactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;