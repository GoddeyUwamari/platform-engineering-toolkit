/**
 * Mock implementations for Billing Service
 */

import { SubscriptionStatus, BillingCycle } from '../../src/models/tenant-subscription.model';
import { InvoiceStatus } from '../../src/models/invoice.model';
import { generateAccessToken } from '@shared/middleware/auth.middleware';
import { UserRole } from '@shared/types';

// ============================================================================
// Database Connection Mock
// ============================================================================

export const mockQuery = jest.fn();
export const mockQueryOne = jest.fn();
export const mockGetClient = jest.fn();
export const mockSetTenantContext = jest.fn();
export const mockClearTenantContext = jest.fn();

export const mockDatabaseConnection = {
  query: mockQuery,
  queryOne: mockQueryOne,
  getClient: mockGetClient,
  setTenantContext: mockSetTenantContext,
  clearTenantContext: mockClearTenantContext,
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
};

// ============================================================================
// Mock Data - Subscription
// ============================================================================

export const mockTenant = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Company',
  slug: 'test-company',
  billingEmail: 'billing@test.com',
  status: 'ACTIVE',
  settings: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockSubscriptionPlan = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  name: 'professional',
  displayName: 'Professional Plan',
  description: 'Professional tier subscription',
  priceMonthly: 49.99,
  priceYearly: 499.99,
  maxApiCalls: 10000,
  maxStorageGb: 100,
  maxUsers: 10,
  maxProjects: 50,
  hasAdvancedAnalytics: true,
  hasPrioritySupport: true,
  hasCustomBranding: true,
  hasApiAccess: true,
  hasWebhooks: true,
  isActive: true,
  sortOrder: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockTenantSubscription = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  tenantId: mockTenant.id,
  planId: mockSubscriptionPlan.id,
  status: SubscriptionStatus.ACTIVE,
  billingCycle: BillingCycle.MONTHLY,
  currentPrice: 49.99,
  currency: 'USD',
  startedAt: new Date().toISOString(),
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancelledAt: null,
  expiresAt: null,
  autoRenew: true,
  isTrial: false,
  trialEndsAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Mock Data - Invoice
// ============================================================================

export const mockInvoice = {
  id: '123e4567-e89b-12d3-a456-426614174004',
  tenantId: mockTenant.id,
  subscriptionId: mockTenantSubscription.id,
  invoiceNumber: 'INV-20251028-0001',
  subtotal: 49.99,
  taxAmount: 5.00,
  discountAmount: 0,
  totalAmount: 54.99,
  amountPaid: 0,
  amountDue: 54.99,
  currency: 'USD',
  status: InvoiceStatus.DRAFT,
  periodStart: new Date().toISOString(),
  periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  issueDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  paidAt: null,
  paymentMethod: null,
  paymentReference: null,
  notes: 'Test invoice',
  pdfUrl: null,
  pdfGeneratedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockInvoiceItem = {
  id: '123e4567-e89b-12d3-a456-426614174005',
  invoiceId: mockInvoice.id,
  description: 'Professional Plan - Monthly',
  itemType: 'subscription',
  quantity: 1,
  unitPrice: 49.99,
  amount: 49.99,
  taxRate: 10,
  taxAmount: 5.00,
  metadata: {},
  createdAt: new Date().toISOString(),
};

// ============================================================================
// Mock Data - Usage
// ============================================================================

export const mockUsageRecord = {
  id: '123e4567-e89b-12d3-a456-426614174006',
  tenantId: mockTenant.id,
  subscriptionId: mockTenantSubscription.id,
  usageType: 'api_calls',
  quantity: 1000,
  unit: 'requests',
  periodStart: new Date().toISOString(),
  periodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  recordedAt: new Date().toISOString(),
  metadata: {},
  createdAt: new Date().toISOString(),
};

// ============================================================================
// Logger Mock
// ============================================================================

export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// ============================================================================
// PDF Generator Mock
// ============================================================================

export const mockPDFGenerator = {
  generateInvoicePDF: jest.fn(),
};

// ============================================================================
// Mock Reset Helper
// ============================================================================

export function resetAllMocks(): void {
  jest.clearAllMocks();
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockGetClient.mockReset();
  mockSetTenantContext.mockReset();
  mockClearTenantContext.mockReset();
  mockLogger.info.mockReset();
  mockLogger.error.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.debug.mockReset();
  mockPDFGenerator.generateInvoicePDF.mockReset();
}

beforeEach(() => {
  resetAllMocks();
});

// ============================================================================
// Authentication Helper
// ============================================================================

/**
 * Create a valid authentication token for testing
 */
export function createAuthToken(options: {
  userId?: string;
  email?: string;
  role?: UserRole;
  tenantId?: string;
} = {}): string {
  return generateAccessToken({
    userId: options.userId || '123e4567-e89b-12d3-a456-426614174010',
    email: options.email || 'test@example.com',
    role: options.role || UserRole.USER,
    tenantId: options.tenantId || mockTenant.id,
  });
}
