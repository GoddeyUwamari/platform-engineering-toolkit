/**
 * Payment Validation Middleware
 * Validates payment-related requests
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@shared/middleware/error-handler';
import { PaymentMethodType } from '../types/payment.types';

// ============================================================================
// Payment Intent Validation
// ============================================================================

/**
 * Validate payment intent creation request
 */
export function validatePaymentIntentCreation(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { amount, currency, payment_method_id, invoice_id, subscription_id } = req.body;

  const errors: Record<string, string> = {};

  // Validate amount
  if (amount === undefined || amount === null) {
    errors.amount = 'Amount is required';
  } else if (typeof amount !== 'number') {
    errors.amount = 'Amount must be a number';
  } else if (amount <= 0) {
    errors.amount = 'Amount must be greater than 0';
  } else if (amount > 999999.99) {
    errors.amount = 'Amount exceeds maximum allowed value';
  } else if (!Number.isFinite(amount)) {
    errors.amount = 'Amount must be a valid number';
  }

  // Validate currency
  if (currency && typeof currency !== 'string') {
    errors.currency = 'Currency must be a string';
  } else if (currency && !/^[a-z]{3}$/i.test(currency)) {
    errors.currency = 'Currency must be a 3-letter ISO code (e.g., usd, eur)';
  }

  // Validate payment_method_id if provided
  if (payment_method_id && typeof payment_method_id !== 'string') {
    errors.payment_method_id = 'Payment method ID must be a string';
  }

  // Validate invoice_id if provided
  if (invoice_id && typeof invoice_id !== 'string') {
    errors.invoice_id = 'Invoice ID must be a valid UUID';
  }

  // Validate subscription_id if provided
  if (subscription_id && typeof subscription_id !== 'string') {
    errors.subscription_id = 'Subscription ID must be a valid UUID';
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid payment intent data', errors);
  }

  next();
}

/**
 * Validate payment intent confirmation request
 */
export function validatePaymentConfirmation(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { payment_method_id, return_url } = req.body;
  const errors: Record<string, string> = {};

  // payment_method_id is optional but must be string if provided
  if (payment_method_id && typeof payment_method_id !== 'string') {
    errors.payment_method_id = 'Payment method ID must be a string';
  }

  // return_url is optional but must be valid URL if provided
  if (return_url) {
    if (typeof return_url !== 'string') {
      errors.return_url = 'Return URL must be a string';
    } else {
      try {
        new URL(return_url);
      } catch {
        errors.return_url = 'Return URL must be a valid URL';
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid payment confirmation data', errors);
  }

  next();
}

// ============================================================================
// Payment Method Validation
// ============================================================================

/**
 * Validate payment method creation request
 */
export function validatePaymentMethodCreation(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { stripe_customer_id, type, card, billing_details } = req.body;
  const errors: Record<string, string> = {};

  // Validate stripe_customer_id
  if (!stripe_customer_id) {
    errors.stripe_customer_id = 'Stripe customer ID is required';
  } else if (typeof stripe_customer_id !== 'string') {
    errors.stripe_customer_id = 'Stripe customer ID must be a string';
  }

  // Validate type
  if (!type) {
    errors.type = 'Payment method type is required';
  } else if (!Object.values(PaymentMethodType).includes(type)) {
    errors.type = `Type must be one of: ${Object.values(PaymentMethodType).join(', ')}`;
  }

  // Validate card details if type is card
  if (type === PaymentMethodType.CARD) {
    if (!card) {
      errors.card = 'Card details are required for card payment method';
    } else {
      if (!card.number || typeof card.number !== 'string') {
        errors['card.number'] = 'Card number is required';
      } else if (!/^\d{13,19}$/.test(card.number.replace(/\s/g, ''))) {
        errors['card.number'] = 'Invalid card number format';
      }

      if (!card.exp_month || typeof card.exp_month !== 'number') {
        errors['card.exp_month'] = 'Expiration month is required';
      } else if (card.exp_month < 1 || card.exp_month > 12) {
        errors['card.exp_month'] = 'Expiration month must be between 1 and 12';
      }

      if (!card.exp_year || typeof card.exp_year !== 'number') {
        errors['card.exp_year'] = 'Expiration year is required';
      } else if (card.exp_year < new Date().getFullYear()) {
        errors['card.exp_year'] = 'Card has expired';
      }

      if (!card.cvc || typeof card.cvc !== 'string') {
        errors['card.cvc'] = 'CVC is required';
      } else if (!/^\d{3,4}$/.test(card.cvc)) {
        errors['card.cvc'] = 'CVC must be 3 or 4 digits';
      }
    }
  }

  // Validate billing_details if provided
  if (billing_details && typeof billing_details !== 'object') {
    errors.billing_details = 'Billing details must be an object';
  } else if (billing_details?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billing_details.email)) {
    errors['billing_details.email'] = 'Invalid email format';
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid payment method data', errors);
  }

  next();
}

/**
 * Validate payment method update request
 */
export function validatePaymentMethodUpdate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { billing_details, is_default } = req.body;
  const errors: Record<string, string> = {};

  // At least one field must be provided
  if (!billing_details && is_default === undefined) {
    errors.general = 'At least one field must be provided for update';
  }

  // Validate billing_details if provided
  if (billing_details) {
    if (typeof billing_details !== 'object') {
      errors.billing_details = 'Billing details must be an object';
    } else {
      if (billing_details.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billing_details.email)) {
        errors['billing_details.email'] = 'Invalid email format';
      }

      if (billing_details.phone && typeof billing_details.phone !== 'string') {
        errors['billing_details.phone'] = 'Phone must be a string';
      }
    }
  }

  // Validate is_default if provided
  if (is_default !== undefined && typeof is_default !== 'boolean') {
    errors.is_default = 'is_default must be a boolean';
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid payment method update data', errors);
  }

  next();
}

// ============================================================================
// Refund Validation
// ============================================================================

/**
 * Validate refund creation request
 */
export function validateRefundCreation(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { payment_id, amount, reason } = req.body;
  const errors: Record<string, string> = {};

  // Validate payment_id
  if (!payment_id) {
    errors.payment_id = 'Payment ID is required';
  } else if (typeof payment_id !== 'string') {
    errors.payment_id = 'Payment ID must be a string';
  }

  // Validate amount if provided (optional for full refund)
  if (amount !== undefined && amount !== null) {
    if (typeof amount !== 'number') {
      errors.amount = 'Amount must be a number';
    } else if (amount <= 0) {
      errors.amount = 'Amount must be greater than 0';
    } else if (!Number.isFinite(amount)) {
      errors.amount = 'Amount must be a valid number';
    }
  }

  // Validate reason if provided
  if (reason) {
    if (typeof reason !== 'string') {
      errors.reason = 'Reason must be a string';
    } else if (!['duplicate', 'fraudulent', 'requested_by_customer'].includes(reason)) {
      errors.reason = 'Reason must be one of: duplicate, fraudulent, requested_by_customer';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid refund data', errors);
  }

  next();
}

// ============================================================================
// Query Parameter Validation
// ============================================================================

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { limit, offset } = req.query;
  const errors: Record<string, string> = {};

  if (limit) {
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      errors.limit = 'Limit must be a positive integer';
    } else if (limitNum > 100) {
      errors.limit = 'Limit cannot exceed 100';
    }
  }

  if (offset) {
    const offsetNum = parseInt(offset as string, 10);
    if (isNaN(offsetNum) || offsetNum < 0) {
      errors.offset = 'Offset must be a non-negative integer';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid pagination parameters', errors);
  }

  next();
}

/**
 * Validate filter parameters for payments
 */
export function validatePaymentFilters(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { status, start_date, end_date } = req.query;
  const errors: Record<string, string> = {};

  // Validate status if provided
  if (status && typeof status === 'string') {
    const validStatuses = ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'requires_action'];
    if (!validStatuses.includes(status)) {
      errors.status = `Status must be one of: ${validStatuses.join(', ')}`;
    }
  }

  // Validate dates if provided
  if (start_date) {
    const date = new Date(start_date as string);
    if (isNaN(date.getTime())) {
      errors.start_date = 'Invalid start date format';
    }
  }

  if (end_date) {
    const date = new Date(end_date as string);
    if (isNaN(date.getTime())) {
      errors.end_date = 'Invalid end date format';
    }
  }

  if (start_date && end_date) {
    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);
    if (startDate > endDate) {
      errors.date_range = 'Start date must be before end date';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid filter parameters', errors);
  }

  next();
}

// ============================================================================
// UUID Parameter Validation
// ============================================================================

/**
 * Validate UUID parameter
 */
export function validateUUIDParam(paramName: string = 'id') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const paramValue = req.params[paramName];

    if (!paramValue) {
      throw new ValidationError(`${paramName} is required`);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(paramValue)) {
      throw new ValidationError(`Invalid ${paramName} format. Must be a valid UUID.`);
    }

    next();
  };
}

/**
 * Validate Stripe ID parameter (starts with specific prefix)
 */
export function validateStripeIdParam(paramName: string = 'id', prefix: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const paramValue = req.params[paramName];

    if (!paramValue) {
      throw new ValidationError(`${paramName} is required`);
    }

    if (!paramValue.startsWith(prefix)) {
      throw new ValidationError(`Invalid ${paramName} format. Must start with '${prefix}'.`);
    }

    next();
  };
}
