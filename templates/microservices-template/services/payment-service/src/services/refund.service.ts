import Decimal from 'decimal.js';
import { logger } from '@shared/utils/logger';
import { stripeConfig } from '../config/stripe.config';
import { RefundRepository } from '../repositories/refund.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import {
  Refund,
  RefundStatus,
  CreateRefundRequest,
  RefundResponse,
  RefundListOptions,
} from '../types/payment.types';

/**
 * Refund Service
 * Business logic for refund operations and Stripe integration
 */

export class RefundService {
  /**
   * Create a new refund
   */
  public static async createRefund(
    tenantId: string,
    data: CreateRefundRequest
  ): Promise<RefundResponse> {
    try {
      // Get payment from database
      const payment = await PaymentRepository.findById(data.payment_id, tenantId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Calculate refund amount
      const refundAmount = data.amount || Number(payment.amount);

      // Check if refund amount is valid
      const totalRefunded = await RefundRepository.getTotalRefundedAmount(
        data.payment_id,
        tenantId
      );
      const availableToRefund = Number(payment.amount) - Number(totalRefunded);

      if (refundAmount > availableToRefund) {
        throw new Error(
          `Refund amount (${refundAmount}) exceeds available amount (${availableToRefund})`
        );
      }

      // Create Stripe refund
      const stripe = stripeConfig.getClient();
      const stripeRefund = await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: Math.round(refundAmount * 100), // Convert to cents
        reason: data.reason,
        metadata: {
          tenant_id: tenantId,
          payment_id: data.payment_id,
          ...data.metadata,
        },
      });

      // Store refund in database
      const refund = await RefundRepository.create({
        tenant_id: tenantId,
        payment_id: data.payment_id,
        stripe_refund_id: stripeRefund.id,
        amount: new Decimal(refundAmount),
        currency: payment.currency,
        status: this.mapStripeStatusToRefundStatus(stripeRefund.status || 'pending'),
        reason: data.reason,
        metadata: data.metadata,
      });

      logger.info('Refund created', {
        tenantId,
        refundId: refund.id,
        paymentId: data.payment_id,
        amount: refundAmount,
      });

      return this.mapToResponse(refund);
    } catch (error) {
      logger.error('Error creating refund', {
        error,
        tenantId,
        paymentId: data.payment_id,
      });
      throw error;
    }
  }

  /**
   * Get refund by ID
   */
  public static async getRefundById(
    tenantId: string,
    refundId: string
  ): Promise<Refund | null> {
    try {
      return await RefundRepository.findById(refundId, tenantId);
    } catch (error) {
      logger.error('Error fetching refund', {
        error,
        tenantId,
        refundId,
      });
      throw error;
    }
  }

  /**
   * List refunds
   */
  public static async listRefunds(
    tenantId: string,
    options: RefundListOptions = {}
  ): Promise<Refund[]> {
    try {
      return await RefundRepository.findAll(tenantId, options);
    } catch (error) {
      logger.error('Error listing refunds', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * List refunds for a specific payment
   */
  public static async listRefundsForPayment(
    tenantId: string,
    paymentId: string
  ): Promise<Refund[]> {
    try {
      return await RefundRepository.findByPaymentId(paymentId, tenantId);
    } catch (error) {
      logger.error('Error listing refunds for payment', {
        error,
        tenantId,
        paymentId,
      });
      throw error;
    }
  }

  /**
   * Get refund statistics
   */
  public static async getRefundStats(tenantId: string): Promise<{
    total: number;
    succeeded: number;
    pending: number;
    failed: number;
    totalAmount: string;
  }> {
    try {
      return await RefundRepository.getStats(tenantId);
    } catch (error) {
      logger.error('Error fetching refund stats', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Update refund status (typically called by webhook handler)
   */
  public static async updateRefundStatus(
    tenantId: string,
    stripeRefundId: string,
    status: RefundStatus,
    failureReason?: string
  ): Promise<Refund | null> {
    try {
      const refund = await RefundRepository.findByStripeRefundId(stripeRefundId, tenantId);

      if (!refund) {
        logger.warn('Refund not found for status update', {
          tenantId,
          stripeRefundId,
        });
        return null;
      }

      return await RefundRepository.updateStatus(
        refund.id,
        tenantId,
        status,
        failureReason
      );
    } catch (error) {
      logger.error('Error updating refund status', {
        error,
        tenantId,
        stripeRefundId,
      });
      throw error;
    }
  }

  /**
   * Map Stripe refund status to internal refund status
   */
  private static mapStripeStatusToRefundStatus(
    stripeStatus: string
  ): RefundStatus {
    const statusMap: Record<string, RefundStatus> = {
      pending: RefundStatus.PENDING,
      succeeded: RefundStatus.SUCCEEDED,
      failed: RefundStatus.FAILED,
      canceled: RefundStatus.CANCELLED,
    };

    return statusMap[stripeStatus] || RefundStatus.PENDING;
  }

  /**
   * Map Refund to RefundResponse
   */
  private static mapToResponse(refund: Refund): RefundResponse {
    return {
      id: refund.id,
      tenant_id: refund.tenant_id,
      payment_id: refund.payment_id,
      stripe_refund_id: refund.stripe_refund_id,
      amount: Number(refund.amount),
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
      failure_reason: refund.failure_reason,
      created_at: refund.created_at,
    };
  }
}
