/**
 * Test Data Factories for Payment Service
 */

import { faker } from '@faker-js/faker';
import { Pool } from 'pg';
import { UUID } from '@shared/types';

// ============================================================================
// Tenant Factory
// ============================================================================

export interface CreateTenantOptions {
  name?: string;
  slug?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export async function createTenant(
  pool: Pool,
  options: CreateTenantOptions = {}
): Promise<any> {
  const companyName = options.name || faker.company.name();
  const slug = options.slug || faker.string.alphanumeric(10).toLowerCase();

  const result = await pool.query(
    `INSERT INTO tenants (name, slug, billing_email, status, settings)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, slug, billing_email as "billingEmail", status, settings,
               created_at as "createdAt", updated_at as "updatedAt"`,
    [
      companyName,
      slug,
      faker.internet.email(),
      options.status || 'ACTIVE',
      JSON.stringify({}),
    ]
  );

  return result.rows[0];
}

// ============================================================================
// User Factory
// ============================================================================

export interface CreateUserOptions {
  tenantId?: UUID;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'ADMIN' | 'USER';
}

export async function createUser(
  pool: Pool,
  options: CreateUserOptions = {}
): Promise<any> {
  const email = options.email || faker.internet.email();
  const firstName = options.firstName || faker.person.firstName();
  const lastName = options.lastName || faker.person.lastName();

  const result = await pool.query(
    `INSERT INTO users (tenant_id, email, first_name, last_name, password_hash, role, email_verified, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, tenant_id as "tenantId", email, first_name as "firstName", last_name as "lastName",
               role, email_verified as "emailVerified", status, created_at as "createdAt", updated_at as "updatedAt"`,
    [
      options.tenantId || faker.string.uuid(),
      email,
      firstName,
      lastName,
      faker.string.alphanumeric(60), // password_hash
      options.role || 'USER',
      true,
      'ACTIVE',
    ]
  );

  return result.rows[0];
}

// ============================================================================
// Payment Factory
// ============================================================================

export interface CreatePaymentOptions {
  tenantId?: UUID;
  invoiceId?: UUID | null;
  paymentMethodId?: UUID | null;
  amount?: number;
  currency?: string;
  status?: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  method?: 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'PAYPAL';
  stripePaymentIntentId?: string;
  description?: string;
}

export async function createPayment(
  pool: Pool,
  options: CreatePaymentOptions = {}
): Promise<any> {
  const amount = options.amount || parseFloat(faker.commerce.price({ min: 10, max: 500 }));
  const stripePaymentIntentId = options.stripePaymentIntentId || `pi_test_${faker.string.alphanumeric(24)}`;

  const result = await pool.query(
    `INSERT INTO payments (
      tenant_id, invoice_id, payment_method_id, stripe_payment_intent_id,
      amount, currency, method, status, description, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id, tenant_id as "tenantId", invoice_id as "invoiceId",
              payment_method_id as "paymentMethodId", stripe_payment_intent_id as "stripePaymentIntentId",
              amount, currency, method, status,
              description, metadata, created_at as "createdAt", updated_at as "updatedAt"`,
    [
      options.tenantId || faker.string.uuid(),
      options.invoiceId || null,
      options.paymentMethodId || null,
      stripePaymentIntentId,
      amount,
      options.currency || 'USD',
      options.method || 'CREDIT_CARD',
      options.status || 'succeeded',
      options.description || 'Test payment',
      JSON.stringify({}),
    ]
  );

  return result.rows[0];
}

// ============================================================================
// Refund Factory
// ============================================================================

export interface CreateRefundOptions {
  tenantId?: UUID;
  paymentId?: UUID;
  invoiceId?: UUID | null;
  amount?: number;
  currency?: string;
  status?: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  stripeRefundId?: string;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'expired_uncaptured_charge' | 'other';
}

export async function createRefund(
  pool: Pool,
  options: CreateRefundOptions = {}
): Promise<any> {
  const amount = options.amount || parseFloat(faker.commerce.price({ min: 5, max: 100 }));
  const stripeRefundId = options.stripeRefundId || `re_test_${faker.string.alphanumeric(24)}`;

  const result = await pool.query(
    `INSERT INTO refunds (
      tenant_id, payment_id, invoice_id, stripe_refund_id, amount, currency,
      status, reason, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, tenant_id as "tenantId", payment_id as "paymentId",
              invoice_id as "invoiceId", stripe_refund_id as "stripeRefundId",
              amount, currency, status, reason, metadata, created_at as "createdAt"`,
    [
      options.tenantId || faker.string.uuid(),
      options.paymentId || faker.string.uuid(),
      options.invoiceId || null,
      stripeRefundId,
      amount,
      options.currency || 'USD',
      options.status || 'succeeded',
      options.reason || 'requested_by_customer',
      JSON.stringify({}),
    ]
  );

  return result.rows[0];
}

// ============================================================================
// Payment Method Factory
// ============================================================================

export interface CreatePaymentMethodOptions {
  tenantId?: UUID;
  userId?: UUID;
  type?: 'card' | 'bank_account' | 'paypal' | 'other';
  stripePaymentMethodId?: string;
  cardLast4?: string;
  cardBrand?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  isDefault?: boolean;
  status?: 'active' | 'inactive' | 'expired' | 'deleted';
}

export async function createPaymentMethod(
  pool: Pool,
  options: CreatePaymentMethodOptions = {}
): Promise<any> {
  const stripePaymentMethodId = options.stripePaymentMethodId || `pm_test_${faker.string.alphanumeric(24)}`;
  const cardLast4 = options.cardLast4 || faker.finance.creditCardNumber().slice(-4);

  // Create a user if userId is not provided
  let userId = options.userId;
  if (!userId) {
    const user = await createUser(pool, {
      tenantId: options.tenantId,
    });
    userId = user.id;
  }

  const result = await pool.query(
    `INSERT INTO payment_methods (
      tenant_id, user_id, stripe_payment_method_id, type, card_last4,
      card_brand, card_exp_month, card_exp_year, is_default, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id, tenant_id as "tenantId", user_id as "userId",
              stripe_payment_method_id as "stripePaymentMethodId", type,
              card_last4 as "cardLast4", card_brand as "cardBrand",
              card_exp_month as "cardExpMonth", card_exp_year as "cardExpYear",
              is_default as "isDefault", status,
              created_at as "createdAt", updated_at as "updatedAt"`,
    [
      options.tenantId || faker.string.uuid(),
      userId,
      stripePaymentMethodId,
      options.type || 'card',
      cardLast4,
      options.cardBrand || 'visa',
      options.cardExpMonth || 12,
      options.cardExpYear || 2025,
      options.isDefault ?? true,
      options.status || 'active',
    ]
  );

  return result.rows[0];
}

// ============================================================================
// Complete Test Setup Factory
// ============================================================================

export interface CreatePaymentTestDataOptions {
  paymentStatus?: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
}

/**
 * Creates a complete payment test setup (tenant, payment, payment method)
 */
export async function createPaymentTestData(
  pool: Pool,
  options: CreatePaymentTestDataOptions = {}
): Promise<{
  tenant: any;
  payment: any;
  paymentMethod: any;
}> {
  // Create tenant
  const tenant = await createTenant(pool);

  // Create payment method
  const paymentMethod = await createPaymentMethod(pool, {
    tenantId: tenant.id,
  });

  // Create payment
  const payment = await createPayment(pool, {
    tenantId: tenant.id,
    paymentMethodId: paymentMethod.id,
    stripePaymentIntentId: `pi_test_${faker.string.alphanumeric(24)}`,
    status: options.paymentStatus || 'succeeded',
  });

  return { tenant, payment, paymentMethod };
}

// ============================================================================
// Invoice Factory (for payment tests that need invoices)
// ============================================================================

export interface CreateInvoiceOptions {
  tenantId?: UUID;
  subscriptionId?: UUID | null;
  invoiceNumber?: string;
  totalAmount?: number;
  status?: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
}

export async function createInvoice(
  pool: Pool,
  options: CreateInvoiceOptions = {}
): Promise<any> {
  const totalAmount = options.totalAmount || parseFloat(faker.commerce.price({ min: 50, max: 500 }));
  const invoiceNumber = options.invoiceNumber || `INV-${faker.string.alphanumeric(10)}`;

  const result = await pool.query(
    `INSERT INTO invoices (
      tenant_id, subscription_id, invoice_number, subtotal, tax_amount,
      discount_amount, total_amount, amount_due, amount_paid, currency,
      status, period_start, period_end, issue_date, due_date
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING id, tenant_id as "tenantId", subscription_id as "subscriptionId",
              invoice_number as "invoiceNumber", subtotal, tax_amount as "taxAmount",
              total_amount as "totalAmount", amount_due as "amountDue",
              amount_paid as "amountPaid", currency, status,
              created_at as "createdAt"`,
    [
      options.tenantId || faker.string.uuid(),
      options.subscriptionId || null,
      invoiceNumber,
      totalAmount * 0.9, // subtotal
      totalAmount * 0.1, // tax_amount
      0, // discount_amount
      totalAmount,
      totalAmount, // amount_due
      0, // amount_paid
      'USD',
      options.status || 'pending',
      new Date(),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      new Date(),
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    ]
  );

  return result.rows[0];
}
