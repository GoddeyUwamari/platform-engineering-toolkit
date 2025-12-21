/**
 * Invoice Model
 * Represents invoice headers with totals and payment info
 * Maps to: invoices table
 */

import type { BaseEntity } from '@shared/types';

// ============================================================================
// Enums (matching DB constraints)
// ============================================================================

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  PAYPAL = 'paypal',
  STRIPE = 'stripe',
  MANUAL = 'manual',
}

// ============================================================================
// Invoice Interface (matches DB schema exactly)
// ============================================================================

export interface Invoice extends BaseEntity {
  // Foreign Keys
  tenantId: string;                   // References tenants(id)
  subscriptionId?: string;            // References tenant_subscriptions(id) - nullable
  
  // Invoice Info
  invoiceNumber: string;              // Unique invoice number (e.g., INV-20251025-0001)
  
  // Amounts (DECIMAL 10,2)
  subtotal: number;                   // Sum of line items before tax/discount
  taxAmount: number;                  // Total tax amount
  discountAmount: number;             // Total discount amount
  totalAmount: number;                // Final amount (subtotal + tax - discount)
  amountPaid: number;                 // Amount already paid
  amountDue: number;                  // Remaining amount to be paid
  currency: string;                   // ISO currency code (default: USD)
  
  // Status
  status: InvoiceStatus;              // draft, open, paid, void, uncollectible
  
  // Period
  periodStart: Date | string;         // Billing period start
  periodEnd: Date | string;           // Billing period end
  
  // Dates
  issueDate: Date | string;           // When invoice was issued
  dueDate: Date | string;             // When payment is due
  paidAt?: Date | string;             // When invoice was paid
  
  // Payment Info
  paymentMethod?: string;             // Payment method used
  paymentReference?: string;          // External payment reference
  
  // Additional Info
  notes?: string;                     // Internal notes
  
  // PDF Generation
  pdfUrl?: string;                    // URL to generated PDF
  pdfGeneratedAt?: Date | string;     // When PDF was generated
}

// ============================================================================
// Invoice with Items (for detailed views)
// ============================================================================

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];               // Line items (from invoice_items table)
}

// ============================================================================
// Invoice Item Interface (for reference)
// ============================================================================

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  itemType: 'subscription' | 'usage' | 'credit' | 'fee' | 'discount';
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: number;
  taxAmount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
}

// ============================================================================
// Create DTO
// ============================================================================

export interface CreateInvoiceDTO {
  tenantId: string;
  subscriptionId?: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  issueDate?: Date | string;          // Default: now
  dueDate: Date | string;             // Required
  currency?: string;                  // Default: USD
  notes?: string;
  // Amounts will be calculated from line items
}

// ============================================================================
// Update DTO
// ============================================================================

export interface UpdateInvoiceDTO {
  status?: InvoiceStatus;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  amountPaid?: number;
  amountDue?: number;
  dueDate?: Date | string;
  paidAt?: Date | string;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  pdfUrl?: string;
  pdfGeneratedAt?: Date | string;
}

// ============================================================================
// Query Filters
// ============================================================================

export interface InvoiceFilters {
  tenantId?: string;
  subscriptionId?: string;
  status?: InvoiceStatus;
  minAmount?: number;
  maxAmount?: number;
  periodStart?: Date | string;
  periodEnd?: Date | string;
  isOverdue?: boolean;                // Due date passed and not paid
  isPaid?: boolean;                   // Status === 'paid'
  isDraft?: boolean;                  // Status === 'draft'
}

// ============================================================================
// Database Column Mapping
// ============================================================================

/**
 * Maps database columns to Invoice interface
 * Used for SELECT queries with proper camelCase conversion
 */
export const INVOICE_COLUMNS = `
  id,
  tenant_id as "tenantId",
  subscription_id as "subscriptionId",
  invoice_number as "invoiceNumber",
  subtotal::numeric::float8 as subtotal,
  tax_amount::numeric::float8 as "taxAmount",
  discount_amount::numeric::float8 as "discountAmount",
  total_amount::numeric::float8 as "totalAmount",
  amount_paid::numeric::float8 as "amountPaid",
  amount_due::numeric::float8 as "amountDue",
  currency,
  status,
  period_start as "periodStart",
  period_end as "periodEnd",
  issue_date as "issueDate",
  due_date as "dueDate",
  paid_at as "paidAt",
  payment_method as "paymentMethod",
  payment_reference as "paymentReference",
  notes,
  pdf_url as "pdfUrl",
  pdf_generated_at as "pdfGeneratedAt",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

// ============================================================================
// Invoice Number Generation
// ============================================================================

/**
 * Generate unique invoice number
 * Format: INV-YYYYMMDD-XXXX
 * Example: INV-20251025-0001
 */
export const generateInvoiceNumber = (sequence: number): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');
  
  return `INV-${year}${month}${day}-${seq}`;
};

/**
 * Parse invoice number to extract date and sequence
 */
export const parseInvoiceNumber = (invoiceNumber: string): { date: Date; sequence: number } | null => {
  const match = invoiceNumber.match(/^INV-(\d{4})(\d{2})(\d{2})-(\d{4})$/);
  if (!match) return null;

  const [, year, month, day, seq] = match;
  return {
    date: new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!)),
    sequence: parseInt(seq!),
  };
};

// ============================================================================
// Status Helpers
// ============================================================================

/**
 * Check if invoice is paid
 */
export const isPaid = (invoice: Invoice): boolean => {
  return invoice.status === InvoiceStatus.PAID;
};

/**
 * Check if invoice is overdue
 */
export const isOverdue = (invoice: Invoice): boolean => {
  if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOID) {
    return false;
  }
  const dueDate = new Date(invoice.dueDate);
  const now = new Date();
  return now > dueDate;
};

/**
 * Check if invoice is draft
 */
export const isDraft = (invoice: Invoice): boolean => {
  return invoice.status === InvoiceStatus.DRAFT;
};

/**
 * Check if invoice can be paid
 */
export const canBePaid = (invoice: Invoice): boolean => {
  return (
    invoice.status === InvoiceStatus.OPEN &&
    invoice.amountDue > 0
  );
};

/**
 * Check if invoice can be voided
 */
export const canBeVoided = (invoice: Invoice): boolean => {
  return (
    invoice.status === InvoiceStatus.DRAFT ||
    invoice.status === InvoiceStatus.OPEN
  );
};

/**
 * Get days until due (negative if overdue)
 */
export const getDaysUntilDue = (invoice: Invoice): number => {
  const dueDate = new Date(invoice.dueDate);
  const now = new Date();
  const diffTime = dueDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Get user-friendly status message
 */
export const getStatusMessage = (invoice: Invoice): string => {
  switch (invoice.status) {
    case InvoiceStatus.DRAFT:
      return 'Draft';
    case InvoiceStatus.OPEN:
      if (isOverdue(invoice)) {
        const daysOverdue = Math.abs(getDaysUntilDue(invoice));
        return `Overdue (${daysOverdue} days)`;
      }
      const daysUntilDue = getDaysUntilDue(invoice);
      if (daysUntilDue <= 7) {
        return `Due in ${daysUntilDue} days`;
      }
      return 'Open';
    case InvoiceStatus.PAID:
      return 'Paid';
    case InvoiceStatus.VOID:
      return 'Void';
    case InvoiceStatus.UNCOLLECTIBLE:
      return 'Uncollectible';
    default:
      return 'Unknown';
  }
};

// ============================================================================
// Amount Calculations
// ============================================================================

/**
 * Calculate invoice totals from line items
 */
export const calculateInvoiceTotals = (items: InvoiceItem[]): {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
} => {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const totalAmount = subtotal + taxAmount;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimals
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
};

/**
 * Calculate amount due after payment
 */
export const calculateAmountDue = (totalAmount: number, amountPaid: number): number => {
  const due = totalAmount - amountPaid;
  return Math.max(0, Math.round(due * 100) / 100);
};

/**
 * Apply discount to invoice
 */
export const applyDiscount = (
  subtotal: number,
  discountAmount: number
): number => {
  const newSubtotal = subtotal - discountAmount;
  return Math.max(0, Math.round(newSubtotal * 100) / 100);
};

/**
 * Calculate tax amount
 */
export const calculateTax = (
  subtotal: number,
  taxRate: number
): number => {
  const tax = subtotal * (taxRate / 100);
  return Math.round(tax * 100) / 100;
};

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format amount with currency symbol
 */
export const formatAmount = (amount: number, currency: string = 'USD'): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  return formatter.format(amount);
};

/**
 * Format date for display
 */
export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format invoice period
 */
export const formatPeriod = (invoice: Invoice): string => {
  const start = formatDate(invoice.periodStart);
  const end = formatDate(invoice.periodEnd);
  return `${start} - ${end}`;
};

// ============================================================================
// Payment Helpers
// ============================================================================

/**
 * Mark invoice as paid
 */
export const markAsPaid = (
  invoice: Invoice,
  paymentMethod: string,
  paymentReference?: string
): Partial<Invoice> => {
  return {
    status: InvoiceStatus.PAID,
    amountPaid: invoice.totalAmount,
    amountDue: 0,
    paidAt: new Date().toISOString(),
    paymentMethod,
    paymentReference,
  };
};

/**
 * Record partial payment
 */
export const recordPartialPayment = (
  invoice: Invoice,
  paymentAmount: number
): Partial<Invoice> => {
  const newAmountPaid = invoice.amountPaid + paymentAmount;
  const newAmountDue = calculateAmountDue(invoice.totalAmount, newAmountPaid);
  
  return {
    amountPaid: newAmountPaid,
    amountDue: newAmountDue,
    status: newAmountDue === 0 ? InvoiceStatus.PAID : invoice.status,
    paidAt: newAmountDue === 0 ? new Date().toISOString() : invoice.paidAt,
  };
};