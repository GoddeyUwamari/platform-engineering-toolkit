import Stripe from 'stripe';
import { logger } from '@shared/utils/logger';
import { stripeConfig } from '../config/stripe.config';
import { PaymentMethodRepository } from '../repositories/payment-method.repository';
import {
  PaymentMethod,
  PaymentMethodType,
  CreatePaymentMethodRequest,
  UpdatePaymentMethodRequest,
  PaymentMethodResponse,
  PaymentMethodListOptions,
} from '../types/payment.types';

/**
 * Payment Method Service
 * Business logic for payment method operations and Stripe integration
 */

export class PaymentMethodService {
  /**
   * Create a new payment method
   */
  public static async createPaymentMethod(
    tenantId: string,
    stripeCustomerId: string,
    data: CreatePaymentMethodRequest
  ): Promise<PaymentMethodResponse> {
    try {
      const stripe = stripeConfig.getClient();

      // Create Stripe Payment Method
      const paymentMethodData: Stripe.PaymentMethodCreateParams = {
        type: data.type as Stripe.PaymentMethodCreateParams.Type,
        billing_details: data.billing_details,
      };

      if (data.type === PaymentMethodType.CARD && data.card) {
        paymentMethodData.card = {
          number: data.card.number,
          exp_month: data.card.exp_month,
          exp_year: data.card.exp_year,
          cvc: data.card.cvc,
        };
      }

      const stripePaymentMethod = await stripe.paymentMethods.create(paymentMethodData);

      // Attach to customer
      await stripe.paymentMethods.attach(stripePaymentMethod.id, {
        customer: stripeCustomerId,
      });

      // If this should be default, update customer
      if (data.is_default) {
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: stripePaymentMethod.id,
          },
        });

        // Unset other default payment methods
        const existingDefault = await PaymentMethodRepository.findDefault(tenantId);
        if (existingDefault) {
          await PaymentMethodRepository.update(existingDefault.id, tenantId, {
            is_default: false,
          });
        }
      }

      // Store payment method in database
      const paymentMethod = await PaymentMethodRepository.create({
        tenant_id: tenantId,
        stripe_payment_method_id: stripePaymentMethod.id,
        stripe_customer_id: stripeCustomerId,
        type: data.type,
        is_default: data.is_default || false,
        card_brand: stripePaymentMethod.card?.brand,
        card_last4: stripePaymentMethod.card?.last4,
        card_exp_month: stripePaymentMethod.card?.exp_month,
        card_exp_year: stripePaymentMethod.card?.exp_year,
        billing_details: data.billing_details,
      });

      logger.info('Payment method created', {
        tenantId,
        paymentMethodId: paymentMethod.id,
        type: data.type,
        isDefault: data.is_default,
      });

      return this.mapToResponse(paymentMethod);
    } catch (error) {
      logger.error('Error creating payment method', {
        error,
        tenantId,
        type: data.type,
      });
      throw error;
    }
  }

  /**
   * Get payment method by ID
   */
  public static async getPaymentMethodById(
    tenantId: string,
    paymentMethodId: string
  ): Promise<PaymentMethod | null> {
    try {
      return await PaymentMethodRepository.findById(paymentMethodId, tenantId);
    } catch (error) {
      logger.error('Error fetching payment method', {
        error,
        tenantId,
        paymentMethodId,
      });
      throw error;
    }
  }

  /**
   * List payment methods
   */
  public static async listPaymentMethods(
    tenantId: string,
    options: PaymentMethodListOptions = {}
  ): Promise<PaymentMethod[]> {
    try {
      return await PaymentMethodRepository.findAll(tenantId, options);
    } catch (error) {
      logger.error('Error listing payment methods', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Update payment method
   */
  public static async updatePaymentMethod(
    tenantId: string,
    paymentMethodId: string,
    data: UpdatePaymentMethodRequest
  ): Promise<PaymentMethodResponse | null> {
    try {
      const paymentMethod = await PaymentMethodRepository.findById(paymentMethodId, tenantId);

      if (!paymentMethod) {
        return null;
      }

      // Update Stripe payment method if billing details changed
      if (data.billing_details) {
        const stripe = stripeConfig.getClient();
        await stripe.paymentMethods.update(paymentMethod.stripe_payment_method_id, {
          billing_details: data.billing_details,
        });
      }

      // Handle setting as default
      if (data.is_default) {
        await PaymentMethodRepository.setDefault(paymentMethodId, tenantId);

        // Update Stripe customer default payment method
        const stripe = stripeConfig.getClient();
        await stripe.customers.update(paymentMethod.stripe_customer_id, {
          invoice_settings: {
            default_payment_method: paymentMethod.stripe_payment_method_id,
          },
        });
      } else {
        // Regular update
        const updated = await PaymentMethodRepository.update(paymentMethodId, tenantId, data);
        if (!updated) {
          return null;
        }
        return this.mapToResponse(updated);
      }

      const updated = await PaymentMethodRepository.findById(paymentMethodId, tenantId);
      return updated ? this.mapToResponse(updated) : null;
    } catch (error) {
      logger.error('Error updating payment method', {
        error,
        tenantId,
        paymentMethodId,
      });
      throw error;
    }
  }

  /**
   * Delete (detach) payment method
   */
  public static async deletePaymentMethod(
    tenantId: string,
    paymentMethodId: string
  ): Promise<boolean> {
    try {
      const paymentMethod = await PaymentMethodRepository.findById(paymentMethodId, tenantId);

      if (!paymentMethod) {
        return false;
      }

      // Detach from Stripe
      const stripe = stripeConfig.getClient();
      await stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id);

      // Soft delete in database
      const deleted = await PaymentMethodRepository.delete(paymentMethodId, tenantId);

      logger.info('Payment method deleted', {
        tenantId,
        paymentMethodId,
        success: deleted,
      });

      return deleted;
    } catch (error) {
      logger.error('Error deleting payment method', {
        error,
        tenantId,
        paymentMethodId,
      });
      throw error;
    }
  }

  /**
   * Set payment method as default
   */
  public static async setDefaultPaymentMethod(
    tenantId: string,
    paymentMethodId: string
  ): Promise<PaymentMethodResponse | null> {
    try {
      const paymentMethod = await PaymentMethodRepository.findById(paymentMethodId, tenantId);

      if (!paymentMethod) {
        return null;
      }

      // Update database
      await PaymentMethodRepository.setDefault(paymentMethodId, tenantId);

      // Update Stripe customer
      const stripe = stripeConfig.getClient();
      await stripe.customers.update(paymentMethod.stripe_customer_id, {
        invoice_settings: {
          default_payment_method: paymentMethod.stripe_payment_method_id,
        },
      });

      const updated = await PaymentMethodRepository.findById(paymentMethodId, tenantId);
      return updated ? this.mapToResponse(updated) : null;
    } catch (error) {
      logger.error('Error setting default payment method', {
        error,
        tenantId,
        paymentMethodId,
      });
      throw error;
    }
  }

  /**
   * Get default payment method
   */
  public static async getDefaultPaymentMethod(
    tenantId: string
  ): Promise<PaymentMethod | null> {
    try {
      return await PaymentMethodRepository.findDefault(tenantId);
    } catch (error) {
      logger.error('Error fetching default payment method', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Map PaymentMethod to PaymentMethodResponse
   */
  private static mapToResponse(paymentMethod: PaymentMethod): PaymentMethodResponse {
    const response: PaymentMethodResponse = {
      id: paymentMethod.id,
      tenant_id: paymentMethod.tenant_id,
      stripe_payment_method_id: paymentMethod.stripe_payment_method_id,
      type: paymentMethod.type,
      is_default: paymentMethod.is_default,
      billing_details: paymentMethod.billing_details || undefined,
      created_at: paymentMethod.created_at,
    };

    if (paymentMethod.type === PaymentMethodType.CARD && paymentMethod.card_last4) {
      response.card = {
        brand: paymentMethod.card_brand || '',
        last4: paymentMethod.card_last4,
        exp_month: paymentMethod.card_exp_month || 0,
        exp_year: paymentMethod.card_exp_year || 0,
      };
    }

    if (paymentMethod.type === PaymentMethodType.BANK_ACCOUNT && paymentMethod.bank_account_last4) {
      response.bank_account = {
        last4: paymentMethod.bank_account_last4,
        bank_name: paymentMethod.bank_name || '',
      };
    }

    return response;
  }
}
