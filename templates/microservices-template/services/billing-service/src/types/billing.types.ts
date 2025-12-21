/**
 * Billing Service Type Definitions
 * Comprehensive TypeScript interfaces and types for all billing operations
 */

import type { BaseEntity, UUID, Timestamp, PaginationMeta } from '@shared/types';
import type { Invoice } from '../models/invoice.model';
import type { TenantSubscription } from '../models/tenant-subscription.model';

// ============================================================================
// Re-export Model Types (for convenience)
// ============================================================================

// Invoice types
export {
  Invoice,
  InvoiceStatus,
  InvoiceWithItems,
  InvoiceItem,
  CreateInvoiceDTO,
  UpdateInvoiceDTO,
  InvoiceFilters,
  PaymentMethod,
} from '../models/invoice.model';

export {
  InvoiceItemType,
  CreateInvoiceItemDTO,
  UpdateInvoiceItemDTO,
} from '../models/invoice-item.model';

export type { InvoiceItem as InvoiceLineItem } from '../models/invoice-item.model';

// Subscription types
export {
  TenantSubscription,
  SubscriptionStatus,
  BillingCycle,
  CreateTenantSubscriptionDTO,
  UpdateTenantSubscriptionDTO,
  TenantSubscriptionFilters,
} from '../models/tenant-subscription.model';

export {
  SubscriptionPlan,
  CreateSubscriptionPlanDTO,
  UpdateSubscriptionPlanDTO,
  SubscriptionPlanFilters,
} from '../models/subscription-plan.model';

// Usage types
export {
  UsageRecord,
  CreateUsageRecordDTO,
  UpdateUsageRecordDTO,
  UsageRecordFilters,
  UsageType,
} from '../models/usage-record.model';

// ============================================================================
// Payment Types
// ============================================================================

export interface Payment extends BaseEntity {
  // Identifiers
  invoiceId: UUID;
  tenantId: UUID;

  // Payment Details
  amount: number;
  currency: string;
  method: PaymentMethodType;
  status: PaymentStatus;

  // Provider Information
  providerTransactionId?: string;
  providerResponse?: Record<string, unknown>;

  // Failure Information
  failureReason?: string;
  failureCode?: string;

  // Timestamps
  processedAt?: Timestamp;
  refundedAt?: Timestamp;
}

export enum PaymentMethodType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  PAYPAL = 'paypal',
  STRIPE = 'stripe',
  MANUAL = 'manual',
  ACH = 'ach',
  WIRE = 'wire',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export interface CreatePaymentDTO {
  invoiceId: UUID;
  tenantId: UUID;
  amount: number;
  currency: string;
  method: PaymentMethodType;
  providerTransactionId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePaymentDTO {
  status?: PaymentStatus;
  processedAt?: Timestamp;
  providerResponse?: Record<string, unknown>;
  failureReason?: string;
  failureCode?: string;
}

export interface PaymentFilters {
  invoiceId?: UUID;
  tenantId?: UUID;
  status?: PaymentStatus;
  method?: PaymentMethodType;
  minAmount?: number;
  maxAmount?: number;
  startDate?: Timestamp;
  endDate?: Timestamp;
}

export interface RefundRequest {
  paymentId: UUID;
  amount?: number; // Partial refund if specified
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface RefundResult {
  refundId: UUID;
  originalPaymentId: UUID;
  amount: number;
  status: PaymentStatus;
  refundedAt: Timestamp;
}

// ============================================================================
// Billing Operations Types
// ============================================================================

export interface BillingCycleInfo {
  start: Date;
  end: Date;
  daysInCycle: number;
  daysRemaining: number;
  percentComplete: number;
}

export interface ProrationCalculation {
  originalAmount: number;
  proratedAmount: number;
  refundAmount: number;
  daysUsed: number;
  daysTotal: number;
  reason: string;
}

export interface SubscriptionChange {
  subscriptionId: UUID;
  fromPlanId: UUID;
  toPlanId: UUID;
  fromPrice: number;
  toPrice: number;
  proration?: ProrationCalculation;
  effectiveDate: Timestamp;
  reason?: string;
}

export interface BillingRun {
  id: UUID;
  tenantId: UUID;
  runDate: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  status: BillingRunStatus;
  invoicesGenerated: number;
  totalAmount: number;
  errors?: BillingError[];
  completedAt?: Timestamp;
}

export enum BillingRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIALLY_COMPLETED = 'partially_completed',
}

export interface BillingError {
  subscriptionId?: UUID;
  invoiceId?: UUID;
  errorCode: string;
  errorMessage: string;
  timestamp: Timestamp;
  retryable: boolean;
}

// ============================================================================
// Credit and Discount Types
// ============================================================================

export interface Credit extends BaseEntity {
  tenantId: UUID;
  amount: number;
  currency: string;
  balance: number;
  description: string;
  expiresAt?: Timestamp;
  metadata?: Record<string, unknown>;
}

export interface CreditApplication {
  creditId: UUID;
  invoiceId: UUID;
  amount: number;
  appliedAt: Timestamp;
}

export interface Discount {
  id: UUID;
  code: string;
  type: DiscountType;
  value: number; // Percentage or fixed amount
  currency?: string; // For fixed amount discounts
  maxUses?: number;
  usesRemaining: number;
  validFrom?: Timestamp;
  validUntil?: Timestamp;
  applicableTo: DiscountScope;
  metadata?: Record<string, unknown>;
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  FREE_TRIAL = 'free_trial',
}

export enum DiscountScope {
  INVOICE = 'invoice',
  SUBSCRIPTION = 'subscription',
  INVOICE_ITEM = 'invoice_item',
  USAGE = 'usage',
}

export interface DiscountApplication {
  discountId: UUID;
  targetId: UUID; // Invoice ID or Subscription ID
  targetType: DiscountScope;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  appliedAt: Timestamp;
}

// ============================================================================
// Reporting and Analytics Types
// ============================================================================

export interface RevenueReport {
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  metrics: {
    totalRevenue: number;
    recurringRevenue: number;
    oneTimeRevenue: number;
    refunds: number;
    netRevenue: number;
  };
  breakdown: {
    byPlan: Record<string, number>;
    byPaymentMethod: Record<string, number>;
    byCurrency: Record<string, number>;
  };
  growth: {
    periodOverPeriod: number;
    yearOverYear: number;
  };
}

export interface SubscriptionMetrics {
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  metrics: {
    totalSubscriptions: number;
    activeSubscriptions: number;
    newSubscriptions: number;
    cancelledSubscriptions: number;
    trialSubscriptions: number;
    churnRate: number;
    retentionRate: number;
    mrr: number; // Monthly Recurring Revenue
    arr: number; // Annual Recurring Revenue
  };
  byPlan: Record<string, {
    count: number;
    revenue: number;
  }>;
}

export interface InvoiceMetrics {
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  metrics: {
    totalInvoices: number;
    paidInvoices: number;
    unpaidInvoices: number;
    overdueInvoices: number;
    averageInvoiceValue: number;
    collectionRate: number;
  };
  aging: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90days: number;
  };
}

export interface UsageMetrics {
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  byType: Record<string, {
    totalQuantity: number;
    averagePerTenant: number;
    peakUsage: number;
    unit: string;
  }>;
  topConsumers: Array<{
    tenantId: UUID;
    usageType: string;
    quantity: number;
    estimatedCost: number;
  }>;
}

export interface CustomerLifetimeValue {
  tenantId: UUID;
  totalRevenue: number;
  averageMonthlyRevenue: number;
  lifetimeMonths: number;
  predictedLifetimeValue: number;
  churnRisk: ChurnRiskLevel;
}

export enum ChurnRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// ============================================================================
// Webhook and Event Types
// ============================================================================

export interface BillingEvent {
  id: UUID;
  type: BillingEventType;
  tenantId: UUID;
  timestamp: Timestamp;
  data: BillingEventData;
  metadata?: Record<string, unknown>;
}

export enum BillingEventType {
  // Invoice events
  INVOICE_CREATED = 'invoice.created',
  INVOICE_FINALIZED = 'invoice.finalized',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  INVOICE_VOIDED = 'invoice.voided',
  INVOICE_OVERDUE = 'invoice.overdue',

  // Subscription events
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',
  SUBSCRIPTION_EXPIRED = 'subscription.expired',
  SUBSCRIPTION_TRIAL_ENDING = 'subscription.trial_ending',
  SUBSCRIPTION_PLAN_CHANGED = 'subscription.plan_changed',

  // Payment events
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',

  // Usage events
  USAGE_THRESHOLD_REACHED = 'usage.threshold_reached',
  USAGE_LIMIT_EXCEEDED = 'usage.limit_exceeded',

  // Credit events
  CREDIT_APPLIED = 'credit.applied',
  CREDIT_EXPIRED = 'credit.expired',
}

export type BillingEventData =
  | InvoiceEventData
  | SubscriptionEventData
  | PaymentEventData
  | UsageEventData
  | CreditEventData;

export interface InvoiceEventData {
  invoiceId: UUID;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
}

export interface SubscriptionEventData {
  subscriptionId: UUID;
  planId: UUID;
  status: string;
  currentPeriodEnd?: Timestamp;
}

export interface PaymentEventData {
  paymentId: UUID;
  invoiceId: UUID;
  amount: number;
  currency: string;
  method: string;
  status: string;
}

export interface UsageEventData {
  usageRecordId: UUID;
  usageType: string;
  quantity: number;
  threshold?: number;
  limit?: number;
}

export interface CreditEventData {
  creditId: UUID;
  amount: number;
  balance: number;
  appliedToInvoiceId?: UUID;
}

export interface WebhookDelivery {
  id: UUID;
  eventId: UUID;
  url: string;
  status: WebhookStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Timestamp;
  lastAttemptAt?: Timestamp;
  response?: WebhookResponse;
}

export enum WebhookStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
  ABANDONED = 'abandoned',
}

export interface WebhookResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
  error?: string;
  duration: number;
}

// ============================================================================
// Tax Types
// ============================================================================

export interface TaxRate {
  id: UUID;
  name: string;
  rate: number; // Percentage
  jurisdiction: string;
  country: string;
  state?: string;
  isActive: boolean;
}

export interface TaxCalculation {
  subtotal: number;
  taxableAmount: number;
  taxRates: Array<{
    name: string;
    rate: number;
    amount: number;
  }>;
  totalTax: number;
  total: number;
}

export interface TaxExemption {
  tenantId: UUID;
  certificateNumber: string;
  jurisdiction: string;
  validFrom: Timestamp;
  validUntil?: Timestamp;
  exemptionType: TaxExemptionType;
}

export enum TaxExemptionType {
  NONPROFIT = 'nonprofit',
  GOVERNMENT = 'government',
  RESALE = 'resale',
  EDUCATIONAL = 'educational',
  OTHER = 'other',
}

// ============================================================================
// Audit and Compliance Types
// ============================================================================

export interface BillingAuditLog {
  id: UUID;
  tenantId: UUID;
  userId: UUID;
  action: BillingAuditAction;
  resourceType: BillingResourceType;
  resourceId: UUID;
  changes?: AuditChange[];
  ipAddress?: string;
  userAgent?: string;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}

export enum BillingAuditAction {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  VIEWED = 'viewed',
  EXPORTED = 'exported',
  FINALIZED = 'finalized',
  VOIDED = 'voided',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

export enum BillingResourceType {
  INVOICE = 'invoice',
  SUBSCRIPTION = 'subscription',
  PAYMENT = 'payment',
  CREDIT = 'credit',
  DISCOUNT = 'discount',
  USAGE_RECORD = 'usage_record',
}

export interface AuditChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface ComplianceReport {
  reportId: UUID;
  tenantId: UUID;
  reportType: ComplianceReportType;
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  generatedAt: Timestamp;
  data: Record<string, unknown>;
  format: ReportFormat;
}

export enum ComplianceReportType {
  REVENUE = 'revenue',
  TAX = 'tax',
  SUBSCRIPTION = 'subscription',
  PAYMENT = 'payment',
  REFUND = 'refund',
  AUDIT = 'audit',
}

export enum ReportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  JSON = 'json',
  EXCEL = 'excel',
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface BillingApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: Timestamp;
}

export interface PaginatedBillingResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface BulkOperationRequest<T> {
  operations: T[];
  stopOnError?: boolean;
}

export interface BulkOperationResponse<T> {
  successful: T[];
  failed: Array<{
    operation: T;
    error: string;
  }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface BillingConfiguration {
  defaultCurrency: string;
  supportedCurrencies: string[];
  defaultPaymentTerms: number; // Days
  lateFeePercentage?: number;
  gracePeriodDays: number;
  automaticBilling: boolean;
  automaticRetries: boolean;
  maxRetryAttempts: number;
  retrySchedule: number[]; // Days between retries
}

export interface TenantBillingSettings {
  tenantId: UUID;
  currency: string;
  paymentTerms: number;
  autoCharge: boolean;
  billingEmail: string;
  billingAddress?: Address;
  taxId?: string;
  taxExempt: boolean;
  notificationPreferences: NotificationPreferences;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface NotificationPreferences {
  invoiceCreated: boolean;
  invoiceDue: boolean;
  invoiceOverdue: boolean;
  paymentSucceeded: boolean;
  paymentFailed: boolean;
  subscriptionExpiring: boolean;
  usageThreshold: boolean;
}

// ============================================================================
// Export Utility Types
// ============================================================================

export type InvoiceExport = Pick<
  Invoice,
  'invoiceNumber' | 'issueDate' | 'dueDate' | 'totalAmount' | 'status' | 'currency'
>;

export type SubscriptionExport = Pick<
  TenantSubscription,
  'id' | 'planId' | 'status' | 'currentPrice' | 'currentPeriodEnd'
>;

export type PaymentExport = Pick<
  Payment,
  'id' | 'amount' | 'currency' | 'method' | 'status' | 'processedAt'
>;

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Summary Types
// ============================================================================

export interface BillingSummary {
  tenantId: UUID;
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  revenue: {
    total: number;
    recurring: number;
    usage: number;
    oneTime: number;
  };
  invoices: {
    total: number;
    paid: number;
    unpaid: number;
    overdue: number;
  };
  subscriptions: {
    active: number;
    trial: number;
    cancelled: number;
  };
  payments: {
    total: number;
    successful: number;
    failed: number;
    refunded: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: ComponentHealth;
    paymentProvider: ComponentHealth;
    notifications: ComponentHealth;
  };
  timestamp: Timestamp;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  errorRate?: number;
  message?: string;
}
