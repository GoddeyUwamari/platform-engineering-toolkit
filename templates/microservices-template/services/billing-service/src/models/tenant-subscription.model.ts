/**
 * Tenant Subscription Model
 * Represents active subscriptions for each tenant
 * Maps to: tenant_subscriptions table
 */

import type { BaseEntity } from '@shared/types';

// ============================================================================
// Enums (matching DB constraints)
// ============================================================================

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  PAST_DUE = 'past_due',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

// ============================================================================
// Tenant Subscription Interface (matches DB schema exactly)
// ============================================================================

export interface TenantSubscription extends BaseEntity {
  // Foreign Keys
  tenantId: string;                   // References tenants(id)
  planId: string;                     // References subscription_plans(id)
  
  // Status & Billing
  status: SubscriptionStatus;         // active, cancelled, expired, suspended, past_due
  billingCycle: BillingCycle;         // monthly, yearly
  currentPrice: number;               // Current subscription price (DECIMAL 10,2)
  currency: string;                   // ISO currency code (default: USD)
  
  // Subscription Period
  startedAt: Date | string;           // When subscription started
  currentPeriodStart: Date | string;  // Current billing period start
  currentPeriodEnd: Date | string;    // Current billing period end
  
  // Cancellation & Expiry
  cancelledAt?: Date | string;        // When subscription was cancelled
  expiresAt?: Date | string;          // When subscription expires
  
  // Settings
  autoRenew: boolean;                 // Auto-renewal enabled (default: true)
  
  // Trial
  isTrial: boolean;                   // Is this a trial subscription
  trialEndsAt?: Date | string;        // When trial ends
}

// ============================================================================
// Create DTO
// ============================================================================

export interface CreateTenantSubscriptionDTO {
  tenantId: string;
  planId: string;
  billingCycle: BillingCycle;
  currentPrice: number;
  currency?: string;                  // Default: USD
  startedAt?: Date | string;          // Default: now
  currentPeriodStart?: Date | string; // Default: now
  currentPeriodEnd: Date | string;    // Required: calculate based on billing cycle
  autoRenew?: boolean;                // Default: true
  isTrial?: boolean;                  // Default: false
  trialEndsAt?: Date | string;        // Required if isTrial is true
}

// ============================================================================
// Update DTO
// ============================================================================

export interface UpdateTenantSubscriptionDTO {
  status?: SubscriptionStatus;
  currentPrice?: number;              // Update price (e.g., plan change)
  currentPeriodStart?: Date | string;
  currentPeriodEnd?: Date | string;
  cancelledAt?: Date | string;
  expiresAt?: Date | string;
  autoRenew?: boolean;
}

// ============================================================================
// Query Filters
// ============================================================================

export interface TenantSubscriptionFilters {
  tenantId?: string;
  planId?: string;
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  isTrial?: boolean;
  isActive?: boolean;                 // Helper: status === 'active'
  isExpiring?: boolean;               // Helper: expires within X days
}

// ============================================================================
// Database Column Mapping
// ============================================================================

/**
 * Maps database columns to TenantSubscription interface
 * Used for SELECT queries with proper camelCase conversion
 */
export const TENANT_SUBSCRIPTION_COLUMNS = `
  id,
  tenant_id as "tenantId",
  plan_id as "planId",
  status,
  billing_cycle as "billingCycle",
  current_price as "currentPrice",
  currency,
  started_at as "startedAt",
  current_period_start as "currentPeriodStart",
  current_period_end as "currentPeriodEnd",
  cancelled_at as "cancelledAt",
  expires_at as "expiresAt",
  auto_renew as "autoRenew",
  trial_ends_at as "trialEndsAt",
  is_trial as "isTrial",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if subscription is active
 */
export const isActive = (subscription: TenantSubscription): boolean => {
  return subscription.status === SubscriptionStatus.ACTIVE;
};

/**
 * Check if subscription is in trial period
 */
export const isInTrial = (subscription: TenantSubscription): boolean => {
  if (!subscription.isTrial || !subscription.trialEndsAt) {
    return false;
  }
  const trialEnd = new Date(subscription.trialEndsAt);
  const now = new Date();
  return now < trialEnd;
};

/**
 * Check if subscription is expired
 */
export const isExpired = (subscription: TenantSubscription): boolean => {
  if (subscription.status === SubscriptionStatus.EXPIRED) {
    return true;
  }
  if (subscription.expiresAt) {
    const expiry = new Date(subscription.expiresAt);
    const now = new Date();
    return now > expiry;
  }
  return false;
};

/**
 * Check if subscription is cancelled but still active until period end
 */
export const isCancelledButActive = (subscription: TenantSubscription): boolean => {
  return (
    subscription.status === SubscriptionStatus.CANCELLED &&
    subscription.cancelledAt !== null &&
    new Date() < new Date(subscription.currentPeriodEnd)
  );
};

/**
 * Check if subscription is expiring soon (within X days)
 */
export const isExpiringSoon = (subscription: TenantSubscription, days: number = 7): boolean => {
  if (!subscription.currentPeriodEnd) {
    return false;
  }
  const periodEnd = new Date(subscription.currentPeriodEnd);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry > 0 && daysUntilExpiry <= days;
};

/**
 * Get days remaining in current period
 */
export const getDaysRemaining = (subscription: TenantSubscription): number => {
  const periodEnd = new Date(subscription.currentPeriodEnd);
  const now = new Date();
  const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysRemaining);
};

/**
 * Get days remaining in trial
 */
export const getTrialDaysRemaining = (subscription: TenantSubscription): number | null => {
  if (!subscription.isTrial || !subscription.trialEndsAt) {
    return null;
  }
  const trialEnd = new Date(subscription.trialEndsAt);
  const now = new Date();
  const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysRemaining);
};

// ============================================================================
// Period Calculation Helpers
// ============================================================================

/**
 * Calculate next period end date based on billing cycle
 */
export const calculateNextPeriodEnd = (
  startDate: Date | string,
  billingCycle: BillingCycle
): Date => {
  const start = new Date(startDate);
  const periodEnd = new Date(start);
  
  if (billingCycle === BillingCycle.MONTHLY) {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else if (billingCycle === BillingCycle.YEARLY) {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }
  
  return periodEnd;
};

/**
 * Calculate trial end date (14 days from start)
 */
export const calculateTrialEndDate = (
  startDate: Date | string,
  trialDays: number = 14
): Date => {
  const start = new Date(startDate);
  const trialEnd = new Date(start);
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  return trialEnd;
};

/**
 * Calculate prorated price for mid-cycle changes
 */
export const calculateProratedPrice = (
  fullPrice: number,
  daysUsed: number,
  totalDays: number
): number => {
  if (totalDays === 0) return 0;
  const dailyRate = fullPrice / totalDays;
  const remainingDays = totalDays - daysUsed;
  return Math.max(0, dailyRate * remainingDays);
};

// ============================================================================
// Status Helpers
// ============================================================================

/**
 * Get user-friendly status message
 */
export const getStatusMessage = (subscription: TenantSubscription): string => {
  switch (subscription.status) {
    case SubscriptionStatus.ACTIVE:
      if (isInTrial(subscription)) {
        const daysLeft = getTrialDaysRemaining(subscription);
        return `Active (Trial - ${daysLeft} days remaining)`;
      }
      return 'Active';
    case SubscriptionStatus.CANCELLED:
      if (isCancelledButActive(subscription)) {
        const daysLeft = getDaysRemaining(subscription);
        return `Cancelled (Active until ${daysLeft} days)`;
      }
      return 'Cancelled';
    case SubscriptionStatus.EXPIRED:
      return 'Expired';
    case SubscriptionStatus.SUSPENDED:
      return 'Suspended';
    case SubscriptionStatus.PAST_DUE:
      return 'Past Due';
    default:
      return 'Unknown';
  }
};

/**
 * Check if subscription can be cancelled
 */
export const canCancel = (subscription: TenantSubscription): boolean => {
  return subscription.status === SubscriptionStatus.ACTIVE;
};

/**
 * Check if subscription can be renewed
 */
export const canRenew = (subscription: TenantSubscription): boolean => {
  return (
    subscription.status === SubscriptionStatus.EXPIRED ||
    subscription.status === SubscriptionStatus.CANCELLED
  );
};

/**
 * Check if subscription can be upgraded/downgraded
 */
export const canChangePlan = (subscription: TenantSubscription): boolean => {
  return subscription.status === SubscriptionStatus.ACTIVE;
};