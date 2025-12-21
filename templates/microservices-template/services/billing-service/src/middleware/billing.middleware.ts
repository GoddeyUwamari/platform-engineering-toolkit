/**
 * Billing Middleware
 * Validation middleware for billing operations (invoices, subscriptions, payments)
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/utils/logger';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import { UserRole } from '@shared/types';
import { InvoiceStatus } from '../models/invoice.model';
import { InvoiceItemType } from '../models/invoice-item.model';
import { SubscriptionStatus, BillingCycle } from '../models/tenant-subscription.model';

// ============================================================================
// Configuration
// ============================================================================

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'];
const MAX_AMOUNT = 999999999.99; // Max amount: ~1 billion
const MIN_AMOUNT = 0.01; // Minimum billable amount
const MAX_BATCH_SIZE = 100; // Maximum batch operations

// ============================================================================
// General Validation Helpers
// ============================================================================

/**
 * Validate that user is authenticated
 */
const requireAuthentication = (req: Request): void => {
  if (!req.user || !req.user.tenantId || !req.user.userId) {
    throw new AuthenticationError('User not authenticated');
  }
};

/**
 * Validate currency code
 */
const validateCurrency = (currency: string): void => {
  if (!currency) {
    throw new ValidationError('Currency is required');
  }

  const upperCurrency = currency.toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(upperCurrency)) {
    throw new ValidationError(
      `Currency "${currency}" is not supported. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`
    );
  }
};

/**
 * Validate amount
 */
const validateAmount = (amount: number, fieldName: string = 'Amount'): void => {
  if (typeof amount !== 'number') {
    throw new ValidationError(`${fieldName} must be a number`);
  }

  if (isNaN(amount)) {
    throw new ValidationError(`${fieldName} is not a valid number`);
  }

  if (!isFinite(amount)) {
    throw new ValidationError(`${fieldName} must be finite`);
  }

  if (amount < 0) {
    throw new ValidationError(`${fieldName} cannot be negative`);
  }

  if (amount > MAX_AMOUNT) {
    throw new ValidationError(`${fieldName} exceeds maximum allowed value of ${MAX_AMOUNT}`);
  }

  // Check decimal places (max 2)
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    throw new ValidationError(`${fieldName} cannot have more than 2 decimal places`);
  }
};

/**
 * Validate positive amount (for payments, charges)
 */
const validatePositiveAmount = (amount: number, fieldName: string = 'Amount'): void => {
  validateAmount(amount, fieldName);

  if (amount < MIN_AMOUNT) {
    throw new ValidationError(`${fieldName} must be at least ${MIN_AMOUNT}`);
  }
};

/**
 * Validate date
 */
const validateDate = (date: any, fieldName: string): void => {
  if (!date) {
    throw new ValidationError(`${fieldName} is required`);
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    throw new ValidationError(`${fieldName} is not a valid date`);
  }
};

/**
 * Validate date range
 */
const validateDateRange = (startDate: any, endDate: any): void => {
  validateDate(startDate, 'Start date');
  validateDate(endDate, 'End date');

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    throw new ValidationError('End date must be after start date');
  }
};

// ============================================================================
// Invoice Validation Middleware
// ============================================================================

/**
 * Validate invoice creation data
 * POST /api/billing/invoices
 */
export const validateInvoiceCreation = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { periodStart, periodEnd, dueDate, currency, subscriptionId } = req.body;

    // Validate required fields
    if (!periodStart) {
      throw new ValidationError('Period start date is required');
    }

    if (!periodEnd) {
      throw new ValidationError('Period end date is required');
    }

    if (!dueDate) {
      throw new ValidationError('Due date is required');
    }

    // Validate dates
    validateDateRange(periodStart, periodEnd);
    validateDate(dueDate, 'Due date');

    // Validate due date is in the future
    const dueDateObj = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dueDateObj < today) {
      logger.warn('Invoice due date is in the past', {
        dueDate: dueDateObj,
        tenantId: req.user?.tenantId,
      });
      // Warning only, not blocking
    }

    // Validate currency if provided
    if (currency) {
      validateCurrency(currency);
    }

    // Validate subscription ID format if provided
    if (subscriptionId && typeof subscriptionId !== 'string') {
      throw new ValidationError('Subscription ID must be a string');
    }

    logger.debug('Invoice creation validation passed', {
      tenantId: req.user?.tenantId,
      userId: req.user?.userId,
    });

    next();
  }
);

/**
 * Validate invoice update data
 * PATCH /api/billing/invoices/:id
 */
export const validateInvoiceUpdate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { status, dueDate, notes, discountAmount } = req.body;

    // Must have at least one field to update
    if (Object.keys(req.body).length === 0) {
      throw new ValidationError('At least one field is required to update');
    }

    // Validate status if provided
    if (status !== undefined) {
      const validStatuses = Object.values(InvoiceStatus);
      if (!validStatuses.includes(status)) {
        throw new ValidationError(
          `Invalid invoice status. Valid values: ${validStatuses.join(', ')}`
        );
      }
    }

    // Validate due date if provided
    if (dueDate !== undefined) {
      validateDate(dueDate, 'Due date');
    }

    // Validate notes if provided
    if (notes !== undefined && typeof notes !== 'string') {
      throw new ValidationError('Notes must be a string');
    }

    if (notes && notes.length > 5000) {
      throw new ValidationError('Notes cannot exceed 5000 characters');
    }

    // Validate discount amount if provided
    if (discountAmount !== undefined) {
      validateAmount(discountAmount, 'Discount amount');
    }

    logger.debug('Invoice update validation passed', {
      tenantId: req.user?.tenantId,
      invoiceId: req.params.id,
    });

    next();
  }
);

/**
 * Validate invoice item data
 * POST /api/billing/invoices/:id/items
 */
export const validateInvoiceItem = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { description, itemType, quantity, unitPrice, taxRate, metadata } = req.body;

    // Validate required fields
    if (!description || description.trim() === '') {
      throw new ValidationError('Description is required');
    }

    if (description.length > 500) {
      throw new ValidationError('Description cannot exceed 500 characters');
    }

    if (!itemType) {
      throw new ValidationError('Item type is required');
    }

    const validItemTypes = Object.values(InvoiceItemType);
    if (!validItemTypes.includes(itemType)) {
      throw new ValidationError(
        `Invalid item type. Valid values: ${validItemTypes.join(', ')}`
      );
    }

    if (quantity === undefined || quantity === null) {
      throw new ValidationError('Quantity is required');
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      throw new ValidationError('Quantity must be a positive number');
    }

    if (quantity > 1000000) {
      throw new ValidationError('Quantity cannot exceed 1,000,000');
    }

    if (unitPrice === undefined || unitPrice === null) {
      throw new ValidationError('Unit price is required');
    }

    if (typeof unitPrice !== 'number') {
      throw new ValidationError('Unit price must be a number');
    }

    // Allow negative unit prices for credits/discounts
    if (itemType === InvoiceItemType.CREDIT || itemType === InvoiceItemType.DISCOUNT) {
      if (unitPrice > 0) {
        logger.warn('Credit/discount item has positive unit price, will be negated', {
          itemType,
          unitPrice,
        });
      }
    } else {
      if (unitPrice < 0) {
        throw new ValidationError('Unit price cannot be negative for this item type');
      }
    }

    // Validate tax rate if provided
    if (taxRate !== undefined && taxRate !== null) {
      if (typeof taxRate !== 'number') {
        throw new ValidationError('Tax rate must be a number');
      }

      if (taxRate < 0 || taxRate > 100) {
        throw new ValidationError('Tax rate must be between 0 and 100');
      }
    }

    // Validate metadata if provided
    if (metadata !== undefined) {
      if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
        throw new ValidationError('Metadata must be an object');
      }

      const metadataStr = JSON.stringify(metadata);
      if (metadataStr.length > 10000) {
        throw new ValidationError('Metadata cannot exceed 10KB');
      }
    }

    logger.debug('Invoice item validation passed', {
      tenantId: req.user?.tenantId,
      invoiceId: req.params.id,
      itemType,
    });

    next();
  }
);

/**
 * Validate payment recording
 * POST /api/billing/invoices/:id/payment
 */
export const validatePaymentRecord = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { amount, paymentMethod, paymentReference } = req.body;

    // Validate amount
    if (!amount) {
      throw new ValidationError('Payment amount is required');
    }

    validatePositiveAmount(amount, 'Payment amount');

    // Validate payment method if provided
    if (paymentMethod !== undefined) {
      if (typeof paymentMethod !== 'string') {
        throw new ValidationError('Payment method must be a string');
      }

      if (paymentMethod.trim() === '') {
        throw new ValidationError('Payment method cannot be empty');
      }

      if (paymentMethod.length > 50) {
        throw new ValidationError('Payment method cannot exceed 50 characters');
      }
    }

    // Validate payment reference if provided
    if (paymentReference !== undefined) {
      if (typeof paymentReference !== 'string') {
        throw new ValidationError('Payment reference must be a string');
      }

      if (paymentReference.length > 255) {
        throw new ValidationError('Payment reference cannot exceed 255 characters');
      }
    }

    logger.debug('Payment record validation passed', {
      tenantId: req.user?.tenantId,
      invoiceId: req.params.id,
      amount,
    });

    next();
  }
);

// ============================================================================
// Subscription Validation Middleware
// ============================================================================

/**
 * Validate subscription creation data
 * POST /api/billing/subscriptions
 */
export const validateSubscriptionCreation = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const {
      planId,
      billingCycle,
      currentPrice,
      currency,
      currentPeriodEnd,
      startedAt,
      currentPeriodStart,
      isTrial,
      trialEndsAt,
    } = req.body;

    // Validate required fields
    if (!planId || typeof planId !== 'string' || planId.trim() === '') {
      throw new ValidationError('Plan ID is required');
    }

    if (!billingCycle) {
      throw new ValidationError('Billing cycle is required');
    }

    const validBillingCycles = Object.values(BillingCycle);
    if (!validBillingCycles.includes(billingCycle)) {
      throw new ValidationError(
        `Invalid billing cycle. Valid values: ${validBillingCycles.join(', ')}`
      );
    }

    if (currentPrice === undefined || currentPrice === null) {
      throw new ValidationError('Current price is required');
    }

    validateAmount(currentPrice, 'Current price');

    if (!currentPeriodEnd) {
      throw new ValidationError('Current period end is required');
    }

    validateDate(currentPeriodEnd, 'Current period end');

    // Validate currency if provided
    if (currency) {
      validateCurrency(currency);
    }

    // Validate period dates if provided
    if (startedAt) {
      validateDate(startedAt, 'Started at');
    }

    if (currentPeriodStart) {
      validateDate(currentPeriodStart, 'Current period start');
    }

    if (currentPeriodStart && currentPeriodEnd) {
      validateDateRange(currentPeriodStart, currentPeriodEnd);
    }

    // Validate trial settings
    if (isTrial) {
      if (!trialEndsAt) {
        throw new ValidationError('Trial end date is required when is_trial is true');
      }

      validateDate(trialEndsAt, 'Trial ends at');

      const trialEnd = new Date(trialEndsAt);
      const now = new Date();

      if (trialEnd <= now) {
        throw new ValidationError('Trial end date must be in the future');
      }
    }

    logger.debug('Subscription creation validation passed', {
      tenantId: req.user?.tenantId,
      userId: req.user?.userId,
      planId,
    });

    next();
  }
);

/**
 * Validate subscription update data
 * PATCH /api/billing/subscriptions/:id
 */
export const validateSubscriptionUpdate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { status, currentPrice, currentPeriodStart, currentPeriodEnd, autoRenew } = req.body;

    // Must have at least one field to update
    if (Object.keys(req.body).length === 0) {
      throw new ValidationError('At least one field is required to update');
    }

    // Validate status if provided
    if (status !== undefined) {
      const validStatuses = Object.values(SubscriptionStatus);
      if (!validStatuses.includes(status)) {
        throw new ValidationError(
          `Invalid subscription status. Valid values: ${validStatuses.join(', ')}`
        );
      }
    }

    // Validate current price if provided
    if (currentPrice !== undefined) {
      validateAmount(currentPrice, 'Current price');
    }

    // Validate dates if provided
    if (currentPeriodStart !== undefined) {
      validateDate(currentPeriodStart, 'Current period start');
    }

    if (currentPeriodEnd !== undefined) {
      validateDate(currentPeriodEnd, 'Current period end');
    }

    if (currentPeriodStart !== undefined && currentPeriodEnd !== undefined) {
      validateDateRange(currentPeriodStart, currentPeriodEnd);
    }

    // Validate auto-renew if provided
    if (autoRenew !== undefined && typeof autoRenew !== 'boolean') {
      throw new ValidationError('Auto-renew must be a boolean');
    }

    logger.debug('Subscription update validation passed', {
      tenantId: req.user?.tenantId,
      subscriptionId: req.params.id,
    });

    next();
  }
);

/**
 * Validate plan change
 * POST /api/billing/subscriptions/:id/change-plan
 */
export const validatePlanChange = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { planId } = req.body;

    if (!planId || typeof planId !== 'string' || planId.trim() === '') {
      throw new ValidationError('New plan ID is required');
    }

    logger.debug('Plan change validation passed', {
      tenantId: req.user?.tenantId,
      subscriptionId: req.params.id,
      newPlanId: planId,
    });

    next();
  }
);

/**
 * Validate cancellation request
 * POST /api/billing/subscriptions/:id/cancel
 */
export const validateCancellation = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { immediately } = req.body;

    // Validate immediately flag if provided
    if (immediately !== undefined && typeof immediately !== 'boolean') {
      throw new ValidationError('Immediately flag must be a boolean');
    }

    logger.debug('Cancellation validation passed', {
      tenantId: req.user?.tenantId,
      subscriptionId: req.params.id,
      immediately: immediately === true,
    });

    next();
  }
);

// ============================================================================
// Usage Tracking Validation Middleware
// ============================================================================

/**
 * Validate usage record creation
 * POST /api/billing/usage
 */
export const validateUsageRecord = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { usageType, quantity, unit, periodStart, periodEnd, subscriptionId } = req.body;

    // Validate required fields
    if (!usageType || typeof usageType !== 'string' || usageType.trim() === '') {
      throw new ValidationError('Usage type is required');
    }

    if (usageType.length > 100) {
      throw new ValidationError('Usage type cannot exceed 100 characters');
    }

    if (quantity === undefined || quantity === null) {
      throw new ValidationError('Quantity is required');
    }

    if (typeof quantity !== 'number' || quantity < 0) {
      throw new ValidationError('Quantity must be a non-negative number');
    }

    if (quantity > 1000000000) {
      throw new ValidationError('Quantity exceeds maximum allowed value');
    }

    if (!unit || typeof unit !== 'string' || unit.trim() === '') {
      throw new ValidationError('Unit is required');
    }

    if (unit.length > 50) {
      throw new ValidationError('Unit cannot exceed 50 characters');
    }

    if (!periodStart) {
      throw new ValidationError('Period start is required');
    }

    if (!periodEnd) {
      throw new ValidationError('Period end is required');
    }

    validateDateRange(periodStart, periodEnd);

    // Validate subscription ID if provided
    if (subscriptionId && typeof subscriptionId !== 'string') {
      throw new ValidationError('Subscription ID must be a string');
    }

    logger.debug('Usage record validation passed', {
      tenantId: req.user?.tenantId,
      usageType,
      quantity,
    });

    next();
  }
);

/**
 * Validate batch usage records
 * POST /api/billing/usage/batch
 */
export const validateBatchUsage = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { records } = req.body;

    if (!records || !Array.isArray(records)) {
      throw new ValidationError('Records array is required');
    }

    if (records.length === 0) {
      throw new ValidationError('Records array cannot be empty');
    }

    if (records.length > MAX_BATCH_SIZE) {
      throw new ValidationError(
        `Cannot process more than ${MAX_BATCH_SIZE} records at once`
      );
    }

    // Validate each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      if (!record.usageType) {
        throw new ValidationError(`Record at index ${i}: Usage type is required`);
      }

      if (record.quantity === undefined || record.quantity === null) {
        throw new ValidationError(`Record at index ${i}: Quantity is required`);
      }

      if (typeof record.quantity !== 'number' || record.quantity < 0) {
        throw new ValidationError(
          `Record at index ${i}: Quantity must be a non-negative number`
        );
      }

      if (!record.unit) {
        throw new ValidationError(`Record at index ${i}: Unit is required`);
      }

      if (!record.periodStart || !record.periodEnd) {
        throw new ValidationError(`Record at index ${i}: Period dates are required`);
      }

      const start = new Date(record.periodStart);
      const end = new Date(record.periodEnd);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ValidationError(`Record at index ${i}: Invalid period dates`);
      }

      if (end <= start) {
        throw new ValidationError(
          `Record at index ${i}: Period end must be after period start`
        );
      }
    }

    logger.debug('Batch usage validation passed', {
      tenantId: req.user?.tenantId,
      recordCount: records.length,
    });

    next();
  }
);

// ============================================================================
// Authorization Middleware (Role-Based)
// ============================================================================

/**
 * Require billing admin role or higher
 */
export const requireBillingAdmin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BILLING_ADMIN];

    if (!allowedRoles.includes(req.user!.role)) {
      logger.warn('Billing operation denied - insufficient permissions', {
        userId: req.user!.userId,
        userRole: req.user!.role,
        requiredRoles: allowedRoles,
      });

      throw new AuthorizationError(
        'Access denied. Billing admin privileges required.'
      );
    }

    logger.debug('Billing admin authorization successful', {
      userId: req.user!.userId,
      userRole: req.user!.role,
    });

    next();
  }
);

/**
 * Require admin role for sensitive operations
 */
export const requireAdmin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

    if (!allowedRoles.includes(req.user!.role)) {
      logger.warn('Admin operation denied - insufficient permissions', {
        userId: req.user!.userId,
        userRole: req.user!.role,
        requiredRoles: allowedRoles,
      });

      throw new AuthorizationError('Access denied. Admin privileges required.');
    }

    next();
  }
);

// ============================================================================
// Export
// ============================================================================

export default {
  // Invoice validation
  validateInvoiceCreation,
  validateInvoiceUpdate,
  validateInvoiceItem,
  validatePaymentRecord,

  // Subscription validation
  validateSubscriptionCreation,
  validateSubscriptionUpdate,
  validatePlanChange,
  validateCancellation,

  // Usage validation
  validateUsageRecord,
  validateBatchUsage,

  // Authorization
  requireBillingAdmin,
  requireAdmin,

  // Helpers (exported for testing)
  validateCurrency,
  validateAmount,
  validatePositiveAmount,
  validateDate,
  validateDateRange,
};
