import Decimal from 'decimal.js';

/**
 * Payment Types for Payment Service
 * Comprehensive type definitions for payments, refunds, and Stripe integration
 */

// ============================================================================
// Payment Status
// ============================================================================

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REQUIRES_ACTION = 'requires_action',
}

export enum RefundStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethodType {
  CARD = 'card',
  BANK_ACCOUNT = 'bank_account',
  WALLET = 'wallet', // Apple Pay, Google Pay, etc.
}

// ============================================================================
// Database Models
// ============================================================================

export interface Payment {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  subscription_id: string | null;
  stripe_payment_intent_id: string;
  stripe_charge_id: string | null;
  amount: Decimal | number;
  currency: string;
  status: PaymentStatus;
  payment_method_id: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  failure_code: string | null;
  failure_message: string | null;
  receipt_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethod {
  id: string;
  tenant_id: string;
  stripe_payment_method_id: string;
  stripe_customer_id: string;
  type: PaymentMethodType;
  is_default: boolean;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  bank_account_last4: string | null;
  bank_name: string | null;
  billing_details: Record<string, any> | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Refund {
  id: string;
  tenant_id: string;
  payment_id: string;
  stripe_refund_id: string;
  amount: Decimal | number;
  currency: string;
  status: RefundStatus;
  reason: string | null;
  metadata: Record<string, any> | null;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StripeCustomer {
  id: string;
  tenant_id: string;
  stripe_customer_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: Record<string, any> | null;
  metadata: Record<string, any> | null;
  default_payment_method_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Request DTOs
// ============================================================================

export interface CreatePaymentIntentRequest {
  amount: number;
  currency?: string;
  invoice_id?: string;
  subscription_id?: string;
  payment_method_id?: string;
  description?: string;
  metadata?: Record<string, any>;
  automatic_payment_methods?: boolean;
}

export interface ConfirmPaymentRequest {
  payment_intent_id: string;
  payment_method_id?: string;
  return_url?: string;
}

export interface CapturePaymentRequest {
  payment_intent_id: string;
  amount_to_capture?: number;
}

export interface CreateRefundRequest {
  payment_id: string;
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, any>;
}

export interface CreatePaymentMethodRequest {
  type: PaymentMethodType;
  card?: {
    number: string;
    exp_month: number;
    exp_year: number;
    cvc: string;
  };
  billing_details?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  is_default?: boolean;
}

export interface UpdatePaymentMethodRequest {
  billing_details?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  is_default?: boolean;
}

export interface CreateSubscriptionPaymentRequest {
  subscription_id: string;
  payment_method_id: string;
  trial_end?: Date;
  proration_behavior?: 'none' | 'create_prorations' | 'always_invoice';
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface PaymentIntentResponse {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  description?: string;
  metadata?: Record<string, any>;
  next_action?: any;
  created_at: Date;
}

export interface PaymentResponse {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  subscription_id: string | null;
  stripe_payment_intent_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method?: PaymentMethodSummary;
  description: string | null;
  receipt_url: string | null;
  failure_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethodResponse {
  id: string;
  tenant_id: string;
  stripe_payment_method_id: string;
  type: PaymentMethodType;
  is_default: boolean;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  bank_account?: {
    last4: string;
    bank_name: string;
  };
  billing_details?: Record<string, any>;
  created_at: Date;
}

export interface RefundResponse {
  id: string;
  tenant_id: string;
  payment_id: string;
  stripe_refund_id: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason: string | null;
  failure_reason: string | null;
  created_at: Date;
}

export interface PaymentMethodSummary {
  id: string;
  type: PaymentMethodType;
  card?: {
    brand: string;
    last4: string;
  };
  bank_account?: {
    last4: string;
    bank_name: string;
  };
}

// ============================================================================
// Webhook Event Types
// ============================================================================

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
    previous_attributes?: any;
  };
  created: number;
  livemode: boolean;
}

export enum StripeWebhookEventType {
  PAYMENT_INTENT_SUCCEEDED = 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED = 'payment_intent.payment_failed',
  PAYMENT_INTENT_CANCELED = 'payment_intent.canceled',
  PAYMENT_INTENT_REQUIRES_ACTION = 'payment_intent.requires_action',
  CHARGE_SUCCEEDED = 'charge.succeeded',
  CHARGE_FAILED = 'charge.failed',
  CHARGE_REFUNDED = 'charge.refunded',
  PAYMENT_METHOD_ATTACHED = 'payment_method.attached',
  PAYMENT_METHOD_DETACHED = 'payment_method.detached',
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',
  CUSTOMER_DELETED = 'customer.deleted',
  INVOICE_PAYMENT_SUCCEEDED = 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
}

// ============================================================================
// Service Options
// ============================================================================

export interface PaymentListOptions {
  limit?: number;
  offset?: number;
  status?: PaymentStatus;
  invoice_id?: string;
  subscription_id?: string;
  start_date?: Date;
  end_date?: Date;
}

export interface PaymentMethodListOptions {
  limit?: number;
  offset?: number;
  type?: PaymentMethodType;
  is_default?: boolean;
}

export interface RefundListOptions {
  limit?: number;
  offset?: number;
  payment_id?: string;
  status?: RefundStatus;
  start_date?: Date;
  end_date?: Date;
}

// ============================================================================
// Error Types
// ============================================================================

export interface StripeErrorDetails {
  code?: string;
  decline_code?: string;
  message: string;
  param?: string;
  type: string;
  charge?: string;
  payment_intent?: string;
  payment_method?: string;
}

export interface PaymentError {
  code: string;
  message: string;
  type: 'card_error' | 'invalid_request_error' | 'api_error' | 'authentication_error' | 'rate_limit_error';
  param?: string;
  details?: any;
}
