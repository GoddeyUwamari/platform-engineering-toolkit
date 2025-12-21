// services/billing-service/src/utils/billing-utils.ts

/**
 * Billing Utilities
 * Comprehensive utility functions for billing operations
 */

import { BillingCycle } from '@shared/types';

// ============================================================================
// Constants
// ============================================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'Fr',
  CNY: '¥',
  INR: '₹',
};

// ============================================================================
// Date Calculation Functions
// ============================================================================

/**
 * Calculate billing period dates
 */
export function calculateBillingPeriod(
  startDate: Date,
  billingCycle: BillingCycle
): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(startDate);
  const periodEnd = new Date(startDate);

  switch (billingCycle) {
    case BillingCycle.MONTHLY:
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      break;
    case BillingCycle.QUARTERLY:
      periodEnd.setMonth(periodEnd.getMonth() + 3);
      break;
    case BillingCycle.YEARLY:
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      break;
  }

  periodEnd.setDate(periodEnd.getDate() - 1);
  return { periodStart, periodEnd };
}

/**
 * Calculate next billing date
 */
export function calculateNextBillingDate(
  currentDate: Date,
  billingCycle: BillingCycle
): Date {
  const nextDate = new Date(currentDate);

  switch (billingCycle) {
    case BillingCycle.MONTHLY:
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case BillingCycle.QUARTERLY:
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case BillingCycle.YEARLY:
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }

  return nextDate;
}

/**
 * Calculate due date from invoice date
 */
export function calculateDueDate(invoiceDate: Date, daysUntilDue: number = 30): Date {
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + daysUntilDue);
  return dueDate;
}

/**
 * Check if invoice is overdue
 */
export function isOverdue(dueDate: Date): boolean {
  return new Date() > new Date(dueDate);
}

/**
 * Get days overdue
 */
export function getDaysOverdue(dueDate: Date): number {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Calculate prorated amount
 */
export function calculateProration(
  fullAmount: number,
  totalDays: number,
  usedDays: number
): number {
  if (totalDays === 0) return 0;
  return roundAmount((fullAmount / totalDays) * usedDays);
}

/**
 * Get days in billing cycle
 */
export function getDaysInBillingCycle(
  startDate: Date,
  billingCycle: BillingCycle
): number {
  const { periodEnd } = calculateBillingPeriod(startDate, billingCycle);
  const diffTime = periodEnd.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Check if date is in billing period
 */
export function isDateInBillingPeriod(
  date: Date,
  periodStart: Date,
  periodEnd: Date
): boolean {
  const checkDate = new Date(date);
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  return checkDate >= start && checkDate <= end;
}

// ============================================================================
// Price Formatting Functions
// ============================================================================

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

/**
 * Format price with custom symbol
 */
export function formatPrice(
  amount: number,
  currencyCode: string = 'USD',
  includeSymbol: boolean = true
): string {
  const formatted = roundAmount(amount).toFixed(2);
  if (!includeSymbol) return formatted;

  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${formatted}`;
}

/**
 * Parse currency string to number
 */
export function parseCurrency(currencyString: string): number {
  const cleaned = currencyString.replace(/[^0-9.-]+/g, '');
  return parseFloat(cleaned);
}

/**
 * Round amount to 2 decimal places
 */
export function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Convert currency (placeholder - use real API)
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate: number
): number {
  if (fromCurrency === toCurrency) return amount;
  return roundAmount(amount * exchangeRate);
}

/**
 * Format amount with thousand separators
 */
export function formatAmountWithSeparators(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Calculate percentage of amount
 */
export function calculatePercentage(amount: number, percentage: number): number {
  return roundAmount((amount * percentage) / 100);
}

/**
 * Apply discount to amount
 */
export function applyDiscount(
  amount: number,
  discountPercentage: number
): number {
  const discount = calculatePercentage(amount, discountPercentage);
  return roundAmount(amount - discount);
}

// ============================================================================
// Tax Calculation Functions
// ============================================================================

/**
 * Calculate tax amount
 */
export function calculateTax(amount: number, taxRate: number): number {
  return roundAmount((amount * taxRate) / 100);
}

/**
 * Calculate total with tax
 */
export function calculateTotalWithTax(
  subtotal: number,
  taxRate: number
): number {
  const tax = calculateTax(subtotal, taxRate);
  return roundAmount(subtotal + tax);
}

/**
 * Calculate tax with multiple rates
 */
export function calculateTaxWithMultipleRates(
  amount: number,
  taxRates: number[]
): number {
  const totalTaxRate = taxRates.reduce((sum, rate) => sum + rate, 0);
  return calculateTax(amount, totalTaxRate);
}

/**
 * Calculate reverse tax (extract tax from total)
 */
export function calculateReverseTax(
  totalWithTax: number,
  taxRate: number
): { subtotal: number; tax: number } {
  const subtotal = roundAmount(totalWithTax / (1 + taxRate / 100));
  const tax = roundAmount(totalWithTax - subtotal);
  return { subtotal, tax };
}

/**
 * Validate tax rate
 */
export function isValidTaxRate(taxRate: number): boolean {
  return taxRate >= 0 && taxRate <= 100;
}

/**
 * Calculate line item taxes
 */
export function calculateLineItemTaxes(
  lineItems: Array<{ amount: number; taxRate: number }>
): number {
  return lineItems.reduce((total, item) => {
    return total + calculateTax(item.amount, item.taxRate);
  }, 0);
}

// ============================================================================
// Invoice Number Generation
// ============================================================================

/**
 * Generate invoice number
 */
export function generateInvoiceNumber(
  sequenceNumber: number,
  options: {
    prefix?: string;
    length?: number;
    includeYear?: boolean;
    includeMonth?: boolean;
  } = {}
): string {
  const {
    prefix = 'INV',
    length = 6,
    includeYear = true,
    includeMonth = true,
  } = options;

  const paddedNumber = sequenceNumber.toString().padStart(length, '0');
  const date = new Date();
  const year = includeYear ? date.getFullYear().toString().slice(-2) : '';
  const month = includeMonth
    ? (date.getMonth() + 1).toString().padStart(2, '0')
    : '';

  const parts = [prefix, year, month, paddedNumber].filter(Boolean);
  return parts.join('-');
}

/**
 * Generate simple invoice number
 */
export function generateSimpleInvoiceNumber(sequenceNumber: number): string {
  return `INV-${sequenceNumber.toString().padStart(8, '0')}`;
}

/**
 * Parse invoice number
 */
export function parseInvoiceNumber(invoiceNumber: string): {
  prefix: string;
  year: string | undefined;
  month: string | undefined;
  sequence: string;
} | null {
  const parts = invoiceNumber.split('-');
  if (parts.length < 2) return null;

  const [prefix, ...rest] = parts;
  const sequence = rest[rest.length - 1];

  return {
    prefix: prefix!,
    year: rest.length >= 3 ? rest[0] : undefined,
    month: rest.length >= 3 ? rest[1] : undefined,
    sequence: sequence!,
  };
}

/**
 * Validate invoice number format
 */
export function isValidInvoiceNumber(invoiceNumber: string): boolean {
  return /^[A-Z]+-\d+(-\d+)*$/.test(invoiceNumber);
}

/**
 * Generate invoice number for a specific tenant
 */
export function generateTenantInvoiceNumber(
  tenantId: string,
  sequenceNumber: number
): string {
  const tenantPrefix = tenantId.slice(0, 4).toUpperCase();
  return generateInvoiceNumber(sequenceNumber, {
    prefix: `INV-${tenantPrefix}`,
    length: 6,
    includeYear: true,
    includeMonth: true,
  });
}

// ============================================================================
// Utility Helper Functions
// ============================================================================

/**
 * Calculate aging of an invoice
 */
export function calculateInvoiceAging(
  dueDate: Date
): 'current' | '1-30' | '31-60' | '61-90' | '90+' {
  const daysOverdue = getDaysOverdue(dueDate);

  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

/**
 * Calculate late fee
 */
export function calculateLateFee(
  amount: number,
  lateFeePercentage: number,
  daysOverdue: number,
  gracePeriodDays: number = 0
): number {
  if (daysOverdue <= gracePeriodDays) return 0;
  return calculatePercentage(amount, lateFeePercentage);
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

/**
 * Check if currency is supported
 */
export function isSupportedCurrency(currencyCode: string): boolean {
  return currencyCode in CURRENCY_SYMBOLS;
}

/**
 * Calculate growth rate
 */
export function calculateGrowthRate(
  oldAmount: number,
  newAmount: number
): number {
  if (oldAmount === 0) return newAmount > 0 ? 100 : 0;
  return roundAmount(((newAmount - oldAmount) / oldAmount) * 100);
}

/**
 * Format billing cycle
 */
export function formatBillingCycle(cycle: BillingCycle): string {
  const cycleMap: Record<BillingCycle, string> = {
    [BillingCycle.MONTHLY]: 'Monthly',
    [BillingCycle.QUARTERLY]: 'Quarterly',
    [BillingCycle.YEARLY]: 'Yearly',
  };
  return cycleMap[cycle] || cycle;
}

/**
 * Validate amount
 */
export function isValidAmount(amount: number): boolean {
  return !isNaN(amount) && isFinite(amount) && amount >= 0;
}

/**
 * Safely add amounts
 */
export function addAmounts(...amounts: number[]): number {
  return roundAmount(amounts.reduce((sum, amount) => sum + amount, 0));
}

/**
 * Safely subtract amounts
 */
export function subtractAmounts(amount: number, ...deductions: number[]): number {
  const totalDeduction = deductions.reduce((sum, deduction) => sum + deduction, 0);
  return roundAmount(amount - totalDeduction);
}

/**
 * Calculate MRR
 */
export function calculateMRR(amount: number, billingCycle: BillingCycle): number {
  switch (billingCycle) {
    case BillingCycle.MONTHLY:
      return amount;
    case BillingCycle.QUARTERLY:
      return roundAmount(amount / 3);
    case BillingCycle.YEARLY:
      return roundAmount(amount / 12);
    default:
      throw new Error(`Unsupported billing cycle: ${billingCycle}`);
  }
}

/**
 * Calculate ARR
 */
export function calculateARR(amount: number, billingCycle: BillingCycle): number {
  switch (billingCycle) {
    case BillingCycle.MONTHLY:
      return roundAmount(amount * 12);
    case BillingCycle.QUARTERLY:
      return roundAmount(amount * 4);
    case BillingCycle.YEARLY:
      return amount;
    default:
      throw new Error(`Unsupported billing cycle: ${billingCycle}`);
  }
}

// ============================================================================
// Exports
// ============================================================================

export const billingUtils = {
  // Date calculations
  calculateBillingPeriod,
  calculateNextBillingDate,
  calculateDueDate,
  isOverdue,
  getDaysOverdue,
  calculateProration,
  getDaysInBillingCycle,
  isDateInBillingPeriod,

  // Price formatting
  formatCurrency,
  formatPrice,
  parseCurrency,
  roundAmount,
  convertCurrency,
  formatAmountWithSeparators,
  calculatePercentage,
  applyDiscount,

  // Tax calculations
  calculateTax,
  calculateTotalWithTax,
  calculateTaxWithMultipleRates,
  calculateReverseTax,
  isValidTaxRate,
  calculateLineItemTaxes,

  // Invoice number generation
  generateInvoiceNumber,
  generateSimpleInvoiceNumber,
  parseInvoiceNumber,
  isValidInvoiceNumber,
  generateTenantInvoiceNumber,

  // Utility helpers
  calculateInvoiceAging,
  calculateLateFee,
  getCurrencySymbol,
  isSupportedCurrency,
  calculateGrowthRate,
  formatBillingCycle,
  isValidAmount,
  addAmounts,
  subtractAmounts,
  calculateMRR,
  calculateARR,
};

export default billingUtils;
