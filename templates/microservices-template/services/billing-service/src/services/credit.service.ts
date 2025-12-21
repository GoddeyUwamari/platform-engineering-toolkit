/**
 * Credit Service
 * Handles account credits, promotional codes, and refunds
 */

import { query, queryOne } from '@shared/database/connection';
import { logger } from '@shared/utils/logger';
import { NotFoundError, ValidationError } from '@shared/middleware/error-handler';
import {
  Credit,
  CreditFilters,
  CreditStatus,
  CREDIT_COLUMNS,
  isValidAmount,
  applyMultipleCredits,
  useCredit,
  calculateTotalAvailableCredits,
  createPromotionalCredit,
  createRefundCredit,
  createAdjustmentCredit,
  createTrialCredit,
} from '../models/credit.model';

// ============================================================================
// Credit Service Class
// ============================================================================

export class CreditService {
  /**
   * Get all credits for a tenant
   */
  async getCreditsByTenant(
    tenantId: string,
    filters?: CreditFilters
  ): Promise<Credit[]> {
    try {
      let sql = `SELECT ${CREDIT_COLUMNS} FROM credits WHERE tenant_id = $1`;
      const params: any[] = [tenantId];
      let paramCount = 2;

      // Apply filters
      if (filters?.creditType) {
        sql += ` AND credit_type = $${paramCount}`;
        params.push(filters.creditType);
        paramCount++;
      }

      if (filters?.status) {
        sql += ` AND status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }

      if (filters?.isActive) {
        sql += ` AND status = 'active' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`;
      }

      if (filters?.hasBalance) {
        sql += ` AND remaining_amount > 0`;
      }

      if (filters?.minAmount !== undefined) {
        sql += ` AND amount >= $${paramCount}`;
        params.push(filters.minAmount);
        paramCount++;
      }

      if (filters?.maxAmount !== undefined) {
        sql += ` AND amount <= $${paramCount}`;
        params.push(filters.maxAmount);
        paramCount++;
      }

      // Order by expiration date (expiring soon first), then created date
      sql += ` ORDER BY 
        CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END,
        expires_at ASC,
        created_at ASC`;

      const credits = await query<Credit>(sql, params);

      logger.info('Fetched credits for tenant', {
        tenantId,
        count: credits.length,
        filters,
      });

      return credits;
    } catch (error) {
      logger.error('Failed to fetch credits', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get active credits for a tenant (can be used)
   */
  async getActiveCredits(tenantId: string): Promise<Credit[]> {
    return this.getCreditsByTenant(tenantId, { isActive: true, hasBalance: true });
  }

  /**
   * Get credit by ID
   */
  async getCreditById(id: string): Promise<Credit> {
    try {
      const credit = await queryOne<Credit>(
        `SELECT ${CREDIT_COLUMNS} FROM credits WHERE id = $1`,
        [id]
      );

      if (!credit) {
        throw new NotFoundError('Credit');
      }

      logger.debug('Fetched credit by ID', { creditId: id });

      return credit;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;

      logger.error('Failed to fetch credit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creditId: id,
      });
      throw error;
    }
  }

  /**
   * Get total available credit balance for tenant
   */
  async getAvailableBalance(tenantId: string): Promise<number> {
    try {
      const activeCredits = await this.getActiveCredits(tenantId);
      const balance = calculateTotalAvailableCredits(activeCredits);

      logger.debug('Calculated available credit balance', {
        tenantId,
        balance,
        creditCount: activeCredits.length,
      });

      return balance;
    } catch (error) {
      logger.error('Failed to calculate available balance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Create promotional credit
   */
  async createPromotionalCredit(
    tenantId: string,
    amount: number,
    reason: string,
    expiresAt?: Date | string,
    referenceCode?: string
  ): Promise<Credit> {
    try {
      this.validateAmount(amount);

      const creditData = createPromotionalCredit(
        tenantId,
        amount,
        reason,
        expiresAt,
        referenceCode
      );

      const credit = await this.insertCredit(creditData);

      logger.info('Created promotional credit', {
        creditId: credit.id,
        tenantId,
        amount,
        referenceCode,
      });

      return credit;
    } catch (error) {
      if (error instanceof ValidationError) throw error;

      logger.error('Failed to create promotional credit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        amount,
      });
      throw error;
    }
  }

  /**
   * Create refund credit
   */
  async createRefundCredit(
    tenantId: string,
    amount: number,
    invoiceId: string,
    reason?: string
  ): Promise<Credit> {
    try {
      this.validateAmount(amount);

      const creditData = createRefundCredit(tenantId, amount, invoiceId, reason);

      const credit = await this.insertCredit(creditData);

      logger.info('Created refund credit', {
        creditId: credit.id,
        tenantId,
        amount,
        invoiceId,
      });

      return credit;
    } catch (error) {
      if (error instanceof ValidationError) throw error;

      logger.error('Failed to create refund credit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        amount,
        invoiceId,
      });
      throw error;
    }
  }

  /**
   * Create adjustment credit
   */
  async createAdjustmentCredit(
    tenantId: string,
    amount: number,
    reason: string
  ): Promise<Credit> {
    try {
      this.validateAmount(amount);

      const creditData = createAdjustmentCredit(tenantId, amount, reason);

      const credit = await this.insertCredit(creditData);

      logger.info('Created adjustment credit', {
        creditId: credit.id,
        tenantId,
        amount,
      });

      return credit;
    } catch (error) {
      if (error instanceof ValidationError) throw error;

      logger.error('Failed to create adjustment credit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        amount,
      });
      throw error;
    }
  }

  /**
   * Create trial credit
   */
  async createTrialCredit(
    tenantId: string,
    amount: number,
    trialDays: number = 14
  ): Promise<Credit> {
    try {
      this.validateAmount(amount);

      const creditData = createTrialCredit(tenantId, amount, trialDays);

      const credit = await this.insertCredit(creditData);

      logger.info('Created trial credit', {
        creditId: credit.id,
        tenantId,
        amount,
        trialDays,
      });

      return credit;
    } catch (error) {
      if (error instanceof ValidationError) throw error;

      logger.error('Failed to create trial credit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        amount,
      });
      throw error;
    }
  }

  /**
   * Apply credits to an invoice amount
   */
  async applyCreditsToInvoice(
    tenantId: string,
    invoiceAmount: number
  ): Promise<{
    creditsApplied: Array<{ creditId: string; amountUsed: number; remainingCredit: number }>;
    totalCreditUsed: number;
    remainingAmount: number;
  }> {
    try {
      // Get active credits (sorted by expiration)
      const activeCredits = await this.getActiveCredits(tenantId);

      if (activeCredits.length === 0) {
        return {
          creditsApplied: [],
          totalCreditUsed: 0,
          remainingAmount: invoiceAmount,
        };
      }

      // Apply credits
      const result = applyMultipleCredits(activeCredits, invoiceAmount);

      // Update credits in database
      for (const applied of result.creditsApplied) {
        const credit = activeCredits.find(c => c.id === applied.creditId);
        if (credit) {
          await this.updateCreditUsage(credit.id, applied.amountUsed);
        }
      }

      logger.info('Applied credits to invoice', {
        tenantId,
        originalAmount: invoiceAmount,
        totalCreditUsed: result.totalCreditUsed,
        remainingAmount: result.remainingAmount,
        creditsUsed: result.creditsApplied.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to apply credits to invoice', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        invoiceAmount,
      });
      throw error;
    }
  }

  /**
   * Void a credit (make it unusable)
   */
  async voidCredit(creditId: string, reason?: string): Promise<Credit> {
    try {
      const credit = await this.getCreditById(creditId);

      if (credit.status === CreditStatus.VOID) {
        throw new ValidationError('Credit is already voided');
      }

      if (credit.status === CreditStatus.USED) {
        throw new ValidationError('Cannot void a fully used credit');
      }

      const updates: Partial<Credit> = {
        status: CreditStatus.VOID,
        reason: reason || credit.reason,
      };

      const updatedCredit = await this.updateCredit(creditId, updates);

      logger.info('Voided credit', {
        creditId,
        tenantId: credit.tenantId,
        reason,
      });

      return updatedCredit;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to void credit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creditId,
      });
      throw error;
    }
  }

  /**
   * Expire old credits (run as scheduled job)
   */
  async expireOldCredits(): Promise<number> {
    try {
      const result = await query<{ id: string }>(
        `UPDATE credits 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE status = $2 
           AND expires_at IS NOT NULL 
           AND expires_at < CURRENT_TIMESTAMP
         RETURNING id`,
        [CreditStatus.EXPIRED, CreditStatus.ACTIVE]
      );

      const expiredCount = result.length;

      logger.info('Expired old credits', {
        count: expiredCount,
      });

      return expiredCount;
    } catch (error) {
      logger.error('Failed to expire old credits', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get credits expiring soon (within X days)
   */
  async getExpiringSoon(tenantId: string, days: number = 7): Promise<Credit[]> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const credits = await query<Credit>(
        `SELECT ${CREDIT_COLUMNS} 
         FROM credits 
         WHERE tenant_id = $1 
           AND status = $2 
           AND remaining_amount > 0
           AND expires_at IS NOT NULL 
           AND expires_at > CURRENT_TIMESTAMP 
           AND expires_at <= $3
         ORDER BY expires_at ASC`,
        [tenantId, CreditStatus.ACTIVE, futureDate.toISOString()]
      );

      logger.debug('Fetched expiring credits', {
        tenantId,
        days,
        count: credits.length,
      });

      return credits;
    } catch (error) {
      logger.error('Failed to fetch expiring credits', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        days,
      });
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Insert credit into database
   */
  private async insertCredit(
    data: Omit<Credit, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Credit> {
    const credit = await queryOne<Credit>(
      `INSERT INTO credits (
        tenant_id,
        amount,
        remaining_amount,
        currency,
        credit_type,
        reason,
        expires_at,
        status,
        invoice_id,
        reference_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${CREDIT_COLUMNS}`,
      [
        data.tenantId,
        data.amount,
        data.remainingAmount,
        data.currency,
        data.creditType,
        data.reason || null,
        data.expiresAt || null,
        data.status,
        data.invoiceId || null,
        data.referenceCode || null,
      ]
    );

    if (!credit) {
      throw new Error('Failed to create credit');
    }

    return credit;
  }

  /**
   * Update credit after usage
   */
  private async updateCreditUsage(creditId: string, amountUsed: number): Promise<void> {
    const credit = await this.getCreditById(creditId);
    const updates = useCredit(credit, amountUsed);
    await this.updateCredit(creditId, updates);
  }

  /**
   * Update credit
   */
  private async updateCredit(
    creditId: string,
    updates: Partial<Credit>
  ): Promise<Credit> {
    const fields: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (updates.remainingAmount !== undefined) {
      fields.push(`remaining_amount = $${paramCount}`);
      params.push(updates.remainingAmount);
      paramCount++;
    }

    if (updates.status !== undefined) {
      fields.push(`status = $${paramCount}`);
      params.push(updates.status);
      paramCount++;
    }

    if (updates.expiresAt !== undefined) {
      fields.push(`expires_at = $${paramCount}`);
      params.push(updates.expiresAt);
      paramCount++;
    }

    if (updates.reason !== undefined) {
      fields.push(`reason = $${paramCount}`);
      params.push(updates.reason);
      paramCount++;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    params.push(creditId);

    const credit = await queryOne<Credit>(
      `UPDATE credits 
       SET ${fields.join(', ')} 
       WHERE id = $${paramCount}
       RETURNING ${CREDIT_COLUMNS}`,
      params
    );

    if (!credit) {
      throw new Error('Failed to update credit');
    }

    return credit;
  }

  /**
   * Validate credit amount
   */
  private validateAmount(amount: number): void {
    if (!isValidAmount(amount)) {
      throw new ValidationError('Invalid credit amount. Must be positive and finite.');
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const creditService = new CreditService();