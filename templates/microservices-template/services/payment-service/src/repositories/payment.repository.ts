import { query, queryOne, setTenantContext } from '@shared/database/connection';
import { logger } from '@shared/utils/logger';
import { Payment, PaymentStatus, PaymentListOptions } from '../types/payment.types';
import Decimal from 'decimal.js';

/**
 * Payment Repository
 * Handles database operations for payments
 */

export class PaymentRepository {
  /**
   * Create a new payment record
   */
  public static async create(data: {
    tenant_id: string;
    invoice_id?: string;
    subscription_id?: string;
    stripe_payment_intent_id: string;
    stripe_charge_id?: string;
    amount: number | Decimal;
    currency: string;
    status: PaymentStatus;
    payment_method_id?: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<Payment> {
    try {
      await setTenantContext(data.tenant_id);

      const sql = `
        INSERT INTO payments (
          tenant_id,
          invoice_id,
          subscription_id,
          stripe_payment_intent_id,
          stripe_charge_id,
          amount,
          currency,
          status,
          payment_method_id,
          description,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        data.tenant_id,
        data.invoice_id || null,
        data.subscription_id || null,
        data.stripe_payment_intent_id,
        data.stripe_charge_id || null,
        data.amount.toString(),
        data.currency,
        data.status,
        data.payment_method_id || null,
        data.description || null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ];

      const result = await queryOne<Payment>(sql, values);

      if (!result) {
        throw new Error('Failed to create payment record');
      }

      logger.info('Payment record created', {
        paymentId: result.id,
        tenantId: data.tenant_id,
        amount: data.amount,
        status: data.status,
      });

      return result;
    } catch (error) {
      logger.error('Error creating payment record', {
        error,
        tenantId: data.tenant_id,
      });
      throw error;
    }
  }

  /**
   * Find payment by ID
   */
  public static async findById(id: string, tenantId: string): Promise<Payment | null> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT *
        FROM payments
        WHERE id = $1 AND tenant_id = $2
      `;

      const result = await queryOne<Payment>(sql, [id, tenantId]);

      logger.debug('Payment fetched by ID', {
        paymentId: id,
        tenantId,
        found: !!result,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching payment by ID', {
        error,
        paymentId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Find payment by Stripe Payment Intent ID
   */
  public static async findByStripePaymentIntentId(
    stripePaymentIntentId: string,
    tenantId: string
  ): Promise<Payment | null> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT *
        FROM payments
        WHERE stripe_payment_intent_id = $1 AND tenant_id = $2
      `;

      const result = await queryOne<Payment>(sql, [stripePaymentIntentId, tenantId]);

      logger.debug('Payment fetched by Stripe Payment Intent ID', {
        stripePaymentIntentId,
        tenantId,
        found: !!result,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching payment by Stripe Payment Intent ID', {
        error,
        stripePaymentIntentId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Find all payments for a tenant with optional filters
   */
  public static async findAll(
    tenantId: string,
    options: PaymentListOptions = {}
  ): Promise<Payment[]> {
    try {
      await setTenantContext(tenantId);

      const { whereClause, values } = this.buildWhereClause(tenantId, options);
      const { limit = 50, offset = 0 } = options;

      const sql = `
        SELECT *
        FROM payments
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `;

      const result = await query<Payment>(sql, [...values, limit, offset]);

      logger.debug('Payments fetched', {
        tenantId,
        count: result.length,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching payments', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Update payment status
   */
  public static async updateStatus(
    id: string,
    tenantId: string,
    status: PaymentStatus,
    updates?: {
      stripe_charge_id?: string;
      failure_code?: string;
      failure_message?: string;
      receipt_url?: string;
    }
  ): Promise<Payment | null> {
    try {
      await setTenantContext(tenantId);

      const setClauses: string[] = ['status = $1', 'updated_at = NOW()'];
      const values: any[] = [status];
      let paramIndex = 2;

      if (updates?.stripe_charge_id) {
        setClauses.push(`stripe_charge_id = $${paramIndex}`);
        values.push(updates.stripe_charge_id);
        paramIndex++;
      }

      if (updates?.failure_code !== undefined) {
        setClauses.push(`failure_code = $${paramIndex}`);
        values.push(updates.failure_code);
        paramIndex++;
      }

      if (updates?.failure_message !== undefined) {
        setClauses.push(`failure_message = $${paramIndex}`);
        values.push(updates.failure_message);
        paramIndex++;
      }

      if (updates?.receipt_url !== undefined) {
        setClauses.push(`receipt_url = $${paramIndex}`);
        values.push(updates.receipt_url);
        paramIndex++;
      }

      values.push(id, tenantId);

      const sql = `
        UPDATE payments
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await queryOne<Payment>(sql, values);

      logger.info('Payment status updated', {
        paymentId: id,
        tenantId,
        status,
      });

      return result;
    } catch (error) {
      logger.error('Error updating payment status', {
        error,
        paymentId: id,
        tenantId,
        status,
      });
      throw error;
    }
  }

  /**
   * Get payment statistics for a tenant
   */
  public static async getStats(tenantId: string): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    totalAmount: string;
  }> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0) as total_amount
        FROM payments
        WHERE tenant_id = $1
      `;

      const result = await queryOne<any>(sql, [tenantId]);

      logger.debug('Payment stats fetched', {
        tenantId,
        stats: result,
      });

      return {
        total: parseInt(result?.total || '0', 10),
        succeeded: parseInt(result?.succeeded || '0', 10),
        failed: parseInt(result?.failed || '0', 10),
        pending: parseInt(result?.pending || '0', 10),
        totalAmount: result?.total_amount || '0',
      };
    } catch (error) {
      logger.error('Error fetching payment stats', {
        error,
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
    options: PaymentListOptions
  ): { whereClause: string; values: any[] } {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(options.status);
      paramIndex++;
    }

    if (options.invoice_id) {
      conditions.push(`invoice_id = $${paramIndex}`);
      values.push(options.invoice_id);
      paramIndex++;
    }

    if (options.subscription_id) {
      conditions.push(`subscription_id = $${paramIndex}`);
      values.push(options.subscription_id);
      paramIndex++;
    }

    if (options.start_date) {
      conditions.push(`created_at >= $${paramIndex}`);
      values.push(options.start_date);
      paramIndex++;
    }

    if (options.end_date) {
      conditions.push(`created_at <= $${paramIndex}`);
      values.push(options.end_date);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    return { whereClause, values };
  }
}
