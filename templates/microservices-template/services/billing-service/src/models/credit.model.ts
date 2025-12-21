/**
 * Credit Model
 * Represents account credits and promotional codes
 * Maps to: credits table
 */

import type { BaseEntity } from '@shared/types';

// ============================================================================
// Enums (matching DB constraints)
// ============================================================================

export enum CreditType {
  PROMOTIONAL = 'promotional',       // Promotional credit
  REFUND = 'refund',                 // Refund credit
  ADJUSTMENT = 'adjustment',         // Manual adjustment
  TRIAL = 'trial',                   // Trial credit
}

export enum CreditStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
  VOID = 'void',
}

// ============================================================================
// Credit Interface (matches DB schema exactly)
// ============================================================================

export interface Credit extends BaseEntity {
  // Foreign Key
  tenantId: string;                   // References tenants(id)
  
  // Credit Amounts (DECIMAL 10,2)
  amount: number;                     // Original credit amount
  remainingAmount: number;            // Remaining credit balance
  currency: string;                   // ISO currency code (default: USD)
  
  // Credit Details
  creditType: CreditType;             // promotional, refund, adjustment, trial
  reason?: string;                    // Reason for credit
  
  // Expiration
  expiresAt?: Date | string;          // When credit expires (nullable)
  
  // Status
  status: CreditStatus;               // active, used, expired, void
  
  // References
  invoiceId?: string;                 // References invoices(id) - nullable
  referenceCode?: string;             // External reference code
}

// ============================================================================
// Create DTO
// ============================================================================

export interface CreateCreditDTO {
  tenantId: string;
  amount: number;
  currency?: string;                  // Default: USD
  creditType: CreditType;
  reason?: string;
  expiresAt?: Date | string;
  invoiceId?: string;
  referenceCode?: string;
}

// ============================================================================
// Update DTO
// ============================================================================

export interface UpdateCreditDTO {
  remainingAmount?: number;
  status?: CreditStatus;
  expiresAt?: Date | string;
  reason?: string;
}

// ============================================================================
// Query Filters
// ============================================================================

export interface CreditFilters {
  tenantId?: string;
  creditType?: CreditType;
  status?: CreditStatus;
  minAmount?: number;
  maxAmount?: number;
  isActive?: boolean;                 // status === 'active'
  isExpired?: boolean;                // status === 'expired' or past expiresAt
  hasBalance?: boolean;               // remainingAmount > 0
}

// ============================================================================
// Database Column Mapping
// ============================================================================

/**
 * Maps database columns to Credit interface
 * Used for SELECT queries with proper camelCase conversion
 */
export const CREDIT_COLUMNS = `
  id,
  tenant_id as "tenantId",
  amount,
  remaining_amount as "remainingAmount",
  currency,
  credit_type as "creditType",
  reason,
  expires_at as "expiresAt",
  status,
  invoice_id as "invoiceId",
  reference_code as "referenceCode",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate credit amount (must be positive)
 */
export const isValidAmount = (amount: number): boolean => {
  return amount > 0 && Number.isFinite(amount);
};

/**
 * Validate remaining amount (must be non-negative and <= original amount)
 */
export const isValidRemainingAmount = (remainingAmount: number, originalAmount: number): boolean => {
  return (
    remainingAmount >= 0 &&
    remainingAmount <= originalAmount &&
    Number.isFinite(remainingAmount)
  );
};

/**
 * Check if credit is active
 */
export const isActive = (credit: Credit): boolean => {
  return credit.status === CreditStatus.ACTIVE && !isExpired(credit);
};

/**
 * Check if credit is expired
 */
export const isExpired = (credit: Credit): boolean => {
  if (credit.status === CreditStatus.EXPIRED) {
    return true;
  }
  if (credit.expiresAt) {
    const expiryDate = new Date(credit.expiresAt);
    const now = new Date();
    return now > expiryDate;
  }
  return false;
};

/**
 * Check if credit is fully used
 */
export const isFullyUsed = (credit: Credit): boolean => {
  return credit.remainingAmount === 0 || credit.status === CreditStatus.USED;
};

/**
 * Check if credit has balance
 */
export const hasBalance = (credit: Credit): boolean => {
  return credit.remainingAmount > 0;
};

/**
 * Check if credit can be used
 */
export const canBeUsed = (credit: Credit): boolean => {
  return isActive(credit) && hasBalance(credit);
};

// ============================================================================
// Credit Usage Helpers
// ============================================================================

/**
 * Calculate used amount
 */
export const getUsedAmount = (credit: Credit): number => {
  return credit.amount - credit.remainingAmount;
};

/**
 * Calculate usage percentage
 */
export const getUsagePercentage = (credit: Credit): number => {
  if (credit.amount === 0) return 0;
  const used = getUsedAmount(credit);
  return Math.round((used / credit.amount) * 100 * 100) / 100;
};

/**
 * Apply credit to amount (returns remaining credit and amount after credit applied)
 */
export const applyCredit = (
  credit: Credit,
  amountToApply: number
): { creditUsed: number; remainingCredit: number; remainingAmount: number } => {
  const creditUsed = Math.min(credit.remainingAmount, amountToApply);
  const remainingCredit = credit.remainingAmount - creditUsed;
  const remainingAmount = amountToApply - creditUsed;
  
  return {
    creditUsed: Math.round(creditUsed * 100) / 100,
    remainingCredit: Math.round(remainingCredit * 100) / 100,
    remainingAmount: Math.round(remainingAmount * 100) / 100,
  };
};

/**
 * Apply multiple credits to amount (uses credits in order)
 */
export const applyMultipleCredits = (
  credits: Credit[],
  totalAmount: number
): {
  creditsApplied: Array<{ creditId: string; amountUsed: number; remainingCredit: number }>;
  totalCreditUsed: number;
  remainingAmount: number;
} => {
  let remainingAmount = totalAmount;
  const creditsApplied: Array<{ creditId: string; amountUsed: number; remainingCredit: number }> = [];
  let totalCreditUsed = 0;
  
  // Sort credits by expiration date (use expiring credits first)
  const sortedCredits = [...credits].sort((a, b) => {
    if (!a.expiresAt) return 1;
    if (!b.expiresAt) return -1;
    return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
  });
  
  for (const credit of sortedCredits) {
    if (remainingAmount <= 0 || !canBeUsed(credit)) continue;
    
    const result = applyCredit(credit, remainingAmount);
    
    creditsApplied.push({
      creditId: credit.id,
      amountUsed: result.creditUsed,
      remainingCredit: result.remainingCredit,
    });
    
    totalCreditUsed += result.creditUsed;
    remainingAmount = result.remainingAmount;
  }
  
  return {
    creditsApplied,
    totalCreditUsed: Math.round(totalCreditUsed * 100) / 100,
    remainingAmount: Math.round(remainingAmount * 100) / 100,
  };
};

/**
 * Update credit after usage
 */
export const useCredit = (credit: Credit, amountUsed: number): Partial<Credit> => {
  const newRemainingAmount = credit.remainingAmount - amountUsed;
  const rounded = Math.max(0, Math.round(newRemainingAmount * 100) / 100);
  
  return {
    remainingAmount: rounded,
    status: rounded === 0 ? CreditStatus.USED : credit.status,
  };
};

// ============================================================================
// Expiration Helpers
// ============================================================================

/**
 * Get days until expiration (negative if expired)
 */
export const getDaysUntilExpiration = (credit: Credit): number | null => {
  if (!credit.expiresAt) return null;
  
  const expiryDate = new Date(credit.expiresAt);
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Check if credit is expiring soon (within X days)
 */
export const isExpiringSoon = (credit: Credit, days: number = 7): boolean => {
  const daysUntil = getDaysUntilExpiration(credit);
  return daysUntil !== null && daysUntil > 0 && daysUntil <= days;
};

/**
 * Mark credit as expired
 */
export const markAsExpired = (_credit: Credit): Partial<Credit> => {
  return {
    status: CreditStatus.EXPIRED,
  };
};

// ============================================================================
// Credit Creation Helpers
// ============================================================================

/**
 * Create promotional credit
 */
export const createPromotionalCredit = (
  tenantId: string,
  amount: number,
  reason: string,
  expiresAt?: Date | string,
  referenceCode?: string
): Omit<Credit, 'id' | 'createdAt' | 'updatedAt'> => {
  return {
    tenantId,
    amount,
    remainingAmount: amount,
    currency: 'USD',
    creditType: CreditType.PROMOTIONAL,
    reason,
    expiresAt,
    status: CreditStatus.ACTIVE,
    invoiceId: undefined,
    referenceCode,
  };
};

/**
 * Create refund credit
 */
export const createRefundCredit = (
  tenantId: string,
  amount: number,
  invoiceId: string,
  reason?: string
): Omit<Credit, 'id' | 'createdAt' | 'updatedAt'> => {
  return {
    tenantId,
    amount,
    remainingAmount: amount,
    currency: 'USD',
    creditType: CreditType.REFUND,
    reason,
    expiresAt: undefined,
    status: CreditStatus.ACTIVE,
    invoiceId,
    referenceCode: undefined,
  };
};

/**
 * Create adjustment credit
 */
export const createAdjustmentCredit = (
  tenantId: string,
  amount: number,
  reason: string
): Omit<Credit, 'id' | 'createdAt' | 'updatedAt'> => {
  return {
    tenantId,
    amount,
    remainingAmount: amount,
    currency: 'USD',
    creditType: CreditType.ADJUSTMENT,
    reason,
    expiresAt: undefined,
    status: CreditStatus.ACTIVE,
    invoiceId: undefined,
    referenceCode: undefined,
  };
};

/**
 * Create trial credit
 */
export const createTrialCredit = (
  tenantId: string,
  amount: number,
  trialDays: number = 14
): Omit<Credit, 'id' | 'createdAt' | 'updatedAt'> => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + trialDays);
  
  return {
    tenantId,
    amount,
    remainingAmount: amount,
    currency: 'USD',
    creditType: CreditType.TRIAL,
    reason: `${trialDays}-day trial credit`,
    expiresAt: expiresAt.toISOString(),
    status: CreditStatus.ACTIVE,
    invoiceId: undefined,
    referenceCode: undefined,
  };
};

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format credit amount
 */
export const formatAmount = (amount: number, currency: string = 'USD'): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  return formatter.format(amount);
};

/**
 * Get credit type label
 */
export const getCreditTypeLabel = (creditType: CreditType): string => {
  switch (creditType) {
    case CreditType.PROMOTIONAL:
      return 'Promotional';
    case CreditType.REFUND:
      return 'Refund';
    case CreditType.ADJUSTMENT:
      return 'Adjustment';
    case CreditType.TRIAL:
      return 'Trial';
    default:
      return 'Unknown';
  }
};

/**
 * Get credit status label
 */
export const getStatusLabel = (credit: Credit): string => {
  if (isExpired(credit)) {
    return 'Expired';
  }
  
  switch (credit.status) {
    case CreditStatus.ACTIVE:
      if (isExpiringSoon(credit)) {
        const days = getDaysUntilExpiration(credit);
        return `Active (expires in ${days} days)`;
      }
      return 'Active';
    case CreditStatus.USED:
      return 'Fully Used';
    case CreditStatus.EXPIRED:
      return 'Expired';
    case CreditStatus.VOID:
      return 'Void';
    default:
      return 'Unknown';
  }
};

/**
 * Get credit description
 */
export const getCreditDescription = (credit: Credit): string => {
  const type = getCreditTypeLabel(credit.creditType);
  const amount = formatAmount(credit.remainingAmount, credit.currency);
  const status = getStatusLabel(credit);
  
  return `${type} Credit: ${amount} (${status})`;
};

// ============================================================================
// Aggregation Helpers
// ============================================================================

/**
 * Calculate total available credits for tenant
 */
export const calculateTotalAvailableCredits = (credits: Credit[]): number => {
  const total = credits
    .filter(credit => canBeUsed(credit))
    .reduce((sum, credit) => sum + credit.remainingAmount, 0);
  
  return Math.round(total * 100) / 100;
};

/**
 * Group credits by type
 */
export const groupByType = (credits: Credit[]): Record<CreditType, Credit[]> => {
  return credits.reduce((acc, credit) => {
    if (!acc[credit.creditType]) {
      acc[credit.creditType] = [];
    }
    acc[credit.creditType].push(credit);
    return acc;
  }, {} as Record<CreditType, Credit[]>);
};

/**
 * Get credits summary
 */
export const getCreditsSummary = (credits: Credit[]): {
  totalCredits: number;
  activeCredits: number;
  usedCredits: number;
  expiredCredits: number;
  totalAvailable: number;
  totalUsed: number;
} => {
  return {
    totalCredits: credits.length,
    activeCredits: credits.filter(c => isActive(c)).length,
    usedCredits: credits.filter(c => isFullyUsed(c)).length,
    expiredCredits: credits.filter(c => isExpired(c)).length,
    totalAvailable: calculateTotalAvailableCredits(credits),
    totalUsed: credits.reduce((sum, c) => sum + getUsedAmount(c), 0),
  };
};