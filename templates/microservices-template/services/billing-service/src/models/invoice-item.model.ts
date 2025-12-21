/**
 * Invoice Item Model
 * Represents line items for each invoice
 * Maps to: invoice_items table
 */

import type { BaseEntity } from '@shared/types';

// ============================================================================
// Enums (matching DB constraints)
// ============================================================================

export enum InvoiceItemType {
  SUBSCRIPTION = 'subscription',     // Subscription fee
  USAGE = 'usage',                   // Usage-based charge
  CREDIT = 'credit',                 // Credit applied (negative amount)
  FEE = 'fee',                       // Additional fee
  DISCOUNT = 'discount',             // Discount applied (negative amount)
}

// ============================================================================
// Invoice Item Interface (matches DB schema exactly)
// ============================================================================

export interface InvoiceItem extends Omit<BaseEntity, 'updatedAt' | 'deletedAt'> {
  // Foreign Key
  invoiceId: string;                  // References invoices(id)
  
  // Item Details
  description: string;                // Line item description
  itemType: InvoiceItemType;          // subscription, usage, credit, fee, discount
  
  // Quantities & Pricing (DECIMAL 10,2)
  quantity: number;                   // Quantity of items
  unitPrice: number;                  // Price per unit
  amount: number;                     // Total amount (quantity * unitPrice)
  
  // Tax
  taxRate: number;                    // Tax rate percentage (DECIMAL 5,2)
  taxAmount: number;                  // Calculated tax amount
  
  // Additional Data
  metadata?: Record<string, unknown>; // Extra data (JSONB)
  
  // Timestamps (only createdAt, no updatedAt)
  createdAt: Date | string;
}

// ============================================================================
// Create DTO
// ============================================================================

export interface CreateInvoiceItemDTO {
  invoiceId: string;
  description: string;
  itemType: InvoiceItemType;
  quantity: number;
  unitPrice: number;
  taxRate?: number;                   // Default: 0
  metadata?: Record<string, unknown>;
  // amount and taxAmount will be calculated
}

// ============================================================================
// Update DTO
// ============================================================================

export interface UpdateInvoiceItemDTO {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  taxRate?: number;
  metadata?: Record<string, unknown>;
  // amount and taxAmount will be recalculated if quantity/price/tax changes
}

// ============================================================================
// Query Filters
// ============================================================================

export interface InvoiceItemFilters {
  invoiceId?: string;
  itemType?: InvoiceItemType;
  minAmount?: number;
  maxAmount?: number;
}

// ============================================================================
// Database Column Mapping
// ============================================================================

/**
 * Maps database columns to InvoiceItem interface
 * Used for SELECT queries with proper camelCase conversion
 */
export const INVOICE_ITEM_COLUMNS = `
  id,
  invoice_id as "invoiceId",
  description,
  item_type as "itemType",
  quantity,
  unit_price as "unitPrice",
  amount,
  tax_rate as "taxRate",
  tax_amount as "taxAmount",
  metadata,
  created_at as "createdAt"
`;

// ============================================================================
// Amount Calculations
// ============================================================================

/**
 * Calculate line item amount (quantity × unit price)
 */
export const calculateAmount = (quantity: number, unitPrice: number): number => {
  const amount = quantity * unitPrice;
  return Math.round(amount * 100) / 100; // Round to 2 decimals
};

/**
 * Calculate tax amount based on amount and tax rate
 */
export const calculateTaxAmount = (amount: number, taxRate: number): number => {
  const tax = amount * (taxRate / 100);
  return Math.round(tax * 100) / 100; // Round to 2 decimals
};

/**
 * Calculate line item total (amount + tax)
 */
export const calculateTotal = (amount: number, taxAmount: number): number => {
  const total = amount + taxAmount;
  return Math.round(total * 100) / 100;
};

/**
 * Build complete line item with calculated amounts
 */
export const buildInvoiceItem = (dto: CreateInvoiceItemDTO): Omit<InvoiceItem, 'id' | 'createdAt'> => {
  const amount = calculateAmount(dto.quantity, dto.unitPrice);
  const taxRate = dto.taxRate || 0;
  const taxAmount = calculateTaxAmount(amount, taxRate);
  
  return {
    invoiceId: dto.invoiceId,
    description: dto.description,
    itemType: dto.itemType,
    quantity: dto.quantity,
    unitPrice: dto.unitPrice,
    amount,
    taxRate,
    taxAmount,
    metadata: dto.metadata,
  };
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate quantity (must be positive)
 */
export const isValidQuantity = (quantity: number): boolean => {
  return quantity > 0 && Number.isFinite(quantity);
};

/**
 * Validate unit price (can be negative for credits/discounts)
 */
export const isValidUnitPrice = (unitPrice: number): boolean => {
  return Number.isFinite(unitPrice);
};

/**
 * Validate tax rate (0-100%)
 */
export const isValidTaxRate = (taxRate: number): boolean => {
  return taxRate >= 0 && taxRate <= 100 && Number.isFinite(taxRate);
};

/**
 * Check if line item is a credit (negative amount)
 */
export const isCredit = (item: InvoiceItem): boolean => {
  return item.itemType === InvoiceItemType.CREDIT || item.amount < 0;
};

/**
 * Check if line item is a discount (negative amount)
 */
export const isDiscount = (item: InvoiceItem): boolean => {
  return item.itemType === InvoiceItemType.DISCOUNT || item.amount < 0;
};

/**
 * Check if line item is a charge (positive amount)
 */
export const isCharge = (item: InvoiceItem): boolean => {
  return item.amount > 0;
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
 * Format quantity with unit
 */
export const formatQuantity = (quantity: number, unit?: string): string => {
  if (unit) {
    return `${quantity} ${unit}${quantity !== 1 ? 's' : ''}`;
  }
  return String(quantity);
};

/**
 * Format tax rate as percentage
 */
export const formatTaxRate = (taxRate: number): string => {
  return `${taxRate.toFixed(2)}%`;
};

/**
 * Get human-readable item type
 */
export const getItemTypeLabel = (itemType: InvoiceItemType): string => {
  switch (itemType) {
    case InvoiceItemType.SUBSCRIPTION:
      return 'Subscription';
    case InvoiceItemType.USAGE:
      return 'Usage';
    case InvoiceItemType.CREDIT:
      return 'Credit';
    case InvoiceItemType.FEE:
      return 'Fee';
    case InvoiceItemType.DISCOUNT:
      return 'Discount';
    default:
      return 'Unknown';
  }
};

// ============================================================================
// Line Item Builders (Common Patterns)
// ============================================================================

/**
 * Create subscription line item
 */
export const createSubscriptionItem = (
  invoiceId: string,
  planName: string,
  price: number,
  billingCycle: 'monthly' | 'yearly',
  taxRate: number = 0
): Omit<InvoiceItem, 'id' | 'createdAt'> => {
  const description = `${planName} - ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`;
  
  return buildInvoiceItem({
    invoiceId,
    description,
    itemType: InvoiceItemType.SUBSCRIPTION,
    quantity: 1,
    unitPrice: price,
    taxRate,
  });
};

/**
 * Create usage-based line item
 */
export const createUsageItem = (
  invoiceId: string,
  usageType: string,
  quantity: number,
  unitPrice: number,
  unit: string,
  taxRate: number = 0
): Omit<InvoiceItem, 'id' | 'createdAt'> => {
  const description = `${usageType} (${quantity.toLocaleString()} ${unit})`;
  
  return buildInvoiceItem({
    invoiceId,
    description,
    itemType: InvoiceItemType.USAGE,
    quantity,
    unitPrice,
    taxRate,
    metadata: { usageType, unit },
  });
};

/**
 * Create credit line item (negative amount)
 */
export const createCreditItem = (
  invoiceId: string,
  description: string,
  amount: number,
  reason?: string
): Omit<InvoiceItem, 'id' | 'createdAt'> => {
  return buildInvoiceItem({
    invoiceId,
    description,
    itemType: InvoiceItemType.CREDIT,
    quantity: 1,
    unitPrice: -Math.abs(amount), // Ensure negative
    taxRate: 0,
    metadata: reason ? { reason } : undefined,
  });
};

/**
 * Create discount line item (negative amount)
 */
export const createDiscountItem = (
  invoiceId: string,
  description: string,
  discountAmount: number,
  discountCode?: string
): Omit<InvoiceItem, 'id' | 'createdAt'> => {
  return buildInvoiceItem({
    invoiceId,
    description,
    itemType: InvoiceItemType.DISCOUNT,
    quantity: 1,
    unitPrice: -Math.abs(discountAmount), // Ensure negative
    taxRate: 0,
    metadata: discountCode ? { discountCode } : undefined,
  });
};

/**
 * Create percentage discount line item
 */
export const createPercentageDiscountItem = (
  invoiceId: string,
  subtotal: number,
  discountPercent: number,
  description?: string
): Omit<InvoiceItem, 'id' | 'createdAt'> => {
  const discountAmount = subtotal * (discountPercent / 100);
  const desc = description || `${discountPercent}% Discount`;
  
  return createDiscountItem(invoiceId, desc, discountAmount);
};

/**
 * Create additional fee line item
 */
export const createFeeItem = (
  invoiceId: string,
  description: string,
  amount: number,
  taxRate: number = 0
): Omit<InvoiceItem, 'id' | 'createdAt'> => {
  return buildInvoiceItem({
    invoiceId,
    description,
    itemType: InvoiceItemType.FEE,
    quantity: 1,
    unitPrice: amount,
    taxRate,
  });
};

// ============================================================================
// Aggregation Helpers
// ============================================================================

/**
 * Calculate subtotal from multiple line items
 */
export const calculateSubtotal = (items: InvoiceItem[]): number => {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  return Math.round(subtotal * 100) / 100;
};

/**
 * Calculate total tax from multiple line items
 */
export const calculateTotalTax = (items: InvoiceItem[]): number => {
  const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
  return Math.round(totalTax * 100) / 100;
};

/**
 * Calculate grand total (subtotal + tax)
 */
export const calculateGrandTotal = (items: InvoiceItem[]): number => {
  const subtotal = calculateSubtotal(items);
  const tax = calculateTotalTax(items);
  return Math.round((subtotal + tax) * 100) / 100;
};

/**
 * Group items by type
 */
export const groupItemsByType = (items: InvoiceItem[]): Record<InvoiceItemType, InvoiceItem[]> => {
  return items.reduce((acc, item) => {
    if (!acc[item.itemType]) {
      acc[item.itemType] = [];
    }
    acc[item.itemType].push(item);
    return acc;
  }, {} as Record<InvoiceItemType, InvoiceItem[]>);
};

/**
 * Get summary of line items
 */
export const getItemsSummary = (items: InvoiceItem[]): {
  totalItems: number;
  totalQuantity: number;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  itemsByType: Record<InvoiceItemType, number>;
} => {
  const grouped = groupItemsByType(items);
  const itemsByType = Object.keys(grouped).reduce((acc, key) => {
    acc[key as InvoiceItemType] = grouped[key as InvoiceItemType].length;
    return acc;
  }, {} as Record<InvoiceItemType, number>);
  
  return {
    totalItems: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: calculateSubtotal(items),
    totalTax: calculateTotalTax(items),
    grandTotal: calculateGrandTotal(items),
    itemsByType,
  };
};