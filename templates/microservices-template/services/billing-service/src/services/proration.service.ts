/**
 * Proration Service
 * Handles proration calculations for subscription changes including:
 * - Upgrade proration (credit unused time, charge for new plan)
 * - Downgrade proration (credit difference)
 * - Cancellation refunds
 * - Mid-cycle billing adjustments
 * 
 * @module services/proration.service
 */

import { logger } from '@shared/utils/logger';
import { ValidationError } from '@shared/middleware/error-handler';
import { TenantSubscription, BillingCycle } from '../models/tenant-subscription.model';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Result of proration calculation
 */
interface ProrationResult {
  creditAmount: number;      // Amount to credit to customer
  chargeAmount: number;       // Amount to charge customer
  unusedDays: number;         // Days remaining in current period
  totalDays: number;          // Total days in billing period
  prorationFactor: number;    // Decimal factor (0-1) for calculations
}

/**
 * Upgrade proration result
 */
interface UpgradeProration {
  creditAmount: number;       // Credit for unused time on old plan
  chargeAmount: number;       // Immediate charge for new plan
  netAmount: number;          // Net amount (charge - credit)
  effectiveDate: Date;        // When upgrade takes effect
}

/**
 * Downgrade proration result
 */
interface DowngradeProration {
  creditAmount: number;       // Credit for price difference
  chargeAmount: number;       // No charge for downgrade
  effectiveDate: Date;        // When downgrade takes effect
}

/**
 * Cancellation refund result
 */
interface CancellationRefund {
  refundAmount: number;       // Amount to refund/credit
  unusedDays: number;         // Days of service not used
  totalDays: number;          // Total days in period
  effectiveDate: Date;        // Cancellation date
}

// ============================================================================
// Proration Service Class
// ============================================================================

export class ProrationService {
  
  // ==========================================================================
  // CORE PRORATION CALCULATIONS
  // ==========================================================================

  /**
   * Calculate basic proration for remaining time in period
   * 
   * @param amount - Amount to prorate
   * @param currentPeriodStart - Start of billing period
   * @param currentPeriodEnd - End of billing period
   * @param effectiveDate - Date of change (defaults to now)
   * @returns Proration result
   */
  calculateProration(
    amount: number,
    currentPeriodStart: Date | string,
    currentPeriodEnd: Date | string,
    effectiveDate?: Date | string
  ): ProrationResult {
    try {
      // Validate inputs
      if (amount < 0) {
        throw new ValidationError('Amount cannot be negative');
      }

      const periodStart = new Date(currentPeriodStart);
      const periodEnd = new Date(currentPeriodEnd);
      const changeDate = effectiveDate ? new Date(effectiveDate) : new Date();

      // Validate dates
      if (periodStart >= periodEnd) {
        throw new ValidationError('Period start must be before period end');
      }

      if (changeDate < periodStart) {
        throw new ValidationError('Effective date cannot be before period start');
      }

      // Calculate time periods
      const totalMs = periodEnd.getTime() - periodStart.getTime();
      const unusedMs = Math.max(0, periodEnd.getTime() - changeDate.getTime());

      const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
      const unusedDays = Math.ceil(unusedMs / (1000 * 60 * 60 * 24));

      // Calculate proration factor
      const prorationFactor = totalDays > 0 ? unusedDays / totalDays : 0;

      // Calculate prorated amount
      const creditAmount = this.roundAmount(amount * prorationFactor);
      const chargeAmount = 0; // Base calculation doesn't include charges

      logger.debug('Calculated proration', {
        amount,
        totalDays,
        unusedDays,
        prorationFactor,
        creditAmount,
      });

      return {
        creditAmount,
        chargeAmount,
        unusedDays,
        totalDays,
        prorationFactor,
      };
    } catch (error) {
      if (error instanceof ValidationError) throw error;

      logger.error('Failed to calculate proration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        amount,
      });
      throw error;
    }
  }

  // ==========================================================================
  // UPGRADE PRORATION
  // ==========================================================================

  /**
   * Calculate proration for subscription upgrade
   * Credits unused time on old plan, charges for remaining time on new plan
   * 
   * @param subscription - Current subscription
   * @param newPrice - Price of new plan
   * @returns Upgrade proration details
   */
  async calculateUpgradeProration(
    subscription: TenantSubscription,
    newPrice: number
  ): Promise<UpgradeProration> {
    try {
      const now = new Date();

      // Calculate credit for unused time on current plan
      const unusedCredit = this.calculateProration(
        subscription.currentPrice,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        now
      );

      // Calculate charge for remaining time on new plan
      const newPlanCharge = this.calculateProration(
        newPrice,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        now
      );

      // For upgrade, we charge the prorated amount for the new plan
      const chargeAmount = newPlanCharge.creditAmount;
      const creditAmount = unusedCredit.creditAmount;
      const netAmount = Math.max(0, chargeAmount - creditAmount);

      logger.info('Calculated upgrade proration', {
        subscriptionId: subscription.id,
        oldPrice: subscription.currentPrice,
        newPrice,
        creditAmount,
        chargeAmount,
        netAmount,
      });

      return {
        creditAmount,
        chargeAmount,
        netAmount,
        effectiveDate: now,
      };
    } catch (error) {
      logger.error('Failed to calculate upgrade proration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId: subscription.id,
      });
      throw error;
    }
  }

  // ==========================================================================
  // DOWNGRADE PRORATION
  // ==========================================================================

  /**
   * Calculate proration for subscription downgrade
   * Credits the price difference for remaining time
   * 
   * @param subscription - Current subscription
   * @param newPrice - Price of new (lower) plan
   * @returns Downgrade proration details
   */
  async calculateDowngradeProration(
    subscription: TenantSubscription,
    newPrice: number
  ): Promise<DowngradeProration> {
    try {
      const now = new Date();

      // Calculate the price difference
      const priceDifference = subscription.currentPrice - newPrice;

      if (priceDifference <= 0) {
        // Not actually a downgrade
        return {
          creditAmount: 0,
          chargeAmount: 0,
          effectiveDate: now,
        };
      }

      // Calculate credit for the price difference over remaining time
      const proration = this.calculateProration(
        priceDifference,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        now
      );

      logger.info('Calculated downgrade proration', {
        subscriptionId: subscription.id,
        oldPrice: subscription.currentPrice,
        newPrice,
        priceDifference,
        creditAmount: proration.creditAmount,
      });

      return {
        creditAmount: proration.creditAmount,
        chargeAmount: 0, // Downgrades don't charge
        effectiveDate: now,
      };
    } catch (error) {
      logger.error('Failed to calculate downgrade proration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId: subscription.id,
      });
      throw error;
    }
  }

  // ==========================================================================
  // CANCELLATION REFUND
  // ==========================================================================

  /**
   * Calculate refund for subscription cancellation
   * Refunds unused time in current period
   * 
   * @param subscription - Subscription being cancelled
   * @param cancellationDate - When cancellation takes effect
   * @returns Refund amount
   */
  async calculateCancellationRefund(
    subscription: TenantSubscription,
    cancellationDate?: Date | string
  ): Promise<number> {
    try {
      const effectiveDate = cancellationDate ? new Date(cancellationDate) : new Date();

      // Calculate refund for unused time
      const proration = this.calculateProration(
        subscription.currentPrice,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        effectiveDate
      );

      logger.info('Calculated cancellation refund', {
        subscriptionId: subscription.id,
        refundAmount: proration.creditAmount,
        unusedDays: proration.unusedDays,
        totalDays: proration.totalDays,
      });

      return proration.creditAmount;
    } catch (error) {
      logger.error('Failed to calculate cancellation refund', {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId: subscription.id,
      });
      throw error;
    }
  }

  /**
   * Get detailed cancellation refund information
   * 
   * @param subscription - Subscription being cancelled
   * @param cancellationDate - When cancellation takes effect
   * @returns Detailed cancellation refund
   */
  async getCancellationRefundDetails(
    subscription: TenantSubscription,
    cancellationDate?: Date | string
  ): Promise<CancellationRefund> {
    try {
      const effectiveDate = cancellationDate ? new Date(cancellationDate) : new Date();

      const proration = this.calculateProration(
        subscription.currentPrice,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        effectiveDate
      );

      return {
        refundAmount: proration.creditAmount,
        unusedDays: proration.unusedDays,
        totalDays: proration.totalDays,
        effectiveDate,
      };
    } catch (error) {
      logger.error('Failed to get cancellation refund details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId: subscription.id,
      });
      throw error;
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Calculate days in a billing cycle
   * 
   * @param billingCycle - Billing cycle
   * @returns Number of days
   */
  getBillingCycleDays(billingCycle: BillingCycle): number {
    switch (billingCycle) {
      case BillingCycle.MONTHLY:
        return 30;
      case BillingCycle.YEARLY:
        return 365;
      default:
        return 30;
    }
  }

  /**
   * Calculate if immediate payment is better than proration
   * Sometimes it's simpler to just charge the full new amount
   * 
   * @param subscription - Current subscription
   * @param newPrice - New plan price
   * @returns True if should charge full amount immediately
   */
  shouldChargeFullAmount(subscription: TenantSubscription, newPrice: number): boolean {
    try {
      const proration = this.calculateProration(
        newPrice,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd
      );

      // If less than 3 days remaining, charge full amount for next period
      if (proration.unusedDays < 3) {
        return true;
      }

      // If prorated amount is less than $1, charge full amount
      if (proration.creditAmount < 1) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to determine if should charge full amount', {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId: subscription.id,
      });
      return false;
    }
  }

  /**
   * Calculate days remaining in current period
   * 
   * @param subscription - Subscription
   * @returns Days remaining
   */
  getDaysRemaining(subscription: TenantSubscription): number {
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const msRemaining = Math.max(0, periodEnd.getTime() - now.getTime());
    return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate percentage of billing period remaining
   * 
   * @param subscription - Subscription
   * @returns Percentage (0-100)
   */
  getPercentageRemaining(subscription: TenantSubscription): number {
    const proration = this.calculateProration(
      100,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd
    );
    return Math.round(proration.prorationFactor * 100);
  }

  /**
   * Round amount to 2 decimal places
   * 
   * @param amount - Amount to round
   * @returns Rounded amount
   */
  private roundAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const prorationService = new ProrationService();