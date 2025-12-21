import { query, queryOne, setTenantContext } from '@shared/database/connection';
import { logger } from '@shared/utils/logger';
import { Refund, RefundStatus, RefundListOptions } from '../types/payment.types';
import Decimal from 'decimal.js';

/**
 * Refund Repository
 * Handles database operations for refunds
 */

export class RefundRepository {
  /**
   * Create a new refund record
   */
  public static async create(data: {
    tenant_id: string;
    payment_id: string;
    stripe_refund_id: string;
    amount: number | Decimal;
    currency: string;
    status: RefundStatus;
    reason?: string;
    metadata?: Record<string, any>;
  }): Promise<Refund> {
    try {
      await setTenantContext(data.tenant_id);

      const sql = `
        INSERT INTO refunds (
          tenant_id,
          payment_id,
          stripe_refund_id,
          amount,
          currency,
          status,
          reason,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        data.tenant_id,
        data.payment_id,
        data.stripe_refund_id,
        data.amount.toString(),
        data.currency,
        data.status,
        data.reason || null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ];

      const result = await queryOne<Refund>(sql, values);

      if (!result) {
        throw new Error('Failed to create refund record');
      }

      logger.info('Refund record created', {
        refundId: result.id,
        tenantId: data.tenant_id,
        paymentId: data.payment_id,
        amount: data.amount,
        status: data.status,
      });

      return result;
    } catch (error) {
      logger.error('Error creating refund record', {
        error,
        tenantId: data.tenant_id,
        paymentId: data.payment_id,
      });
      throw error;
    }
  }

  /**
   * Find refund by ID
   */
  public static async findById(id: string, tenantId: string): Promise<Refund | null> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT *
        FROM refunds
        WHERE id = $1 AND tenant_id = $2
      `;

      const result = await queryOne<Refund>(sql, [id, tenantId]);

      logger.debug('Refund fetched by ID', {
        refundId: id,
        tenantId,
        found: !!result,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching refund by ID', {
        error,
        refundId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Find refund by Stripe Refund ID
   */
  public static async findByStripeRefundId(
    stripeRefundId: string,
    tenantId: string
  ): Promise<Refund | null> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT *
        FROM refunds
        WHERE stripe_refund_id = $1 AND tenant_id = $2
      `;

      const result = await queryOne<Refund>(sql, [stripeRefundId, tenantId]);

      logger.debug('Refund fetched by Stripe Refund ID', {
        stripeRefundId,
        tenantId,
        found: !!result,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching refund by Stripe Refund ID', {
        error,
        stripeRefundId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Find all refunds for a payment
   */
  public static async findByPaymentId(paymentId: string, tenantId: string): Promise<Refund[]> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT *
        FROM refunds
        WHERE payment_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
      `;

      const result = await query<Refund>(sql, [paymentId, tenantId]);

      logger.debug('Refunds fetched by payment ID', {
        paymentId,
        tenantId,
        count: result.length,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching refunds by payment ID', {
        error,
        paymentId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Find all refunds for a tenant with optional filters
   */
  public static async findAll(
    tenantId: string,
    options: RefundListOptions = {}
  ): Promise<Refund[]> {
    try {
      await setTenantContext(tenantId);

      const { whereClause, values } = this.buildWhereClause(tenantId, options);
      const { limit = 50, offset = 0 } = options;

      const sql = `
        SELECT *
        FROM refunds
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `;

      const result = await query<Refund>(sql, [...values, limit, offset]);

      logger.debug('Refunds fetched', {
        tenantId,
        count: result.length,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching refunds', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Update refund status
   */
  public static async updateStatus(
    id: string,
    tenantId: string,
    status: RefundStatus,
    failureReason?: string
  ): Promise<Refund | null> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        UPDATE refunds
        SET
          status = $1,
          failure_reason = $2,
          updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4
        RETURNING *
      `;

      const result = await queryOne<Refund>(sql, [status, failureReason || null, id, tenantId]);

      logger.info('Refund status updated', {
        refundId: id,
        tenantId,
        status,
      });

      return result;
    } catch (error) {
      logger.error('Error updating refund status', {
        error,
        refundId: id,
        tenantId,
        status,
      });
      throw error;
    }
  }

  /**
   * Get total refunded amount for a payment
   */
  public static async getTotalRefundedAmount(
    paymentId: string,
    tenantId: string
  ): Promise<string> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT COALESCE(SUM(amount), 0) as total_refunded
        FROM refunds
        WHERE payment_id = $1 AND tenant_id = $2 AND status = 'succeeded'
      `;

      const result = await queryOne<{ total_refunded: string }>(sql, [paymentId, tenantId]);

      logger.debug('Total refunded amount fetched', {
        paymentId,
        tenantId,
        totalRefunded: result?.total_refunded || '0',
      });

      return result?.total_refunded || '0';
    } catch (error) {
      logger.error('Error fetching total refunded amount', {
        error,
        paymentId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get refund statistics for a tenant
   */
  public static async getStats(tenantId: string): Promise<{
    total: number;
    succeeded: number;
    pending: number;
    failed: number;
    totalAmount: string;
  }> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0) as total_amount
        FROM refunds
        WHERE tenant_id = $1
      `;

      const result = await queryOne<any>(sql, [tenantId]);

      logger.debug('Refund stats fetched', {
        tenantId,
        stats: result,
      });

      return {
        total: parseInt(result?.total || '0', 10),
        succeeded: parseInt(result?.succeeded || '0', 10),
        pending: parseInt(result?.pending || '0', 10),
        failed: parseInt(result?.failed || '0', 10),
        totalAmount: result?.total_amount || '0',
      };
    } catch (error) {
      logger.error('Error fetching refund stats', {
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
    options: RefundListOptions
  ): { whereClause: string; values: any[] } {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (options.payment_id) {
      conditions.push(`payment_id = $${paramIndex}`);
      values.push(options.payment_id);
      paramIndex++;
    }

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(options.status);
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
