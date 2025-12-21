import { query, queryOne, setTenantContext } from '@shared/database/connection';
import { logger } from '@shared/utils/logger';
import { PaymentMethod, PaymentMethodType, PaymentMethodListOptions } from '../types/payment.types';

/**
 * Payment Method Repository
 * Handles database operations for payment methods
 */

export class PaymentMethodRepository {
  /**
   * Create a new payment method record
   */
  public static async create(data: {
    tenant_id: string;
    stripe_payment_method_id: string;
    stripe_customer_id: string;
    type: PaymentMethodType;
    is_default?: boolean;
    card_brand?: string;
    card_last4?: string;
    card_exp_month?: number;
    card_exp_year?: number;
    bank_account_last4?: string;
    bank_name?: string;
    billing_details?: Record<string, any>;
    metadata?: Record<string, any>;
  }): Promise<PaymentMethod> {
    try {
      await setTenantContext(data.tenant_id);

      const sql = `
        INSERT INTO payment_methods (
          tenant_id,
          stripe_payment_method_id,
          stripe_customer_id,
          type,
          is_default,
          card_brand,
          card_last4,
          card_exp_month,
          card_exp_year,
          bank_account_last4,
          bank_name,
          billing_details,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const values = [
        data.tenant_id,
        data.stripe_payment_method_id,
        data.stripe_customer_id,
        data.type,
        data.is_default || false,
        data.card_brand || null,
        data.card_last4 || null,
        data.card_exp_month || null,
        data.card_exp_year || null,
        data.bank_account_last4 || null,
        data.bank_name || null,
        data.billing_details ? JSON.stringify(data.billing_details) : null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ];

      const result = await queryOne<PaymentMethod>(sql, values);

      if (!result) {
        throw new Error('Failed to create payment method record');
      }

      logger.info('Payment method created', {
        paymentMethodId: result.id,
        tenantId: data.tenant_id,
        type: data.type,
        isDefault: data.is_default,
      });

      return result;
    } catch (error) {
      logger.error('Error creating payment method', {
        error,
        tenantId: data.tenant_id,
      });
      throw error;
    }
  }

  /**
   * Find payment method by ID
   */
  public static async findById(id: string, tenantId: string): Promise<PaymentMethod | null> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT *
        FROM payment_methods
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      `;

      const result = await queryOne<PaymentMethod>(sql, [id, tenantId]);

      logger.debug('Payment method fetched by ID', {
        paymentMethodId: id,
        tenantId,
        found: !!result,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching payment method by ID', {
        error,
        paymentMethodId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Find payment method by Stripe Payment Method ID
   */
  public static async findByStripeId(
    stripePaymentMethodId: string,
    tenantId: string
  ): Promise<PaymentMethod | null> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT *
        FROM payment_methods
        WHERE stripe_payment_method_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      `;

      const result = await queryOne<PaymentMethod>(sql, [stripePaymentMethodId, tenantId]);

      logger.debug('Payment method fetched by Stripe ID', {
        stripePaymentMethodId,
        tenantId,
        found: !!result,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching payment method by Stripe ID', {
        error,
        stripePaymentMethodId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Find all payment methods for a tenant
   */
  public static async findAll(
    tenantId: string,
    options: PaymentMethodListOptions = {}
  ): Promise<PaymentMethod[]> {
    try {
      await setTenantContext(tenantId);

      const { whereClause, values } = this.buildWhereClause(tenantId, options);
      const { limit = 50, offset = 0 } = options;

      const sql = `
        SELECT *
        FROM payment_methods
        ${whereClause}
        ORDER BY is_default DESC, created_at DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `;

      const result = await query<PaymentMethod>(sql, [...values, limit, offset]);

      logger.debug('Payment methods fetched', {
        tenantId,
        count: result.length,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching payment methods', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Find default payment method for a tenant
   */
  public static async findDefault(tenantId: string): Promise<PaymentMethod | null> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT *
        FROM payment_methods
        WHERE tenant_id = $1 AND is_default = true AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await queryOne<PaymentMethod>(sql, [tenantId]);

      logger.debug('Default payment method fetched', {
        tenantId,
        found: !!result,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching default payment method', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Set payment method as default (and unset others)
   */
  public static async setDefault(id: string, tenantId: string): Promise<PaymentMethod | null> {
    try {
      await setTenantContext(tenantId);

      // Start a transaction
      const unsetSql = `
        UPDATE payment_methods
        SET is_default = false, updated_at = NOW()
        WHERE tenant_id = $1 AND is_default = true AND deleted_at IS NULL
      `;

      await query(unsetSql, [tenantId]);

      // Set the new default
      const setSql = `
        UPDATE payment_methods
        SET is_default = true, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await queryOne<PaymentMethod>(setSql, [id, tenantId]);

      logger.info('Payment method set as default', {
        paymentMethodId: id,
        tenantId,
      });

      return result;
    } catch (error) {
      logger.error('Error setting default payment method', {
        error,
        paymentMethodId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Update payment method
   */
  public static async update(
    id: string,
    tenantId: string,
    updates: {
      billing_details?: Record<string, any>;
      card_exp_month?: number;
      card_exp_year?: number;
      is_default?: boolean;
    }
  ): Promise<PaymentMethod | null> {
    try {
      await setTenantContext(tenantId);

      const setClauses: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.billing_details !== undefined) {
        setClauses.push(`billing_details = $${paramIndex}`);
        values.push(JSON.stringify(updates.billing_details));
        paramIndex++;
      }

      if (updates.card_exp_month !== undefined) {
        setClauses.push(`card_exp_month = $${paramIndex}`);
        values.push(updates.card_exp_month);
        paramIndex++;
      }

      if (updates.card_exp_year !== undefined) {
        setClauses.push(`card_exp_year = $${paramIndex}`);
        values.push(updates.card_exp_year);
        paramIndex++;
      }

      if (updates.is_default !== undefined) {
        setClauses.push(`is_default = $${paramIndex}`);
        values.push(updates.is_default);
        paramIndex++;
      }

      if (setClauses.length === 1) {
        throw new Error('No fields to update');
      }

      values.push(id, tenantId);

      const sql = `
        UPDATE payment_methods
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await queryOne<PaymentMethod>(sql, values);

      logger.info('Payment method updated', {
        paymentMethodId: id,
        tenantId,
      });

      return result;
    } catch (error) {
      logger.error('Error updating payment method', {
        error,
        paymentMethodId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Soft delete payment method
   */
  public static async delete(id: string, tenantId: string): Promise<boolean> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        UPDATE payment_methods
        SET deleted_at = NOW(), is_default = false, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        RETURNING id
      `;

      const result = await queryOne<{ id: string }>(sql, [id, tenantId]);

      logger.info('Payment method deleted', {
        paymentMethodId: id,
        tenantId,
        success: !!result,
      });

      return !!result;
    } catch (error) {
      logger.error('Error deleting payment method', {
        error,
        paymentMethodId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Build WHERE clause from options
   */
  private static buildWhereClause(
    tenantId: string,
    options: PaymentMethodListOptions
  ): { whereClause: string; values: any[] } {
    const conditions: string[] = ['tenant_id = $1', 'deleted_at IS NULL'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (options.type) {
      conditions.push(`type = $${paramIndex}`);
      values.push(options.type);
      paramIndex++;
    }

    if (options.is_default !== undefined) {
      conditions.push(`is_default = $${paramIndex}`);
      values.push(options.is_default);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    return { whereClause, values };
  }
}
