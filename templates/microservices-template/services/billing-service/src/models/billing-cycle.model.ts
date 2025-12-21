/**
 * Billing Cycle Model
 * Represents billing period tracking for subscriptions
 * Maps to: billing_cycles table
 */

import type { BaseEntity } from '@shared/types';

// ============================================================================
// Enums (matching DB constraints)
// ============================================================================

export enum BillingCycleStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// ============================================================================
// Billing Cycle Interface (matches DB schema exactly)
// ============================================================================

export interface BillingCycle extends BaseEntity {
  // Foreign Keys
  tenantId: string;                   // References tenants(id)
  subscriptionId: string;             // References tenant_subscriptions(id)
  
  // Cycle Period
  cycleStart: Date | string;          // Start of billing cycle
  cycleEnd: Date | string;            // End of billing cycle
  
  // Status
  status: BillingCycleStatus;         // active, completed, cancelled
  
  // Invoice Link
  invoiceId?: string;                 // References invoices(id) - nullable
}

// ============================================================================
// Create DTO
// ============================================================================

export interface CreateBillingCycleDTO {
  tenantId: string;
  subscriptionId: string;
  cycleStart: Date | string;
  cycleEnd: Date | string;
  status?: BillingCycleStatus;        // Default: active
}

// ============================================================================
// Update DTO
// ============================================================================

export interface UpdateBillingCycleDTO {
  status?: BillingCycleStatus;
  invoiceId?: string;
  cycleEnd?: Date | string;           // May need to adjust cycle end
}

// ============================================================================
// Query Filters
// ============================================================================

export interface BillingCycleFilters {
  tenantId?: string;
  subscriptionId?: string;
  status?: BillingCycleStatus;
  cycleStart?: Date | string;
  cycleEnd?: Date | string;
  hasInvoice?: boolean;               // Filter cycles with/without invoice
  isActive?: boolean;                 // status === 'active'
  isCompleted?: boolean;              // status === 'completed'
}

// ============================================================================
// Database Column Mapping
// ============================================================================

/**
 * Maps database columns to BillingCycle interface
 * Used for SELECT queries with proper camelCase conversion
 */
export const BILLING_CYCLE_COLUMNS = `
  id,
  tenant_id as "tenantId",
  subscription_id as "subscriptionId",
  cycle_start as "cycleStart",
  cycle_end as "cycleEnd",
  status,
  invoice_id as "invoiceId",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate cycle period (end must be after start)
 */
export const isValidCyclePeriod = (cycleStart: Date | string, cycleEnd: Date | string): boolean => {
  const start = new Date(cycleStart);
  const end = new Date(cycleEnd);
  return end > start;
};

/**
 * Check if cycle is active
 */
export const isActive = (cycle: BillingCycle): boolean => {
  return cycle.status === BillingCycleStatus.ACTIVE;
};

/**
 * Check if cycle is completed
 */
export const isCompleted = (cycle: BillingCycle): boolean => {
  return cycle.status === BillingCycleStatus.COMPLETED;
};

/**
 * Check if cycle is cancelled
 */
export const isCancelled = (cycle: BillingCycle): boolean => {
  return cycle.status === BillingCycleStatus.CANCELLED;
};

/**
 * Check if cycle has invoice
 */
export const hasInvoice = (cycle: BillingCycle): boolean => {
  return cycle.invoiceId !== null && cycle.invoiceId !== undefined;
};

// ============================================================================
// Period Helpers
// ============================================================================

/**
 * Get cycle duration in days
 */
export const getCycleDurationDays = (cycle: BillingCycle): number => {
  const start = new Date(cycle.cycleStart);
  const end = new Date(cycle.cycleEnd);
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Get days remaining in cycle
 */
export const getDaysRemaining = (cycle: BillingCycle): number => {
  const end = new Date(cycle.cycleEnd);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

/**
 * Get days elapsed in cycle
 */
export const getDaysElapsed = (cycle: BillingCycle): number => {
  const start = new Date(cycle.cycleStart);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

/**
 * Check if cycle is current (now is within cycle period)
 */
export const isCurrentCycle = (cycle: BillingCycle): boolean => {
  const now = new Date();
  const start = new Date(cycle.cycleStart);
  const end = new Date(cycle.cycleEnd);
  return now >= start && now <= end;
};

/**
 * Check if cycle is past (now is after cycle end)
 */
export const isPastCycle = (cycle: BillingCycle): boolean => {
  const now = new Date();
  const end = new Date(cycle.cycleEnd);
  return now > end;
};

/**
 * Check if cycle is future (now is before cycle start)
 */
export const isFutureCycle = (cycle: BillingCycle): boolean => {
  const now = new Date();
  const start = new Date(cycle.cycleStart);
  return now < start;
};

/**
 * Calculate cycle progress percentage (0-100)
 */
export const getCycleProgress = (cycle: BillingCycle): number => {
  const totalDays = getCycleDurationDays(cycle);
  const elapsedDays = getDaysElapsed(cycle);
  const progress = (elapsedDays / totalDays) * 100;
  return Math.min(100, Math.max(0, Math.round(progress * 100) / 100));
};

// ============================================================================
// Cycle Creation Helpers
// ============================================================================

/**
 * Create next billing cycle based on current cycle
 */
export const createNextCycle = (
  currentCycle: BillingCycle,
  billingCycle: 'monthly' | 'yearly'
): Omit<BillingCycle, 'id' | 'createdAt' | 'updatedAt'> => {
  const cycleStart = new Date(currentCycle.cycleEnd);
  const cycleEnd = new Date(cycleStart);
  
  if (billingCycle === 'monthly') {
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
  } else {
    cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
  }
  
  return {
    tenantId: currentCycle.tenantId,
    subscriptionId: currentCycle.subscriptionId,
    cycleStart: cycleStart.toISOString(),
    cycleEnd: cycleEnd.toISOString(),
    status: BillingCycleStatus.ACTIVE,
    invoiceId: undefined,
  };
};

/**
 * Create initial billing cycle for new subscription
 */
export const createInitialCycle = (
  tenantId: string,
  subscriptionId: string,
  startDate: Date | string,
  billingCycle: 'monthly' | 'yearly'
): Omit<BillingCycle, 'id' | 'createdAt' | 'updatedAt'> => {
  const cycleStart = new Date(startDate);
  const cycleEnd = new Date(cycleStart);
  
  if (billingCycle === 'monthly') {
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
  } else {
    cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
  }
  
  return {
    tenantId,
    subscriptionId,
    cycleStart: cycleStart.toISOString(),
    cycleEnd: cycleEnd.toISOString(),
    status: BillingCycleStatus.ACTIVE,
    invoiceId: undefined,
  };
};

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format cycle period
 */
export const formatCyclePeriod = (cycle: BillingCycle): string => {
  const start = new Date(cycle.cycleStart);
  const end = new Date(cycle.cycleEnd);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

/**
 * Get human-readable status
 */
export const getStatusLabel = (cycle: BillingCycle): string => {
  switch (cycle.status) {
    case BillingCycleStatus.ACTIVE:
      if (isCurrentCycle(cycle)) {
        const daysLeft = getDaysRemaining(cycle);
        return `Active (${daysLeft} days remaining)`;
      }
      return 'Active';
    case BillingCycleStatus.COMPLETED:
      return 'Completed';
    case BillingCycleStatus.CANCELLED:
      return 'Cancelled';
    default:
      return 'Unknown';
  }
};

/**
 * Get cycle description
 */
export const getCycleDescription = (cycle: BillingCycle): string => {
  const period = formatCyclePeriod(cycle);
  const status = getStatusLabel(cycle);
  return `${period} - ${status}`;
};

// ============================================================================
// Status Management Helpers
// ============================================================================

/**
 * Check if cycle can be completed
 */
export const canComplete = (cycle: BillingCycle): boolean => {
  return (
    cycle.status === BillingCycleStatus.ACTIVE &&
    isPastCycle(cycle) &&
    hasInvoice(cycle)
  );
};

/**
 * Check if cycle can be cancelled
 */
export const canCancel = (cycle: BillingCycle): boolean => {
  return cycle.status === BillingCycleStatus.ACTIVE;
};

/**
 * Mark cycle as completed
 */
export const markAsCompleted = (_cycle: BillingCycle): Partial<BillingCycle> => {
  return {
    status: BillingCycleStatus.COMPLETED,
  };
};

/**
 * Mark cycle as cancelled
 */
export const markAsCancelled = (_cycle: BillingCycle): Partial<BillingCycle> => {
  return {
    status: BillingCycleStatus.CANCELLED,
  };
};

/**
 * Link invoice to cycle
 */
export const linkInvoice = (_cycle: BillingCycle, invoiceId: string): Partial<BillingCycle> => {
  return {
    invoiceId,
  };
};