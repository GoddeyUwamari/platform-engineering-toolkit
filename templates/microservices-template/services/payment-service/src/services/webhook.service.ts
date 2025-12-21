import Stripe from 'stripe';
import { logger } from '@shared/utils/logger';
import { stripeConfig } from '../config/stripe.config';
import { PaymentRepository } from '../repositories/payment.repository';
import { RefundRepository } from '../repositories/refund.repository';
import { PaymentStatus, RefundStatus, StripeWebhookEventType } from '../types/payment.types';

/**
 * Webhook Service
 * Handles Stripe webhook events
 */

export class WebhookService {
  /**
   * Construct and verify webhook event
   */
  public static constructEvent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    try {
      return stripeConfig.constructWebhookEvent(payload, signature);
    } catch (error) {
      logger.error('Error constructing webhook event', {
        error,
      });
      throw error;
    }
  }

  /**
   * Handle webhook event
   */
  public static async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      logger.info('Processing webhook event', {
        eventId: event.id,
        eventType: event.type,
      });

      switch (event.type) {
        case StripeWebhookEventType.PAYMENT_INTENT_SUCCEEDED:
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case StripeWebhookEventType.PAYMENT_INTENT_FAILED:
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case StripeWebhookEventType.PAYMENT_INTENT_CANCELED:
          await this.handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
          break;

        case StripeWebhookEventType.PAYMENT_INTENT_REQUIRES_ACTION:
          await this.handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent);
          break;

        case StripeWebhookEventType.CHARGE_SUCCEEDED:
          await this.handleChargeSucceeded(event.data.object as Stripe.Charge);
          break;

        case StripeWebhookEventType.CHARGE_FAILED:
          await this.handleChargeFailed(event.data.object as Stripe.Charge);
          break;

        case StripeWebhookEventType.CHARGE_REFUNDED:
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          logger.debug('Unhandled webhook event type', {
            eventType: event.type,
          });
      }

      logger.info('Webhook event processed successfully', {
        eventId: event.id,
        eventType: event.type,
      });
    } catch (error) {
      logger.error('Error handling webhook event', {
        error,
        eventId: event.id,
        eventType: event.type,
      });
      throw error;
    }
  }

  /**
   * Handle payment_intent.succeeded event
   */
  private static async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<void> {
    try {
      const tenantId = paymentIntent.metadata.tenant_id;

      if (!tenantId) {
        logger.warn('No tenant_id in payment intent metadata', {
          paymentIntentId: paymentIntent.id,
        });
        return;
      }

      const payment = await PaymentRepository.findByStripePaymentIntentId(
        paymentIntent.id,
        tenantId
      );

      if (payment) {
        await PaymentRepository.updateStatus(payment.id, tenantId, PaymentStatus.SUCCEEDED, {
          stripe_charge_id: paymentIntent.latest_charge as string,
          receipt_url: (paymentIntent as any).charges?.data?.[0]?.receipt_url,
        });

        logger.info('Payment marked as succeeded', {
          paymentId: payment.id,
          tenantId,
          paymentIntentId: paymentIntent.id,
        });
      }
    } catch (error) {
      logger.error('Error handling payment_intent.succeeded', {
        error,
        paymentIntentId: paymentIntent.id,
      });
      throw error;
    }
  }

  /**
   * Handle payment_intent.payment_failed event
   */
  private static async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<void> {
    try {
      const tenantId = paymentIntent.metadata.tenant_id;

      if (!tenantId) {
        logger.warn('No tenant_id in payment intent metadata', {
          paymentIntentId: paymentIntent.id,
        });
        return;
      }

      const payment = await PaymentRepository.findByStripePaymentIntentId(
        paymentIntent.id,
        tenantId
      );

      if (payment) {
        await PaymentRepository.updateStatus(payment.id, tenantId, PaymentStatus.FAILED, {
          failure_code: paymentIntent.last_payment_error?.code,
          failure_message: paymentIntent.last_payment_error?.message,
        });

        logger.info('Payment marked as failed', {
          paymentId: payment.id,
          tenantId,
          paymentIntentId: paymentIntent.id,
          failureCode: paymentIntent.last_payment_error?.code,
        });
      }
    } catch (error) {
      logger.error('Error handling payment_intent.payment_failed', {
        error,
        paymentIntentId: paymentIntent.id,
      });
      throw error;
    }
  }

  /**
   * Handle payment_intent.canceled event
   */
  private static async handlePaymentIntentCanceled(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<void> {
    try {
      const tenantId = paymentIntent.metadata.tenant_id;

      if (!tenantId) {
        logger.warn('No tenant_id in payment intent metadata', {
          paymentIntentId: paymentIntent.id,
        });
        return;
      }

      const payment = await PaymentRepository.findByStripePaymentIntentId(
        paymentIntent.id,
        tenantId
      );

      if (payment) {
        await PaymentRepository.updateStatus(payment.id, tenantId, PaymentStatus.CANCELLED);

        logger.info('Payment marked as cancelled', {
          paymentId: payment.id,
          tenantId,
          paymentIntentId: paymentIntent.id,
        });
      }
    } catch (error) {
      logger.error('Error handling payment_intent.canceled', {
        error,
        paymentIntentId: paymentIntent.id,
      });
      throw error;
    }
  }

  /**
   * Handle payment_intent.requires_action event
   */
  private static async handlePaymentIntentRequiresAction(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<void> {
    try {
      const tenantId = paymentIntent.metadata.tenant_id;

      if (!tenantId) {
        logger.warn('No tenant_id in payment intent metadata', {
          paymentIntentId: paymentIntent.id,
        });
        return;
      }

      const payment = await PaymentRepository.findByStripePaymentIntentId(
        paymentIntent.id,
        tenantId
      );

      if (payment) {
        await PaymentRepository.updateStatus(
          payment.id,
          tenantId,
          PaymentStatus.REQUIRES_ACTION
        );

        logger.info('Payment marked as requires_action', {
          paymentId: payment.id,
          tenantId,
          paymentIntentId: paymentIntent.id,
        });
      }
    } catch (error) {
      logger.error('Error handling payment_intent.requires_action', {
        error,
        paymentIntentId: paymentIntent.id,
      });
      throw error;
    }
  }

  /**
   * Handle charge.succeeded event
   */
  private static async handleChargeSucceeded(charge: Stripe.Charge): Promise<void> {
    try {
      const paymentIntentId = charge.payment_intent as string;

      if (!paymentIntentId) {
        logger.debug('Charge without payment intent', { chargeId: charge.id });
        return;
      }

      const tenantId = charge.metadata.tenant_id;

      if (!tenantId) {
        logger.warn('No tenant_id in charge metadata', {
          chargeId: charge.id,
        });
        return;
      }

      const payment = await PaymentRepository.findByStripePaymentIntentId(
        paymentIntentId,
        tenantId
      );

      if (payment) {
        await PaymentRepository.updateStatus(payment.id, tenantId, PaymentStatus.SUCCEEDED, {
          stripe_charge_id: charge.id,
          receipt_url: charge.receipt_url || undefined,
        });

        logger.info('Payment updated with charge details', {
          paymentId: payment.id,
          tenantId,
          chargeId: charge.id,
        });
      }
    } catch (error) {
      logger.error('Error handling charge.succeeded', {
        error,
        chargeId: charge.id,
      });
      throw error;
    }
  }

  /**
   * Handle charge.failed event
   */
  private static async handleChargeFailed(charge: Stripe.Charge): Promise<void> {
    try {
      const paymentIntentId = charge.payment_intent as string;

      if (!paymentIntentId) {
        logger.debug('Charge without payment intent', { chargeId: charge.id });
        return;
      }

      const tenantId = charge.metadata.tenant_id;

      if (!tenantId) {
        logger.warn('No tenant_id in charge metadata', {
          chargeId: charge.id,
        });
        return;
      }

      const payment = await PaymentRepository.findByStripePaymentIntentId(
        paymentIntentId,
        tenantId
      );

      if (payment) {
        await PaymentRepository.updateStatus(payment.id, tenantId, PaymentStatus.FAILED, {
          stripe_charge_id: charge.id,
          failure_code: charge.failure_code || undefined,
          failure_message: charge.failure_message || undefined,
        });

        logger.info('Payment marked as failed with charge details', {
          paymentId: payment.id,
          tenantId,
          chargeId: charge.id,
          failureCode: charge.failure_code,
        });
      }
    } catch (error) {
      logger.error('Error handling charge.failed', {
        error,
        chargeId: charge.id,
      });
      throw error;
    }
  }

  /**
   * Handle charge.refunded event
   */
  private static async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    try {
      const paymentIntentId = charge.payment_intent as string;

      if (!paymentIntentId) {
        logger.debug('Charge without payment intent', { chargeId: charge.id });
        return;
      }

      const tenantId = charge.metadata.tenant_id;

      if (!tenantId) {
        logger.warn('No tenant_id in charge metadata', {
          chargeId: charge.id,
        });
        return;
      }

      // Update refund statuses
      for (const stripeRefund of charge.refunds?.data || []) {
        const refund = await RefundRepository.findByStripeRefundId(stripeRefund.id, tenantId);

        if (refund) {
          const status =
            stripeRefund.status === 'succeeded'
              ? RefundStatus.SUCCEEDED
              : stripeRefund.status === 'failed'
              ? RefundStatus.FAILED
              : RefundStatus.PENDING;

          await RefundRepository.updateStatus(
            refund.id,
            tenantId,
            status,
            stripeRefund.failure_reason || undefined
          );

          logger.info('Refund status updated', {
            refundId: refund.id,
            tenantId,
            stripeRefundId: stripeRefund.id,
            status,
          });
        }
      }
    } catch (error) {
      logger.error('Error handling charge.refunded', {
        error,
        chargeId: charge.id,
      });
      throw error;
    }
  }
}
