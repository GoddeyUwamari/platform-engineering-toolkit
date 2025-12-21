/**
 * Subscription Service
 * Business logic for tenant subscription management
 */

import { query } from '@shared/database/connection';
import { logger } from '@shared/utils/logger';
import { NotFoundError, ConflictError, BusinessRuleError } from '@shared/middleware/error-handler';
import {
  TenantSubscription,
  CreateTenantSubscriptionDTO,
  UpdateTenantSubscriptionDTO,
  TenantSubscriptionFilters,
  SubscriptionStatus,
  BillingCycle,
  TENANT_SUBSCRIPTION_COLUMNS,
  calculateNextPeriodEnd,
} from '../models/tenant-subscription.model';
import { SubscriptionPlan, SUBSCRIPTION_PLAN_COLUMNS } from '../models/subscription-plan.model';

// ============================================================================
// Subscription Service Class
// ============================================================================

class SubscriptionService {
  
  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /**
   * Get all subscriptions for a tenant with filters
   */
  async getSubscriptionsByTenant(
    tenantId: string,
    filters: TenantSubscriptionFilters = {}
  ): Promise<TenantSubscription[]> {
    try {
      let queryText = `
        SELECT ${TENANT_SUBSCRIPTION_COLUMNS}
        FROM tenant_subscriptions
        WHERE tenant_id = $1
      `;
      const params: any[] = [tenantId];
      let paramIndex = 2;

      // Apply filters
      if (filters.status) {
        queryText += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.planId) {
        queryText += ` AND plan_id = $${paramIndex}`;
        params.push(filters.planId);
        paramIndex++;
      }

      if (filters.billingCycle) {
        queryText += ` AND billing_cycle = $${paramIndex}`;
        params.push(filters.billingCycle);
        paramIndex++;
      }

      if (filters.isTrial !== undefined) {
        queryText += ` AND is_trial = $${paramIndex}`;
        params.push(filters.isTrial);
        paramIndex++;
      }

      if (filters.isActive) {
        queryText += ` AND status = 'active'`;
      }

      queryText += ` ORDER BY created_at DESC`;

      const result = await query<TenantSubscription>(queryText, params);
      return result;
    } catch (error) {
      logger.error('Error fetching subscriptions by tenant', { tenantId, error });
      throw error;
    }
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(id: string): Promise<TenantSubscription> {
    try {
      const queryText = `
        SELECT ${TENANT_SUBSCRIPTION_COLUMNS}
        FROM tenant_subscriptions
        WHERE id = $1
      `;

      const result = await query<TenantSubscription>(queryText, [id]);

      if (result.length === 0) {
        throw new NotFoundError('Subscription');
      }

      return result[0]!;
    } catch (error) {
      logger.error('Error fetching subscription by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get subscription with plan details
   */
  async getSubscriptionWithPlan(id: string): Promise<TenantSubscription & { plan: SubscriptionPlan }> {
    try {
      const queryText = `
        SELECT 
          ${TENANT_SUBSCRIPTION_COLUMNS.split('\n').map(line => 'ts.' + line.trim()).join(',\n')},
          ${SUBSCRIPTION_PLAN_COLUMNS.split('\n').map(line => 'sp.' + line.trim()).join(',\n')}
        FROM tenant_subscriptions ts
        INNER JOIN subscription_plans sp ON ts.plan_id = sp.id
        WHERE ts.id = $1
      `;

      const result = await query(queryText, [id]);

      if (result.length === 0) {
        throw new NotFoundError('Subscription');
      }

      return result[0];
    } catch (error) {
      logger.error('Error fetching subscription with plan', { id, error });
      throw error;
    }
  }

  /**
   * Get active subscription for tenant
   */
  async getActiveSubscription(tenantId: string): Promise<TenantSubscription | null> {
    try {
      const queryText = `
        SELECT ${TENANT_SUBSCRIPTION_COLUMNS}
        FROM tenant_subscriptions
        WHERE tenant_id = $1
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await query<TenantSubscription>(queryText, [tenantId]);
      return result[0] || null;
    } catch (error) {
      logger.error('Error fetching active subscription', { tenantId, error });
      throw error;
    }
  }

  /**
   * Get subscriptions expiring within X days
   */
  async getExpiringSubscriptions(days: number = 7): Promise<TenantSubscription[]> {
    try {
      const queryText = `
        SELECT ${TENANT_SUBSCRIPTION_COLUMNS}
        FROM tenant_subscriptions
        WHERE status = 'active'
          AND auto_renew = false
          AND current_period_end <= NOW() + INTERVAL '${days} days'
          AND current_period_end > NOW()
        ORDER BY current_period_end ASC
      `;

      const result = await query<TenantSubscription>(queryText);
      return result;
    } catch (error) {
      logger.error('Error fetching expiring subscriptions', { days, error });
      throw error;
    }
  }

  // ==========================================================================
  // CREATE METHODS
  // ==========================================================================

  /**
   * Create a new subscription
   */
  async createSubscription(data: CreateTenantSubscriptionDTO): Promise<TenantSubscription> {
    try {
      // Check if tenant already has active subscription
      const existing = await this.getActiveSubscription(data.tenantId);
      if (existing) {
        throw new ConflictError('Tenant already has an active subscription');
      }

      const queryText = `
        INSERT INTO tenant_subscriptions (
          tenant_id, plan_id, status, billing_cycle, current_price, currency,
          started_at, current_period_start, current_period_end,
          auto_renew, is_trial, trial_ends_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING ${TENANT_SUBSCRIPTION_COLUMNS}
      `;

      const params = [
        data.tenantId,
        data.planId,
        'active',
        data.billingCycle,
        data.currentPrice,
        data.currency || 'USD',
        data.startedAt || new Date(),
        data.currentPeriodStart || new Date(),
        data.currentPeriodEnd,
        data.autoRenew !== undefined ? data.autoRenew : true,
        data.isTrial || false,
        data.trialEndsAt || null,
      ];

      const result = await query<TenantSubscription>(queryText, params);

      logger.info('Subscription created', {
        subscriptionId: result[0]!.id,
        tenantId: data.tenantId,
      });

      return result[0]!;
    } catch (error) {
      logger.error('Error creating subscription', { data, error });
      throw error;
    }
  }

  // ==========================================================================
  // UPDATE METHODS
  // ==========================================================================

  /**
   * Update subscription
   */
  async updateSubscription(
    id: string,
    data: UpdateTenantSubscriptionDTO
  ): Promise<TenantSubscription> {
    try {
      const subscription = await this.getSubscriptionById(id);

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.status) {
        updates.push(`status = $${paramIndex}`);
        params.push(data.status);
        paramIndex++;
      }

      if (data.currentPrice !== undefined) {
        updates.push(`current_price = $${paramIndex}`);
        params.push(data.currentPrice);
        paramIndex++;
      }

      if (data.currentPeriodStart) {
        updates.push(`current_period_start = $${paramIndex}`);
        params.push(data.currentPeriodStart);
        paramIndex++;
      }

      if (data.currentPeriodEnd) {
        updates.push(`current_period_end = $${paramIndex}`);
        params.push(data.currentPeriodEnd);
        paramIndex++;
      }

      if (data.cancelledAt !== undefined) {
        updates.push(`cancelled_at = $${paramIndex}`);
        params.push(data.cancelledAt);
        paramIndex++;
      }

      if (data.expiresAt !== undefined) {
        updates.push(`expires_at = $${paramIndex}`);
        params.push(data.expiresAt);
        paramIndex++;
      }

      if (data.autoRenew !== undefined) {
        updates.push(`auto_renew = $${paramIndex}`);
        params.push(data.autoRenew);
        paramIndex++;
      }

      if (updates.length === 0) {
        return subscription;
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const queryText = `
        UPDATE tenant_subscriptions
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING ${TENANT_SUBSCRIPTION_COLUMNS}
      `;

      const result = await query<TenantSubscription>(queryText, params);

      logger.info('Subscription updated', { subscriptionId: id });

      return result[0]!;
    } catch (error) {
      logger.error('Error updating subscription', { id, error });
      throw error;
    }
  }

  /**
   * Change subscription plan
   */
  async changePlan(subscriptionId: string, newPlanId: string): Promise<TenantSubscription> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);

      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        throw new BusinessRuleError('Can only change plan for active subscriptions');
      }

      // Get new plan details
      const planQuery = `SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true`;
      const planResult = await query(planQuery, [newPlanId]);

      if (planResult.length === 0) {
        throw new NotFoundError('Subscription plan');
      }

      const newPlan = planResult[0];
      const newPrice = subscription.billingCycle === BillingCycle.MONTHLY 
        ? newPlan.price_monthly 
        : newPlan.price_yearly;

      // Update subscription
      const updateQuery = `
        UPDATE tenant_subscriptions
        SET plan_id = $1, current_price = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING ${TENANT_SUBSCRIPTION_COLUMNS}
      `;

      const result = await query<TenantSubscription>(updateQuery, [newPlanId, newPrice, subscriptionId]);

      logger.info('Subscription plan changed', { subscriptionId, newPlanId });

      return result[0]!;
    } catch (error) {
      logger.error('Error changing plan', { subscriptionId, newPlanId, error });
      throw error;
    }
  }

  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================

  /**
   * Cancel subscription
   */
  async cancelSubscription(id: string, immediately: boolean = false): Promise<TenantSubscription> {
    try {
      const subscription = await this.getSubscriptionById(id);

      if (subscription.status === SubscriptionStatus.CANCELLED) {
        throw new BusinessRuleError('Subscription is already cancelled');
      }

      const updateData: UpdateTenantSubscriptionDTO = {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      };

      if (immediately) {
        updateData.expiresAt = new Date();
      } else {
        updateData.expiresAt = subscription.currentPeriodEnd;
      }

      const updated = await this.updateSubscription(id, updateData);

      logger.info('Subscription cancelled', { subscriptionId: id, immediately });

      return updated;
    } catch (error) {
      logger.error('Error cancelling subscription', { id, error });
      throw error;
    }
  }

  /**
   * Renew subscription
   */
  async renewSubscription(id: string): Promise<TenantSubscription> {
    try {
      const subscription = await this.getSubscriptionById(id);

      const newPeriodStart = new Date(subscription.currentPeriodEnd);
      const newPeriodEnd = calculateNextPeriodEnd(newPeriodStart, subscription.billingCycle);

      const updateData: UpdateTenantSubscriptionDTO = {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
      };

      const updated = await this.updateSubscription(id, updateData);

      logger.info('Subscription renewed', { subscriptionId: id });

      return updated;
    } catch (error) {
      logger.error('Error renewing subscription', { id, error });
      throw error;
    }
  }

  /**
   * Suspend subscription
   */
  async suspendSubscription(id: string): Promise<TenantSubscription> {
    try {
      const subscription = await this.getSubscriptionById(id);

      if (subscription.status === SubscriptionStatus.SUSPENDED) {
        throw new BusinessRuleError('Subscription is already suspended');
      }

      const updated = await this.updateSubscription(id, {
        status: SubscriptionStatus.SUSPENDED,
      });

      logger.info('Subscription suspended', { subscriptionId: id });

      return updated;
    } catch (error) {
      logger.error('Error suspending subscription', { id, error });
      throw error;
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(id: string): Promise<TenantSubscription> {
    try {
      const subscription = await this.getSubscriptionById(id);

      if (subscription.status === SubscriptionStatus.ACTIVE) {
        throw new BusinessRuleError('Subscription is already active');
      }

      const updated = await this.updateSubscription(id, {
        status: SubscriptionStatus.ACTIVE,
      });

      logger.info('Subscription reactivated', { subscriptionId: id });

      return updated;
    } catch (error) {
      logger.error('Error reactivating subscription', { id, error });
      throw error;
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export default new SubscriptionService();