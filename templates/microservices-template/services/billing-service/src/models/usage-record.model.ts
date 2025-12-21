/**
 * Usage Record Model
 * Represents usage tracking for billing purposes
 * Maps to: usage_records table
 */

import type { BaseEntity } from '@shared/types';

// ============================================================================
// Common Usage Types (can be extended)
// ============================================================================

export enum UsageType {
  API_CALLS = 'api_calls',
  STORAGE = 'storage',
  BANDWIDTH = 'bandwidth',
  COMPUTE_TIME = 'compute_time',
  DATABASE_QUERIES = 'database_queries',
  EMAIL_SENT = 'email_sent',
  SMS_SENT = 'sms_sent',
  USERS = 'users',
  PROJECTS = 'projects',
  CUSTOM = 'custom',
}

// ============================================================================
// Usage Record Interface (matches DB schema exactly)
// ============================================================================

export interface UsageRecord extends Omit<BaseEntity, 'updatedAt' | 'deletedAt'> {
  // Foreign Keys
  tenantId: string;                   // References tenants(id)
  subscriptionId?: string;            // References tenant_subscriptions(id) - nullable
  
  // Usage Details
  usageType: string;                  // Type of usage (api_calls, storage, etc.)
  quantity: number;                   // Amount of usage (DECIMAL 15,4)
  unit: string;                       // Unit of measurement (calls, GB, hours, etc.)
  
  // Time Period
  periodStart: Date | string;         // Start of usage period
  periodEnd: Date | string;           // End of usage period
  
  // Additional Data
  metadata?: Record<string, unknown>; // Extra data (JSONB)
  
  // Timestamps
  recordedAt: Date | string;          // When usage was recorded
  createdAt: Date | string;           // When record was created
}

// ============================================================================
// Create DTO
// ============================================================================

export interface CreateUsageRecordDTO {
  tenantId: string;
  subscriptionId?: string;
  usageType: string;
  quantity: number;
  unit: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  metadata?: Record<string, unknown>;
  recordedAt?: Date | string;         // Default: now
}

// ============================================================================
// Update DTO (rarely updated, mostly immutable)
// ============================================================================

export interface UpdateUsageRecordDTO {
  quantity?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Query Filters
// ============================================================================

export interface UsageRecordFilters {
  tenantId?: string;
  subscriptionId?: string;
  usageType?: string;
  periodStart?: Date | string;
  periodEnd?: Date | string;
  recordedAfter?: Date | string;      // Records created after this date
  recordedBefore?: Date | string;     // Records created before this date
  minQuantity?: number;
  maxQuantity?: number;
}

// ============================================================================
// Database Column Mapping
// ============================================================================

/**
 * Maps database columns to UsageRecord interface
 * Used for SELECT queries with proper camelCase conversion
 */
export const USAGE_RECORD_COLUMNS = `
  id,
  tenant_id as "tenantId",
  subscription_id as "subscriptionId",
  usage_type as "usageType",
  quantity::numeric::float8 as quantity,
  unit,
  period_start as "periodStart",
  period_end as "periodEnd",
  metadata,
  recorded_at as "recordedAt",
  created_at as "createdAt"
`;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate quantity (must be non-negative)
 */
export const isValidQuantity = (quantity: number): boolean => {
  return quantity >= 0 && Number.isFinite(quantity);
};

/**
 * Validate usage type (non-empty string)
 */
export const isValidUsageType = (usageType: string): boolean => {
  return usageType.trim().length > 0;
};

/**
 * Validate unit (non-empty string)
 */
export const isValidUnit = (unit: string): boolean => {
  return unit.trim().length > 0;
};

/**
 * Validate period (end must be after start)
 */
export const isValidPeriod = (periodStart: Date | string, periodEnd: Date | string): boolean => {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  return end > start;
};

// ============================================================================
// Usage Aggregation Helpers
// ============================================================================

/**
 * Calculate total usage from multiple records
 */
export const calculateTotalUsage = (records: UsageRecord[]): number => {
  const total = records.reduce((sum, record) => sum + record.quantity, 0);
  return Math.round(total * 10000) / 10000; // Round to 4 decimals
};

/**
 * Group usage records by type
 */
export const groupByUsageType = (records: UsageRecord[]): Record<string, UsageRecord[]> => {
  return records.reduce((acc, record) => {
    if (!acc[record.usageType]) {
      acc[record.usageType] = [];
    }
    acc[record.usageType]!.push(record);
    return acc;
  }, {} as Record<string, UsageRecord[]>);
};

/**
 * Calculate usage summary by type
 */
export const calculateUsageSummary = (
  records: UsageRecord[]
): Record<string, { quantity: number; unit: string; count: number }> => {
  const grouped = groupByUsageType(records);
  
  return Object.keys(grouped).reduce((acc, usageType) => {
    const typeRecords = grouped[usageType];
    if (!typeRecords) return acc;

    const totalQuantity = calculateTotalUsage(typeRecords);
    const unit = typeRecords[0]?.unit || '';

    acc[usageType] = {
      quantity: totalQuantity,
      unit,
      count: typeRecords.length,
    };

    return acc;
  }, {} as Record<string, { quantity: number; unit: string; count: number }>);
};

/**
 * Get usage for a specific period
 */
export const getUsageForPeriod = (
  records: UsageRecord[],
  periodStart: Date | string,
  periodEnd: Date | string
): UsageRecord[] => {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  
  return records.filter(record => {
    const recordStart = new Date(record.periodStart);
    const recordEnd = new Date(record.periodEnd);
    
    // Check if record overlaps with the period
    return recordEnd >= start && recordStart <= end;
  });
};

// ============================================================================
// Period Helpers
// ============================================================================

/**
 * Get period duration in hours
 */
export const getPeriodDurationHours = (record: UsageRecord): number => {
  const start = new Date(record.periodStart);
  const end = new Date(record.periodEnd);
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
};

/**
 * Get period duration in days
 */
export const getPeriodDurationDays = (record: UsageRecord): number => {
  return getPeriodDurationHours(record) / 24;
};

/**
 * Check if usage record is for current period
 */
export const isCurrentPeriod = (record: UsageRecord): boolean => {
  const now = new Date();
  const start = new Date(record.periodStart);
  const end = new Date(record.periodEnd);
  return now >= start && now <= end;
};

/**
 * Check if usage record is from past period
 */
export const isPastPeriod = (record: UsageRecord): boolean => {
  const now = new Date();
  const end = new Date(record.periodEnd);
  return now > end;
};

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format quantity with unit
 */
export const formatQuantity = (quantity: number, unit: string): string => {
  const formatted = quantity.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
  return `${formatted} ${unit}`;
};

/**
 * Format usage type (convert snake_case to Title Case)
 */
export const formatUsageType = (usageType: string): string => {
  return usageType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Format period
 */
export const formatPeriod = (record: UsageRecord): string => {
  const start = new Date(record.periodStart);
  const end = new Date(record.periodEnd);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

/**
 * Get human-readable description
 */
export const getUsageDescription = (record: UsageRecord): string => {
  const type = formatUsageType(record.usageType);
  const qty = formatQuantity(record.quantity, record.unit);
  const period = formatPeriod(record);
  
  return `${type}: ${qty} (${period})`;
};

// ============================================================================
// Usage Tracking Helpers
// ============================================================================

/**
 * Create API calls usage record
 */
export const createApiCallsRecord = (
  tenantId: string,
  subscriptionId: string,
  callCount: number,
  periodStart: Date | string,
  periodEnd: Date | string,
  metadata?: Record<string, unknown>
): Omit<UsageRecord, 'id' | 'createdAt'> => {
  return {
    tenantId,
    subscriptionId,
    usageType: UsageType.API_CALLS,
    quantity: callCount,
    unit: 'calls',
    periodStart,
    periodEnd,
    recordedAt: new Date().toISOString(),
    metadata,
  };
};

/**
 * Create storage usage record
 */
export const createStorageRecord = (
  tenantId: string,
  subscriptionId: string,
  storageGb: number,
  periodStart: Date | string,
  periodEnd: Date | string,
  metadata?: Record<string, unknown>
): Omit<UsageRecord, 'id' | 'createdAt'> => {
  return {
    tenantId,
    subscriptionId,
    usageType: UsageType.STORAGE,
    quantity: storageGb,
    unit: 'GB',
    periodStart,
    periodEnd,
    recordedAt: new Date().toISOString(),
    metadata,
  };
};

/**
 * Create bandwidth usage record
 */
export const createBandwidthRecord = (
  tenantId: string,
  subscriptionId: string,
  bandwidthGb: number,
  periodStart: Date | string,
  periodEnd: Date | string,
  metadata?: Record<string, unknown>
): Omit<UsageRecord, 'id' | 'createdAt'> => {
  return {
    tenantId,
    subscriptionId,
    usageType: UsageType.BANDWIDTH,
    quantity: bandwidthGb,
    unit: 'GB',
    periodStart,
    periodEnd,
    recordedAt: new Date().toISOString(),
    metadata,
  };
};

/**
 * Create compute time usage record
 */
export const createComputeTimeRecord = (
  tenantId: string,
  subscriptionId: string,
  hours: number,
  periodStart: Date | string,
  periodEnd: Date | string,
  metadata?: Record<string, unknown>
): Omit<UsageRecord, 'id' | 'createdAt'> => {
  return {
    tenantId,
    subscriptionId,
    usageType: UsageType.COMPUTE_TIME,
    quantity: hours,
    unit: 'hours',
    periodStart,
    periodEnd,
    recordedAt: new Date().toISOString(),
    metadata,
  };
};

/**
 * Create custom usage record
 */
export const createCustomUsageRecord = (
  tenantId: string,
  subscriptionId: string,
  usageType: string,
  quantity: number,
  unit: string,
  periodStart: Date | string,
  periodEnd: Date | string,
  metadata?: Record<string, unknown>
): Omit<UsageRecord, 'id' | 'createdAt'> => {
  return {
    tenantId,
    subscriptionId,
    usageType,
    quantity,
    unit,
    periodStart,
    periodEnd,
    recordedAt: new Date().toISOString(),
    metadata,
  };
};

// ============================================================================
// Billing Helpers
// ============================================================================

/**
 * Calculate billable usage (quantity exceeding plan limits)
 */
export const calculateBillableUsage = (
  totalUsage: number,
  includedUsage: number
): number => {
  const billable = totalUsage - includedUsage;
  return Math.max(0, billable);
};

/**
 * Calculate overage cost
 */
export const calculateOverageCost = (
  totalUsage: number,
  includedUsage: number,
  overageRate: number
): number => {
  const billableUsage = calculateBillableUsage(totalUsage, includedUsage);
  const cost = billableUsage * overageRate;
  return Math.round(cost * 100) / 100; // Round to 2 decimals
};

/**
 * Check if usage exceeds plan limit
 */
export const isOverLimit = (
  totalUsage: number,
  planLimit: number
): boolean => {
  return totalUsage > planLimit;
};

/**
 * Calculate percentage of plan limit used
 */
export const calculateUsagePercentage = (
  totalUsage: number,
  planLimit: number
): number => {
  if (planLimit === 0) return 0;
  const percentage = (totalUsage / planLimit) * 100;
  return Math.min(100, Math.round(percentage * 100) / 100);
};

/**
 * Get usage status (low, medium, high, exceeded)
 */
export const getUsageStatus = (
  totalUsage: number,
  planLimit: number
): 'low' | 'medium' | 'high' | 'exceeded' => {
  const percentage = calculateUsagePercentage(totalUsage, planLimit);
  
  if (percentage >= 100) return 'exceeded';
  if (percentage >= 80) return 'high';
  if (percentage >= 50) return 'medium';
  return 'low';
};

/**
 * Get remaining usage
 */
export const getRemainingUsage = (
  totalUsage: number,
  planLimit: number
): number => {
  return Math.max(0, planLimit - totalUsage);
};