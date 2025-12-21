/**
 * Stripe Helper Utilities
 * Common utility functions for Stripe operations
 */

import Stripe from 'stripe';
import { logger } from '@shared/utils/logger';
import { PaymentStatus, RefundStatus } from '../types/payment.types';

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Check if error is a Stripe error
 */
export function isStripeError(error: any): error is Stripe.StripeRawError {
  return error && error.type && typeof error.type === 'string';
}

/**
 * Extract error message from Stripe error
 */
export function extractStripeErrorMessage(error: any): string {
  if (isStripeError(error)) {
    return error.message || 'An error occurred with the payment processor';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error occurred';
}

/**
 * Get user-friendly error message from Stripe error
 */
export function getUserFriendlyErrorMessage(error: any): string {
  if (!isStripeError(error)) {
    return 'An unexpected error occurred. Please try again.';
  }

  const errorCode = error.code;

  const errorMessages: Record<string, string> = {
    // Card errors
    card_declined: 'Your card was declined. Please try a different payment method.',
    expired_card: 'Your card has expired. Please use a different card.',
    incorrect_cvc: 'The security code (CVC) is incorrect. Please check and try again.',
    incorrect_number: 'The card number is incorrect. Please check and try again.',
    insufficient_funds: 'Your card has insufficient funds. Please use a different card.',
    invalid_cvc: 'The security code (CVC) is invalid.',
    invalid_expiry_month: 'The expiration month is invalid.',
    invalid_expiry_year: 'The expiration year is invalid.',
    invalid_number: 'The card number is invalid.',

    // Processing errors
    processing_error: 'An error occurred while processing your card. Please try again.',
    rate_limit: 'Too many requests. Please try again in a moment.',

    // API errors
    api_key_expired: 'Payment system configuration error. Please contact support.',
    authentication_required: 'Additional authentication is required.',
    balance_insufficient: 'Insufficient balance to complete this transaction.',

    // Resource errors
    resource_missing: 'The requested resource was not found.',
    payment_intent_authentication_failure: 'Payment authentication failed. Please try again.',
    payment_method_unactivated: 'This payment method is not activated.',
  };

  return (errorCode ? errorMessages[errorCode] : undefined) || error.message || 'Payment processing failed. Please try again.';
}

/**
 * Log Stripe error with context
 */
export function logStripeError(
  error: any,
  context: {
    operation: string;
    tenantId?: string;
    paymentIntentId?: string;
    customerId?: string;
  }
): void {
  if (isStripeError(error)) {
    logger.error('Stripe API error', {
      service: 'payment-service',
      operation: context.operation,
      tenantId: context.tenantId,
      errorType: error.type,
      errorCode: error.code,
      errorMessage: error.message,
      declineCode: error.decline_code,
      paymentIntentId: context.paymentIntentId,
      customerId: context.customerId,
    });
  } else {
    logger.error('Stripe operation error', {
      service: 'payment-service',
      operation: context.operation,
      tenantId: context.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// Amount Conversion
// ============================================================================

/**
 * Convert dollar amount to cents for Stripe
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents from Stripe to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Validate amount is within Stripe limits
 */
export function validateStripeAmount(amount: number, currency: string = 'usd'): {
  isValid: boolean;
  error?: string;
} {
  const cents = dollarsToCents(amount);

  // Minimum amounts per currency (in cents)
  const minimumAmounts: Record<string, number> = {
    usd: 50,   // $0.50
    eur: 50,   // €0.50
    gbp: 30,   // £0.30
    cad: 50,   // C$0.50
    aud: 50,   // A$0.50
    jpy: 50,   // ¥50
  };

  const minimum = minimumAmounts[currency.toLowerCase()] || 50;

  if (cents < minimum) {
    return {
      isValid: false,
      error: `Amount must be at least ${centsToDollars(minimum)} ${currency.toUpperCase()}`,
    };
  }

  // Stripe maximum is 999,999.99
  if (cents > 99999999) {
    return {
      isValid: false,
      error: 'Amount exceeds maximum allowed value',
    };
  }

  return { isValid: true };
}

// ============================================================================
// Metadata Handling
// ============================================================================

/**
 * Sanitize metadata for Stripe (max 50 keys, 500 char values)
 */
export function sanitizeStripeMetadata(
  metadata: Record<string, any>
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const keys = Object.keys(metadata).slice(0, 50); // Max 50 keys

  for (const key of keys) {
    const value = metadata[key];

    if (value !== null && value !== undefined) {
      // Convert to string and truncate to 500 chars
      const stringValue = String(value).substring(0, 500);
      sanitized[key] = stringValue;
    }
  }

  return sanitized;
}

/**
 * Merge tenant metadata with custom metadata
 */
export function mergeTenantMetadata(
  tenantId: string,
  customMetadata?: Record<string, any>
): Record<string, string> {
  const baseMetadata = {
    tenant_id: tenantId,
    created_by: 'cloudbill',
    timestamp: new Date().toISOString(),
  };

  if (!customMetadata) {
    return baseMetadata;
  }

  return {
    ...baseMetadata,
    ...sanitizeStripeMetadata(customMetadata),
  };
}

// ============================================================================
// Status Mapping
// ============================================================================

/**
 * Map Stripe payment intent status to internal status
 */
export function mapStripePaymentStatus(
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

/**
 * Map Stripe refund status to internal status
 */
export function mapStripeRefundStatus(
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

// ============================================================================
// Idempotency
// ============================================================================

/**
 * Generate idempotency key for Stripe requests
 */
export function generateIdempotencyKey(prefix: string = 'payment'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}_${random}`;
}

// ============================================================================
// Customer Management
// ============================================================================

/**
 * Extract customer ID from Stripe object
 */
export function extractCustomerId(
  stripeObject: Stripe.PaymentIntent | Stripe.Charge | Stripe.PaymentMethod
): string | null {
  if ('customer' in stripeObject) {
    const customer = stripeObject.customer;
    return typeof customer === 'string' ? customer : customer?.id || null;
  }
  return null;
}

// ============================================================================
// Payment Method Helpers
// ============================================================================

/**
 * Get payment method details summary
 */
export function getPaymentMethodSummary(
  paymentMethod: Stripe.PaymentMethod
): {
  type: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
} {
  const summary: any = {
    type: paymentMethod.type,
  };

  if (paymentMethod.card) {
    summary.brand = paymentMethod.card.brand;
    summary.last4 = paymentMethod.card.last4;
    summary.expMonth = paymentMethod.card.exp_month;
    summary.expYear = paymentMethod.card.exp_year;
  }

  if (paymentMethod.us_bank_account) {
    summary.bankName = paymentMethod.us_bank_account.bank_name;
    summary.last4 = paymentMethod.us_bank_account.last4;
  }

  return summary;
}

/**
 * Check if payment method is expired
 */
export function isPaymentMethodExpired(expMonth: number, expYear: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 0-indexed

  if (expYear < currentYear) {
    return true;
  }

  if (expYear === currentYear && expMonth < currentMonth) {
    return true;
  }

  return false;
}

// ============================================================================
// Webhook Validation
// ============================================================================

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  stripe: Stripe
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    logger.error('Webhook signature verification failed', {
      service: 'payment-service',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Retry Stripe operation with exponential backoff
 */
export async function retryStripeOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      if (isStripeError(error)) {
        const nonRetryableCodes = [
          'card_declined',
          'expired_card',
          'incorrect_cvc',
          'incorrect_number',
          'invalid_number',
          'authentication_required',
        ];

        if (error.code && nonRetryableCodes.includes(error.code)) {
          throw error;
        }
      }

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
        logger.info('Retrying Stripe operation', {
          service: 'payment-service',
          attempt: attempt + 1,
          maxRetries,
          delay,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Currency Helpers
// ============================================================================

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    usd: '$',
    eur: '€',
    gbp: '£',
    cad: 'C$',
    aud: 'A$',
    jpy: '¥',
    inr: '₹',
  };

  return symbols[currency.toLowerCase()] || currency.toUpperCase();
}

/**
 * Get currency display name
 */
export function getCurrencyName(currency: string): string {
  const names: Record<string, string> = {
    usd: 'US Dollar',
    eur: 'Euro',
    gbp: 'British Pound',
    cad: 'Canadian Dollar',
    aud: 'Australian Dollar',
    jpy: 'Japanese Yen',
    inr: 'Indian Rupee',
  };

  return names[currency.toLowerCase()] || currency.toUpperCase();
}

/**
 * Check if currency is zero-decimal (doesn't use cents)
 */
export function isZeroDecimalCurrency(currency: string): boolean {
  const zeroDecimalCurrencies = ['jpy', 'krw', 'vnd', 'clp'];
  return zeroDecimalCurrencies.includes(currency.toLowerCase());
}
