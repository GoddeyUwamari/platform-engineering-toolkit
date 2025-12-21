/**
 * Test Data Factories for Billing Service
 * Generate realistic test data using @faker-js/faker
 */

import { faker } from '@faker-js/faker';
import { Pool } from 'pg';
import {
  TenantSubscription,
  SubscriptionStatus,
  BillingCycle,
  CreateTenantSubscriptionDTO,
  calculateNextPeriodEnd,
} from '../../src/models/tenant-subscription.model';
import {
  Invoice,
  InvoiceStatus,
  CreateInvoiceDTO,
} from '../../src/models/invoice.model';

// ============================================================================
// Tenant Factory
// ============================================================================

export interface CreateTenantOptions {
  name?: string;
  slug?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export function generateTenant(options: CreateTenantOptions = {}) {
  const companyName = options.name || faker.company.name();
  return {
    name: companyName,
    slug: options.slug || faker.helpers.slugify(companyName).toLowerCase(),
    billing_email: faker.internet.email(),
    status: options.status || 'ACTIVE',
    settings: {},
  };
}

export async function createTenant(
  pool: Pool,
  options: CreateTenantOptions = {}
): Promise<any> {
  const tenantData = generateTenant(options);

  const result = await pool.query(
    `INSERT INTO tenants (name, slug, billing_email, status, settings)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, slug, billing_email as "billingEmail", status, settings,
               created_at as "createdAt", updated_at as "updatedAt"`,
    [
      tenantData.name,
      tenantData.slug,
      tenantData.billing_email,
      tenantData.status,
      JSON.stringify(tenantData.settings),
    ]
  );

  return result.rows[0];
}

// ============================================================================
// Subscription Plan Factory
// ============================================================================

export interface CreateSubscriptionPlanOptions {
  name?: string;
  displayName?: string;
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
  isActive?: boolean;
}

export async function createSubscriptionPlan(
  pool: Pool,
  options: CreateSubscriptionPlanOptions = {}
): Promise<any> {
  const planName = options.name || `plan-${faker.string.alphanumeric(8)}`;
  const displayName = options.displayName || 'Professional Plan';

  const result = await pool.query(
    `INSERT INTO subscription_plans (
       name, display_name, description, price_monthly, price_yearly,
       max_api_calls, max_storage_gb, max_users, max_projects,
       has_advanced_analytics, has_priority_support, has_custom_branding,
       has_api_access, has_webhooks, is_active, sort_order
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id, name, display_name as "displayName", description,
               price_monthly as "priceMonthly", price_yearly as "priceYearly",
               max_api_calls as "maxApiCalls", max_storage_gb as "maxStorageGb",
               max_users as "maxUsers", max_projects as "maxProjects",
               has_advanced_analytics as "hasAdvancedAnalytics",
               has_priority_support as "hasPrioritySupport",
               has_custom_branding as "hasCustomBranding",
               has_api_access as "hasApiAccess", has_webhooks as "hasWebhooks",
               is_active as "isActive", sort_order as "sortOrder",
               created_at as "createdAt", updated_at as "updatedAt"`,
    [
      planName,
      displayName,
      faker.lorem.sentence(),
      options.priceMonthly ?? faker.number.float({ min: 10, max: 100, multipleOf: 0.01 }),
      options.priceYearly ?? faker.number.float({ min: 100, max: 1000, multipleOf: 0.01 }),
      options.maxApiCalls ?? 1000,
      options.maxStorageGb ?? 10,
      options.maxUsers ?? 5,
      options.maxProjects ?? 10,
      options.hasAdvancedAnalytics ?? false,
      options.hasPrioritySupport ?? false,
      options.hasCustomBranding ?? false,
      options.hasApiAccess ?? true,
      options.hasWebhooks ?? false,
      options.isActive ?? true,
      0, // sort_order
    ]
  );

  return result.rows[0];
}

// ============================================================================
// Tenant Subscription Factory
// ============================================================================

export interface CreateTenantSubscriptionOptions {
  tenantId?: string;
  planId?: string;
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  currentPrice?: number;
  isTrial?: boolean;
  autoRenew?: boolean;
}

export function generateTenantSubscription(
  options: CreateTenantSubscriptionOptions = {}
): Omit<CreateTenantSubscriptionDTO, 'tenantId' | 'planId'> {
  const billingCycle = options.billingCycle || BillingCycle.MONTHLY;
  const startedAt = new Date();
  const currentPeriodStart = startedAt;
  const currentPeriodEnd = calculateNextPeriodEnd(currentPeriodStart, billingCycle);

  return {
    billingCycle,
    currentPrice: options.currentPrice || faker.number.float({ min: 10, max: 100, multipleOf: 0.01 }),
    currency: 'USD',
    startedAt,
    currentPeriodStart,
    currentPeriodEnd,
    autoRenew: options.autoRenew ?? true,
    isTrial: options.isTrial || false,
    trialEndsAt: options.isTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : undefined,
  };
}

export async function createTenantSubscription(
  pool: Pool,
  options: CreateTenantSubscriptionOptions = {}
): Promise<TenantSubscription> {
  const subscriptionData = generateTenantSubscription(options);

  if (!options.tenantId || !options.planId) {
    throw new Error('tenantId and planId are required');
  }

  const result = await pool.query(
    `INSERT INTO tenant_subscriptions (
      tenant_id, plan_id, status, billing_cycle, current_price, currency,
      started_at, current_period_start, current_period_end,
      auto_renew, is_trial, trial_ends_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id, tenant_id as "tenantId", plan_id as "planId", status,
              billing_cycle as "billingCycle", current_price as "currentPrice", currency,
              started_at as "startedAt", current_period_start as "currentPeriodStart",
              current_period_end as "currentPeriodEnd", cancelled_at as "cancelledAt",
              expires_at as "expiresAt", auto_renew as "autoRenew", is_trial as "isTrial",
              trial_ends_at as "trialEndsAt", created_at as "createdAt", updated_at as "updatedAt"`,
    [
      options.tenantId,
      options.planId,
      options.status || SubscriptionStatus.ACTIVE,
      subscriptionData.billingCycle,
      subscriptionData.currentPrice,
      subscriptionData.currency,
      subscriptionData.startedAt,
      subscriptionData.currentPeriodStart,
      subscriptionData.currentPeriodEnd,
      subscriptionData.autoRenew,
      subscriptionData.isTrial,
      subscriptionData.trialEndsAt || null,
    ]
  );

  return result.rows[0]!;
}

// ============================================================================
// Invoice Factory
// ============================================================================

export interface CreateInvoiceOptions {
  tenantId?: string;
  subscriptionId?: string;
  status?: InvoiceStatus;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  periodStart?: Date;
  periodEnd?: Date;
}

export function generateInvoice(options: CreateInvoiceOptions = {}): Omit<CreateInvoiceDTO, 'tenantId'> {
  const periodStart = options.periodStart || new Date();
  const periodEnd = options.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  return {
    subscriptionId: options.subscriptionId,
    periodStart,
    periodEnd,
    dueDate,
    currency: 'USD',
    notes: faker.lorem.sentence(),
  };
}

export async function createInvoice(
  pool: Pool,
  options: CreateInvoiceOptions = {}
): Promise<Invoice> {
  if (!options.tenantId) {
    throw new Error('tenantId is required');
  }

  const invoiceData = generateInvoice(options);
  const issueDate = new Date();

  // Generate invoice number
  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM invoices WHERE tenant_id = $1`,
    [options.tenantId]
  );
  const count = parseInt(countResult.rows[0]?.count || '0') + 1;
  const year = issueDate.getFullYear();
  const month = String(issueDate.getMonth() + 1).padStart(2, '0');
  const day = String(issueDate.getDate()).padStart(2, '0');
  const sequence = String(count).padStart(4, '0');
  const invoiceNumber = `INV-${year}${month}${day}-${sequence}`;

  const subtotal = options.subtotal || faker.number.float({ min: 50, max: 500, multipleOf: 0.01 });
  const taxAmount = options.taxAmount || subtotal * 0.1;
  const totalAmount = options.totalAmount || subtotal + taxAmount;

  const result = await pool.query(
    `INSERT INTO invoices (
      tenant_id, subscription_id, invoice_number, subtotal, tax_amount,
      discount_amount, total_amount, amount_due, amount_paid, currency,
      status, period_start, period_end, issue_date, due_date, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING id, tenant_id as "tenantId", subscription_id as "subscriptionId",
              invoice_number as "invoiceNumber", subtotal, tax_amount as "taxAmount",
              discount_amount as "discountAmount", total_amount as "totalAmount",
              amount_paid as "amountPaid", amount_due as "amountDue", currency, status,
              period_start as "periodStart", period_end as "periodEnd",
              issue_date as "issueDate", due_date as "dueDate", paid_at as "paidAt",
              payment_method as "paymentMethod", payment_reference as "paymentReference",
              notes, pdf_url as "pdfUrl", pdf_generated_at as "pdfGeneratedAt",
              created_at as "createdAt", updated_at as "updatedAt"`,
    [
      options.tenantId,
      invoiceData.subscriptionId || null,
      invoiceNumber,
      subtotal,
      taxAmount,
      0, // discount_amount
      totalAmount,
      totalAmount, // amount_due
      0, // amount_paid
      invoiceData.currency,
      options.status || InvoiceStatus.DRAFT,
      invoiceData.periodStart,
      invoiceData.periodEnd,
      issueDate,
      invoiceData.dueDate,
      invoiceData.notes,
    ]
  );

  return result.rows[0]!;
}

// ============================================================================
// Invoice Item Factory
// ============================================================================

export interface CreateInvoiceItemOptions {
  invoiceId?: string;
  description?: string;
  itemType?: 'subscription' | 'usage' | 'credit' | 'fee' | 'discount';
  quantity?: number;
  unitPrice?: number;
  taxRate?: number;
}

export async function createInvoiceItem(
  pool: Pool,
  options: CreateInvoiceItemOptions = {}
): Promise<any> {
  if (!options.invoiceId) {
    throw new Error('invoiceId is required');
  }

  const quantity = options.quantity || faker.number.int({ min: 1, max: 10 });
  const unitPrice = options.unitPrice || faker.number.float({ min: 10, max: 100, multipleOf: 0.01 });
  const amount = quantity * unitPrice;
  const taxRate = options.taxRate || 10;
  const taxAmount = amount * (taxRate / 100);

  const result = await pool.query(
    `INSERT INTO invoice_items (
      invoice_id, description, item_type, quantity, unit_price,
      amount, tax_rate, tax_amount, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, invoice_id as "invoiceId", description, item_type as "itemType",
              quantity, unit_price as "unitPrice", amount, tax_rate as "taxRate",
              tax_amount as "taxAmount", metadata, created_at as "createdAt"`,
    [
      options.invoiceId,
      options.description || faker.commerce.productName(),
      options.itemType || 'subscription',
      quantity,
      unitPrice,
      amount,
      taxRate,
      taxAmount,
      JSON.stringify({}),
    ]
  );

  return result.rows[0];
}

// ============================================================================
// Usage Record Factory
// ============================================================================

export interface CreateUsageRecordOptions {
  tenantId?: string;
  subscriptionId?: string;
  usageType?: string;
  quantity?: number;
  unit?: string;
  periodStart?: Date | string;
  periodEnd?: Date | string;
}

export async function createUsageRecord(
  pool: Pool,
  options: CreateUsageRecordOptions = {}
): Promise<any> {
  if (!options.tenantId) {
    throw new Error('tenantId is required');
  }

  const periodStart = options.periodStart || new Date();
  const periodEnd = options.periodEnd || new Date(Date.now() + 24 * 60 * 60 * 1000);

  const result = await pool.query(
    `INSERT INTO usage_records (
      tenant_id, subscription_id, usage_type, quantity, unit,
      period_start, period_end, recorded_at, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, tenant_id as "tenantId", subscription_id as "subscriptionId",
              usage_type as "usageType", quantity, unit,
              period_start as "periodStart", period_end as "periodEnd",
              recorded_at as "recordedAt", metadata, created_at as "createdAt"`,
    [
      options.tenantId,
      options.subscriptionId || null,
      options.usageType || 'api_calls',
      options.quantity || faker.number.int({ min: 1, max: 1000 }),
      options.unit || 'requests',
      periodStart,
      periodEnd,
      new Date(),
      JSON.stringify({}),
    ]
  );

  return result.rows[0];
}

// ============================================================================
// Complete Test Setup Factory
// ============================================================================

export interface CreateBillingTestDataOptions {
  subscriptionStatus?: SubscriptionStatus;
  invoiceStatus?: InvoiceStatus;
}

/**
 * Creates a complete billing test setup (tenant, plan, subscription, invoice)
 */
export async function createBillingTestData(
  pool: Pool,
  options: CreateBillingTestDataOptions = {}
): Promise<{
  tenant: any;
  plan: any;
  subscription: TenantSubscription;
  invoice: Invoice;
}> {
  // Create tenant
  const tenant = await createTenant(pool);

  // Create subscription plan
  const plan = await createSubscriptionPlan(pool);

  // Create tenant subscription
  const subscription = await createTenantSubscription(pool, {
    tenantId: tenant.id,
    planId: plan.id,
    status: options.subscriptionStatus || SubscriptionStatus.ACTIVE,
  });

  // Create invoice
  const invoice = await createInvoice(pool, {
    tenantId: tenant.id,
    subscriptionId: subscription.id,
    status: options.invoiceStatus || InvoiceStatus.DRAFT,
  });

  return { tenant, plan, subscription, invoice };
}
