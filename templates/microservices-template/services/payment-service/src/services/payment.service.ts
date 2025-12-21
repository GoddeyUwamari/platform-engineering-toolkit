import Stripe from 'stripe';
import Decimal from 'decimal.js';
import { logger } from '@shared/utils/logger';
import { stripeConfig } from '../config/stripe.config';
import { PaymentRepository } from '../repositories/payment.repository';
import {
  Payment,
  PaymentStatus,
  CreatePaymentIntentRequest,
  ConfirmPaymentRequest,
  PaymentIntentResponse,
  PaymentListOptions,
} from '../types/payment.types';

/**
 * Payment Service
 * Business logic for payment operations and Stripe integration
 */

export class PaymentService {
  /**
   * Create a new payment intent
   */
  public static async createPaymentIntent(
    tenantId: string,
    data: CreatePaymentIntentRequest
  ): Promise<PaymentIntentResponse> {
    try {
      const stripe = stripeConfig.getClient();

      // Create Stripe Payment Intent
      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(data.amount * 100), // Convert to cents
        currency: data.currency || 'usd',
        description: data.description,
        metadata: {
          tenant_id: tenantId,
          invoice_id: data.invoice_id || '',
          subscription_id: data.subscription_id || '',
          ...data.metadata,
        },
      };

      // Add payment method if provided
      if (data.payment_method_id) {
        paymentIntentData.payment_method = data.payment_method_id;
        paymentIntentData.confirm = false;
      }

      // Enable automatic payment methods if requested
      if (data.automatic_payment_methods) {
        paymentIntentData.automatic_payment_methods = {
          enabled: true,
        };
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

      // Store payment record in database
      await PaymentRepository.create({
        tenant_id: tenantId,
        invoice_id: data.invoice_id,
        subscription_id: data.subscription_id,
        stripe_payment_intent_id: paymentIntent.id,
        amount: new Decimal(data.amount),
        currency: data.currency || 'usd',
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        payment_method_id: data.payment_method_id,
        description: data.description,
        metadata: data.metadata,
      });

      logger.info('Payment intent created', {
        tenantId,
        paymentIntentId: paymentIntent.id,
        amount: data.amount,
        currency: data.currency,
      });

      return {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret || '',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        payment_method: paymentIntent.payment_method as string,
        description: paymentIntent.description || undefined,
        metadata: paymentIntent.metadata,
        next_action: paymentIntent.next_action,
        created_at: new Date(paymentIntent.created * 1000),
      };
    } catch (error) {
      logger.error('Error creating payment intent', {
        error,
        tenantId,
        amount: data.amount,
      });
      throw error;
    }
  }

  /**
   * Confirm a payment intent
   */
  public static async confirmPayment(
    tenantId: string,
    data: ConfirmPaymentRequest
  ): Promise<PaymentIntentResponse> {
    try {
      const stripe = stripeConfig.getClient();

      const confirmData: Stripe.PaymentIntentConfirmParams = {
        payment_method: data.payment_method_id,
        return_url: data.return_url,
      };

      const paymentIntent = await stripe.paymentIntents.confirm(
        data.payment_intent_id,
        confirmData
      );

      // Update payment record in database
      await PaymentRepository.updateStatus(
        data.payment_intent_id,
        tenantId,
        this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        {
          stripe_charge_id: paymentIntent.latest_charge as string,
        }
      );

      logger.info('Payment intent confirmed', {
        tenantId,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });

      return {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret || '',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        payment_method: paymentIntent.payment_method as string,
        description: paymentIntent.description || undefined,
        metadata: paymentIntent.metadata,
        next_action: paymentIntent.next_action,
        created_at: new Date(paymentIntent.created * 1000),
      };
    } catch (error) {
      logger.error('Error confirming payment intent', {
        error,
        tenantId,
        paymentIntentId: data.payment_intent_id,
      });
      throw error;
    }
  }

  /**
   * Cancel a payment intent
   */
  public static async cancelPayment(
    tenantId: string,
    paymentIntentId: string
  ): Promise<PaymentIntentResponse> {
    try {
      const stripe = stripeConfig.getClient();

      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

      // Update payment record in database
      await PaymentRepository.updateStatus(
        paymentIntentId,
        tenantId,
        PaymentStatus.CANCELLED
      );

      logger.info('Payment intent cancelled', {
        tenantId,
        paymentIntentId,
      });

      return {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret || '',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        created_at: new Date(paymentIntent.created * 1000),
      };
    } catch (error) {
      logger.error('Error cancelling payment intent', {
        error,
        tenantId,
        paymentIntentId,
      });
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  public static async getPaymentById(tenantId: string, paymentId: string): Promise<Payment | null> {
    try {
      return await PaymentRepository.findById(paymentId, tenantId);
    } catch (error) {
      logger.error('Error fetching payment', {
        error,
        tenantId,
        paymentId,
      });
      throw error;
    }
  }

  /**
   * List payments with filters
   */
  public static async listPayments(
    tenantId: string,
    options: PaymentListOptions = {}
  ): Promise<Payment[]> {
    try {
      return await PaymentRepository.findAll(tenantId, options);
    } catch (error) {
      logger.error('Error listing payments', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  public static async getPaymentStats(tenantId: string): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    totalAmount: string;
  }> {
    try {
      return await PaymentRepository.getStats(tenantId);
    } catch (error) {
      logger.error('Error fetching payment stats', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Retrieve payment intent from Stripe
   */
  public static async retrievePaymentIntent(
    paymentIntentId: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = stripeConfig.getClient();
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error('Error retrieving payment intent from Stripe', {
        error,
        paymentIntentId,
      });
      throw error;
    }
  }

  /**
   * Map Stripe payment intent status to internal payment status
   */
  private static mapStripeStatusToPaymentStatus(
    stripeStatus: Stripe.PaymentIntent.Status
  ): PaymentStatus {
    const statusMap: Record<Stripe.PaymentIntent.Status, PaymentStatus> = {
      requires_payment_method: PaymentStatus.PENDING,
      requires_confirmation: PaymentStatus.PENDING,
      requires_action: PaymentStatus.REQUIRES_ACTION,
      processing: PaymentStatus.PROCESSING,
      requires_capture: PaymentStatus.PROCESSING,
      canceled: PaymentStatus.CANCELLED,
      succeeded: PaymentStatus.SUCCEEDED,
    };

    return statusMap[stripeStatus] || PaymentStatus.PENDING;
  }
}
