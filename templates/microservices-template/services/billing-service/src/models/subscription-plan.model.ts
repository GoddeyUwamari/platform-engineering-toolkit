/**
 * Subscription Plan Model
 * Represents pricing plans available for tenants (Free, Pro, Enterprise)
 * Maps to: subscription_plans table
 * 
 * NOTE: The @shared/types import will work when this file is in your project at:
 * ~/Desktop/CloudBill/services/billing-service/src/models/subscription-plan.model.ts
 * 
 * Your tsconfig.json already has the path alias configured:
 * "paths": { "@shared/*": ["../../shared/*"] }
 */

// This import works in your actual project structure
import type { BaseEntity } from '@shared/types';

// If you get errors before copying to your project, you can temporarily use:
// type BaseEntity = { id: string; createdAt: Date | string; updatedAt: Date | string; deletedAt?: Date | string; };

// ============================================================================
// Subscription Plan Interface (matches DB schema exactly)
// ============================================================================

export interface SubscriptionPlan extends BaseEntity {
  // Basic Info
  name: string;                       // Unique identifier (e.g., "free", "pro", "enterprise")
  displayName: string;                // Human-readable name (e.g., "Professional Plan")
  description?: string;               // Plan description
  
  // Pricing
  priceMonthly: number;               // Monthly price in dollars (DECIMAL 10,2)
  priceYearly: number;                // Yearly price in dollars (DECIMAL 10,2)
  
  // Usage Limits
  maxApiCalls: number;                // API calls per billing period
  maxStorageGb: number;               // Storage in GB
  maxUsers: number;                   // Maximum users allowed
  maxProjects: number;                // Maximum projects allowed
  
  // Features (boolean flags)
  hasAdvancedAnalytics: boolean;      // Access to advanced analytics
  hasPrioritySupport: boolean;        // Priority customer support
  hasCustomBranding: boolean;         // Custom branding options
  hasApiAccess: boolean;              // API access enabled
  hasWebhooks: boolean;               // Webhook support
  
  // Status
  isActive: boolean;                  // Whether plan is available for subscription
  sortOrder: number;                  // Display order (for UI sorting)
}


// ============================================================================
// Create DTO
// ============================================================================

export interface CreateSubscriptionPlanDTO {
  name: string;                       // Unique name
  displayName: string;                // Display name
  description?: string;
  priceMonthly: number;               // Monthly price
  priceYearly: number;                // Yearly price (usually discounted)
  maxApiCalls: number;
  maxStorageGb: number;
  maxUsers: number;
  maxProjects: number;
  hasAdvancedAnalytics?: boolean;     // Default: false
  hasPrioritySupport?: boolean;       // Default: false
  hasCustomBranding?: boolean;        // Default: false
  hasApiAccess?: boolean;             // Default: false
  hasWebhooks?: boolean;              // Default: false
  sortOrder?: number;                 // Default: 0
}

// ============================================================================
// Update DTO
// ============================================================================

export interface UpdateSubscriptionPlanDTO {
  displayName?: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  maxApiCalls?: number;
  maxStorageGb?: number;
  maxUsers?: number;
  maxProjects?: number;
  hasAdvancedAnalytics?: boolean;
  hasPrioritySupport?: boolean;
  hasCustomBranding?: boolean;
  hasApiAccess?: boolean;
  hasWebhooks?: boolean;
  isActive?: boolean;                 // Can activate/deactivate
  sortOrder?: number;
}

// ============================================================================
// Query Filters
// ============================================================================

export interface SubscriptionPlanFilters {
  isActive?: boolean;                 // Filter by active status
  minPrice?: number;                  // Minimum monthly price
  maxPrice?: number;                  // Maximum monthly price
  hasFeature?: keyof Pick<SubscriptionPlan, 
    'hasAdvancedAnalytics' | 'hasPrioritySupport' | 'hasCustomBranding' | 
    'hasApiAccess' | 'hasWebhooks'>;  // Filter by specific feature
}

// ============================================================================
// Database Column Mapping
// ============================================================================

/**
 * Maps database columns to SubscriptionPlan interface
 * Used for SELECT queries with proper camelCase conversion
 */
export const SUBSCRIPTION_PLAN_COLUMNS = `
  id,
  name,
  display_name as "displayName",
  description,
  price_monthly as "priceMonthly",
  price_yearly as "priceYearly",
  max_api_calls as "maxApiCalls",
  max_storage_gb as "maxStorageGb",
  max_users as "maxUsers",
  max_projects as "maxProjects",
  has_advanced_analytics as "hasAdvancedAnalytics",
  has_priority_support as "hasPrioritySupport",
  has_custom_branding as "hasCustomBranding",
  has_api_access as "hasApiAccess",
  has_webhooks as "hasWebhooks",
  is_active as "isActive",
  sort_order as "sortOrder",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;


// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate plan name format (lowercase, alphanumeric, hyphens only)
 */
export const isValidPlanName = (name: string): boolean => {
  const nameRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return nameRegex.test(name);
};

/**
 * Validate price (must be non-negative)
 */
export const isValidPrice = (price: number): boolean => {
  return price >= 0 && Number.isFinite(price);
};

/**
 * Validate max users (must be positive)
 */
export const isValidMaxUsers = (maxUsers: number): boolean => {
  return maxUsers > 0 && Number.isInteger(maxUsers);
};

/**
 * Format price for display
 */
export const formatPrice = (price: number, currency: string = 'USD'): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  return formatter.format(price);
};

/**
 * Calculate yearly savings (yearly vs 12 months of monthly)
 */
export const calculateYearlySavings = (plan: SubscriptionPlan): number => {
  const monthlyTotal = plan.priceMonthly * 12;
  return monthlyTotal - plan.priceYearly;
};

/**
 * Calculate yearly discount percentage
 */
export const calculateYearlyDiscountPercent = (plan: SubscriptionPlan): number => {
  if (plan.priceMonthly === 0) return 0;
  const monthlyTotal = plan.priceMonthly * 12;
  const savings = monthlyTotal - plan.priceYearly;
  return (savings / monthlyTotal) * 100;
};

// ============================================================================
// Plan Feature Helpers
// ============================================================================

/**
 * Get all enabled features for a plan
 */
export const getEnabledFeatures = (plan: SubscriptionPlan): string[] => {
  const features: string[] = [];
  
  if (plan.hasAdvancedAnalytics) features.push('Advanced Analytics');
  if (plan.hasPrioritySupport) features.push('Priority Support');
  if (plan.hasCustomBranding) features.push('Custom Branding');
  if (plan.hasApiAccess) features.push('API Access');
  if (plan.hasWebhooks) features.push('Webhooks');
  
  return features;
};

/**
 * Get human-readable feature list
 */
export const getFeatureList = (plan: SubscriptionPlan): string[] => {
  const features: string[] = [
    `Up to ${plan.maxUsers} users`,
    `${plan.maxApiCalls.toLocaleString()} API calls/month`,
    `${plan.maxStorageGb} GB storage`,
    `${plan.maxProjects} projects`,
  ];
  
  return [...features, ...getEnabledFeatures(plan)];
};

// ============================================================================
// Plan Comparison Helpers
// ============================================================================

/**
 * Compare two plans by price (monthly)
 */
export const comparePlansByPrice = (plan1: SubscriptionPlan, plan2: SubscriptionPlan): number => {
  return plan1.priceMonthly - plan2.priceMonthly;
};

/**
 * Compare two plans by sort order
 */
export const comparePlansBySortOrder = (plan1: SubscriptionPlan, plan2: SubscriptionPlan): number => {
  return plan1.sortOrder - plan2.sortOrder;
};

/**
 * Check if plan upgrade is available
 */
export const canUpgradeTo = (currentPlan: SubscriptionPlan, targetPlan: SubscriptionPlan): boolean => {
  return targetPlan.priceMonthly > currentPlan.priceMonthly;
};

/**
 * Check if plan downgrade is available
 */
export const canDowngradeTo = (currentPlan: SubscriptionPlan, targetPlan: SubscriptionPlan): boolean => {
  return targetPlan.priceMonthly < currentPlan.priceMonthly;
};

/**
 * Check if a plan has a specific feature
 */
export const hasFeature = (
  plan: SubscriptionPlan, 
  feature: keyof Pick<SubscriptionPlan, 
    'hasAdvancedAnalytics' | 'hasPrioritySupport' | 'hasCustomBranding' | 
    'hasApiAccess' | 'hasWebhooks'>
): boolean => {
  return plan[feature] === true;
};