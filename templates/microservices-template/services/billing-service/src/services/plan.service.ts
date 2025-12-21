/**
 * Plan Service
 * Handles subscription plan management (CRUD operations)
 */

import { query, queryOne } from '@shared/database/connection';
import { logger } from '@shared/utils/logger';
import { NotFoundError, ValidationError, ConflictError } from '@shared/middleware/error-handler';
import {
  SubscriptionPlan,
  CreateSubscriptionPlanDTO,
  UpdateSubscriptionPlanDTO,
  SubscriptionPlanFilters,
  SUBSCRIPTION_PLAN_COLUMNS,
  isValidPlanName,
  isValidPrice,
  isValidMaxUsers,
} from '../models/subscription-plan.model';

// ============================================================================
// Plan Service Class
// ============================================================================

export class PlanService {
  /**
   * Get all subscription plans
   */
  async getAllPlans(filters?: SubscriptionPlanFilters): Promise<SubscriptionPlan[]> {
    try {
      let sql = `SELECT ${SUBSCRIPTION_PLAN_COLUMNS} FROM subscription_plans WHERE 1=1`;
      const params: any[] = [];
      let paramCount = 1;

      // Apply filters
      if (filters?.isActive !== undefined) {
        sql += ` AND is_active = $${paramCount}`;
        params.push(filters.isActive);
        paramCount++;
      }

      if (filters?.minPrice !== undefined) {
        sql += ` AND price_monthly >= $${paramCount}`;
        params.push(filters.minPrice);
        paramCount++;
      }

      if (filters?.maxPrice !== undefined) {
        sql += ` AND price_monthly <= $${paramCount}`;
        params.push(filters.maxPrice);
        paramCount++;
      }

      if (filters?.hasFeature) {
        const featureColumn = this.getFeatureColumn(filters.hasFeature);
        sql += ` AND ${featureColumn} = true`;
      }

      // Order by sort_order, then price
      sql += ` ORDER BY sort_order ASC, price_monthly ASC`;

      const plans = await query<SubscriptionPlan>(sql, params);

      logger.info('Fetched subscription plans', {
        count: plans.length,
        filters,
      });

      return plans;
    } catch (error) {
      logger.error('Failed to fetch subscription plans', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
      });
      throw error;
    }
  }

  /**
   * Get active plans only (for public display)
   */
  async getActivePlans(): Promise<SubscriptionPlan[]> {
    return this.getAllPlans({ isActive: true });
  }

  /**
   * Get plan by ID
   */
  async getPlanById(id: string): Promise<SubscriptionPlan> {
    try {
      const plan = await queryOne<SubscriptionPlan>(
        `SELECT ${SUBSCRIPTION_PLAN_COLUMNS} FROM subscription_plans WHERE id = $1`,
        [id]
      );

      if (!plan) {
        throw new NotFoundError('Subscription plan');
      }

      logger.debug('Fetched subscription plan by ID', { planId: id });

      return plan;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;

      logger.error('Failed to fetch subscription plan', {
        error: error instanceof Error ? error.message : 'Unknown error',
        planId: id,
      });
      throw error;
    }
  }

  /**
   * Get plan by name (unique identifier)
   */
  async getPlanByName(name: string): Promise<SubscriptionPlan> {
    try {
      const plan = await queryOne<SubscriptionPlan>(
        `SELECT ${SUBSCRIPTION_PLAN_COLUMNS} FROM subscription_plans WHERE name = $1`,
        [name]
      );

      if (!plan) {
        throw new NotFoundError('Subscription plan');
      }

      logger.debug('Fetched subscription plan by name', { name });

      return plan;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;

      logger.error('Failed to fetch subscription plan by name', {
        error: error instanceof Error ? error.message : 'Unknown error',
        name,
      });
      throw error;
    }
  }

  /**
   * Create new subscription plan
   */
  async createPlan(data: CreateSubscriptionPlanDTO): Promise<SubscriptionPlan> {
    try {
      // Validation
      this.validateCreateData(data);

      // Check if plan name already exists
      const existing = await queryOne<{ id: string }>(
        'SELECT id FROM subscription_plans WHERE name = $1',
        [data.name]
      );

      if (existing) {
        throw new ConflictError(`Plan with name '${data.name}' already exists`);
      }

      // Insert plan
      const plan = await queryOne<SubscriptionPlan>(
        `INSERT INTO subscription_plans (
          name,
          display_name,
          description,
          price_monthly,
          price_yearly,
          max_api_calls,
          max_storage_gb,
          max_users,
          max_projects,
          has_advanced_analytics,
          has_priority_support,
          has_custom_branding,
          has_api_access,
          has_webhooks,
          sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING ${SUBSCRIPTION_PLAN_COLUMNS}`,
        [
          data.name,
          data.displayName,
          data.description || null,
          data.priceMonthly,
          data.priceYearly,
          data.maxApiCalls,
          data.maxStorageGb,
          data.maxUsers,
          data.maxProjects,
          data.hasAdvancedAnalytics || false,
          data.hasPrioritySupport || false,
          data.hasCustomBranding || false,
          data.hasApiAccess || false,
          data.hasWebhooks || false,
          data.sortOrder || 0,
        ]
      );

      if (!plan) {
        throw new Error('Failed to create subscription plan');
      }

      logger.info('Created subscription plan', {
        planId: plan.id,
        name: plan.name,
        displayName: plan.displayName,
      });

      return plan;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }

      logger.error('Failed to create subscription plan', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
      throw error;
    }
  }

  /**
   * Update subscription plan
   */
  async updatePlan(id: string, data: UpdateSubscriptionPlanDTO): Promise<SubscriptionPlan> {
    try {
      // Check if plan exists
      await this.getPlanById(id);

      // Validation
      this.validateUpdateData(data);

      // Build dynamic update query
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (data.displayName !== undefined) {
        updates.push(`display_name = $${paramCount}`);
        params.push(data.displayName);
        paramCount++;
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramCount}`);
        params.push(data.description);
        paramCount++;
      }

      if (data.priceMonthly !== undefined) {
        updates.push(`price_monthly = $${paramCount}`);
        params.push(data.priceMonthly);
        paramCount++;
      }

      if (data.priceYearly !== undefined) {
        updates.push(`price_yearly = $${paramCount}`);
        params.push(data.priceYearly);
        paramCount++;
      }

      if (data.maxApiCalls !== undefined) {
        updates.push(`max_api_calls = $${paramCount}`);
        params.push(data.maxApiCalls);
        paramCount++;
      }

      if (data.maxStorageGb !== undefined) {
        updates.push(`max_storage_gb = $${paramCount}`);
        params.push(data.maxStorageGb);
        paramCount++;
      }

      if (data.maxUsers !== undefined) {
        updates.push(`max_users = $${paramCount}`);
        params.push(data.maxUsers);
        paramCount++;
      }

      if (data.maxProjects !== undefined) {
        updates.push(`max_projects = $${paramCount}`);
        params.push(data.maxProjects);
        paramCount++;
      }

      if (data.hasAdvancedAnalytics !== undefined) {
        updates.push(`has_advanced_analytics = $${paramCount}`);
        params.push(data.hasAdvancedAnalytics);
        paramCount++;
      }

      if (data.hasPrioritySupport !== undefined) {
        updates.push(`has_priority_support = $${paramCount}`);
        params.push(data.hasPrioritySupport);
        paramCount++;
      }

      if (data.hasCustomBranding !== undefined) {
        updates.push(`has_custom_branding = $${paramCount}`);
        params.push(data.hasCustomBranding);
        paramCount++;
      }

      if (data.hasApiAccess !== undefined) {
        updates.push(`has_api_access = $${paramCount}`);
        params.push(data.hasApiAccess);
        paramCount++;
      }

      if (data.hasWebhooks !== undefined) {
        updates.push(`has_webhooks = $${paramCount}`);
        params.push(data.hasWebhooks);
        paramCount++;
      }

      if (data.isActive !== undefined) {
        updates.push(`is_active = $${paramCount}`);
        params.push(data.isActive);
        paramCount++;
      }

      if (data.sortOrder !== undefined) {
        updates.push(`sort_order = $${paramCount}`);
        params.push(data.sortOrder);
        paramCount++;
      }

      if (updates.length === 0) {
        throw new ValidationError('No fields to update');
      }

      // Add updated_at
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      // Add ID to params
      params.push(id);

      const plan = await queryOne<SubscriptionPlan>(
        `UPDATE subscription_plans 
         SET ${updates.join(', ')} 
         WHERE id = $${paramCount}
         RETURNING ${SUBSCRIPTION_PLAN_COLUMNS}`,
        params
      );

      if (!plan) {
        throw new Error('Failed to update subscription plan');
      }

      logger.info('Updated subscription plan', {
        planId: id,
        updates: Object.keys(data),
      });

      return plan;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to update subscription plan', {
        error: error instanceof Error ? error.message : 'Unknown error',
        planId: id,
        data,
      });
      throw error;
    }
  }

  /**
   * Activate plan (make it available for subscriptions)
   */
  async activatePlan(id: string): Promise<SubscriptionPlan> {
    return this.updatePlan(id, { isActive: true });
  }

  /**
   * Deactivate plan (hide from new subscriptions, existing subscriptions continue)
   */
  async deactivatePlan(id: string): Promise<SubscriptionPlan> {
    return this.updatePlan(id, { isActive: false });
  }

  /**
   * Delete plan (soft delete - only if no active subscriptions)
   */
  async deletePlan(id: string): Promise<void> {
    try {
      // Check if plan exists
      await this.getPlanById(id);

      // Check if plan has active subscriptions
      const activeSubscriptions = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM tenant_subscriptions 
         WHERE plan_id = $1 AND status = 'active'`,
        [id]
      );

      const count = parseInt(activeSubscriptions?.count || '0', 10);
      if (count > 0) {
        throw new ValidationError(
          `Cannot delete plan with ${count} active subscription(s). Deactivate the plan instead.`
        );
      }

      // Soft delete (deactivate)
      await this.deactivatePlan(id);

      logger.info('Deleted (deactivated) subscription plan', { planId: id });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to delete subscription plan', {
        error: error instanceof Error ? error.message : 'Unknown error',
        planId: id,
      });
      throw error;
    }
  }

  /**
   * Compare two plans
   */
  async comparePlans(planId1: string, planId2: string): Promise<{
    plan1: SubscriptionPlan;
    plan2: SubscriptionPlan;
    differences: Record<string, { plan1: any; plan2: any }>;
  }> {
    try {
      const plan1 = await this.getPlanById(planId1);
      const plan2 = await this.getPlanById(planId2);

      const differences: Record<string, { plan1: any; plan2: any }> = {};

      // Compare key fields
      const fieldsToCompare = [
        'priceMonthly',
        'priceYearly',
        'maxApiCalls',
        'maxStorageGb',
        'maxUsers',
        'maxProjects',
        'hasAdvancedAnalytics',
        'hasPrioritySupport',
        'hasCustomBranding',
        'hasApiAccess',
        'hasWebhooks',
      ];

      for (const field of fieldsToCompare) {
        const key = field as keyof SubscriptionPlan;
        if (plan1[key] !== plan2[key]) {
          differences[field] = {
            plan1: plan1[key],
            plan2: plan2[key],
          };
        }
      }

      return { plan1, plan2, differences };
    } catch (error) {
      logger.error('Failed to compare plans', {
        error: error instanceof Error ? error.message : 'Unknown error',
        planId1,
        planId2,
      });
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate create data
   */
  private validateCreateData(data: CreateSubscriptionPlanDTO): void {
    if (!isValidPlanName(data.name)) {
      throw new ValidationError(
        'Invalid plan name. Use lowercase alphanumeric characters and hyphens only.'
      );
    }

    if (!data.displayName || data.displayName.trim().length === 0) {
      throw new ValidationError('Display name is required');
    }

    if (!isValidPrice(data.priceMonthly)) {
      throw new ValidationError('Invalid monthly price');
    }

    if (!isValidPrice(data.priceYearly)) {
      throw new ValidationError('Invalid yearly price');
    }

    if (!isValidMaxUsers(data.maxUsers)) {
      throw new ValidationError('Invalid max users value');
    }

    if (data.maxApiCalls <= 0) {
      throw new ValidationError('Max API calls must be positive');
    }

    if (data.maxStorageGb <= 0) {
      throw new ValidationError('Max storage must be positive');
    }

    if (data.maxProjects <= 0) {
      throw new ValidationError('Max projects must be positive');
    }
  }

  /**
   * Validate update data
   */
  private validateUpdateData(data: UpdateSubscriptionPlanDTO): void {
    if (data.priceMonthly !== undefined && !isValidPrice(data.priceMonthly)) {
      throw new ValidationError('Invalid monthly price');
    }

    if (data.priceYearly !== undefined && !isValidPrice(data.priceYearly)) {
      throw new ValidationError('Invalid yearly price');
    }

    if (data.maxUsers !== undefined && !isValidMaxUsers(data.maxUsers)) {
      throw new ValidationError('Invalid max users value');
    }

    if (data.maxApiCalls !== undefined && data.maxApiCalls <= 0) {
      throw new ValidationError('Max API calls must be positive');
    }

    if (data.maxStorageGb !== undefined && data.maxStorageGb <= 0) {
      throw new ValidationError('Max storage must be positive');
    }

    if (data.maxProjects !== undefined && data.maxProjects <= 0) {
      throw new ValidationError('Max projects must be positive');
    }
  }

  /**
   * Get database column name for feature filter
   */
  private getFeatureColumn(
    feature: keyof Pick<
      SubscriptionPlan,
      'hasAdvancedAnalytics' | 'hasPrioritySupport' | 'hasCustomBranding' | 'hasApiAccess' | 'hasWebhooks'
    >
  ): string {
    const columnMap: Record<string, string> = {
      hasAdvancedAnalytics: 'has_advanced_analytics',
      hasPrioritySupport: 'has_priority_support',
      hasCustomBranding: 'has_custom_branding',
      hasApiAccess: 'has_api_access',
      hasWebhooks: 'has_webhooks',
    };

    return columnMap[feature] || 'has_advanced_analytics';
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const planService = new PlanService();