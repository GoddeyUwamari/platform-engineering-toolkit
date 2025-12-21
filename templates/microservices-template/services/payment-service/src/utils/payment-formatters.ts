/**
 * Payment Formatters
 * Formatting utilities for payment data display
 */

import Decimal from 'decimal.js';
import { Payment, PaymentMethod, Refund, PaymentStatus, RefundStatus } from '../types/payment.types';

// ============================================================================
// Amount Formatting
// ============================================================================

/**
 * Format amount for display with currency symbol
 */
export function formatAmount(
  amount: number | Decimal | string,
  currency: string = 'usd',
  options: {
    showSymbol?: boolean;
    showCode?: boolean;
    locale?: string;
  } = {}
): string {
  const {
    showSymbol = true,
    showCode = false,
    locale = 'en-US',
  } = options;

  const numericAmount = typeof amount === 'string'
    ? parseFloat(amount)
    : amount instanceof Decimal
    ? amount.toNumber()
    : amount;

  // Format with Intl.NumberFormat for proper locale support
  const formatter = new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let formatted = formatter.format(numericAmount);

  if (showCode && !showSymbol) {
    formatted = `${formatted} ${currency.toUpperCase()}`;
  }

  return formatted;
}

/**
 * Format amount in cents
 */
export function formatAmountInCents(
  amount: number | Decimal | string,
  currency: string = 'usd'
): string {
  const numericAmount = typeof amount === 'string'
    ? parseFloat(amount)
    : amount instanceof Decimal
    ? amount.toNumber()
    : amount;

  const cents = Math.round(numericAmount * 100);
  return `${cents}¢ ${currency.toUpperCase()}`;
}

/**
 * Parse formatted amount string to number
 */
export function parseFormattedAmount(formatted: string): number {
  // Remove currency symbols, spaces, commas
  const cleaned = formatted.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned);
}

/**
 * Format amount range
 */
export function formatAmountRange(
  minAmount: number,
  maxAmount: number,
  currency: string = 'usd'
): string {
  const min = formatAmount(minAmount, currency);
  const max = formatAmount(maxAmount, currency);
  return `${min} - ${max}`;
}

// ============================================================================
// Date/Time Formatting
// ============================================================================

/**
 * Format date for display
 */
export function formatDate(
  date: Date | string,
  options: {
    format?: 'short' | 'medium' | 'long' | 'full';
    locale?: string;
    includeTime?: boolean;
  } = {}
): string {
  const {
    format = 'medium',
    locale = 'en-US',
    includeTime = false,
  } = options;

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const dateFormatOptions: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: 'numeric', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  };

  let formatOptions = dateFormatOptions[format];

  if (includeTime) {
    formatOptions = {
      ...formatOptions,
      hour: '2-digit',
      minute: '2-digit',
    };
  }

  return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  } else if (diffDay < 30) {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  } else {
    return formatDate(dateObj, { format: 'medium' });
  }
}

// ============================================================================
// Payment Status Formatting
// ============================================================================

/**
 * Format payment status for display
 */
export function formatPaymentStatus(status: PaymentStatus): string {
  const statusLabels: Record<PaymentStatus, string> = {
    [PaymentStatus.PENDING]: 'Pending',
    [PaymentStatus.PROCESSING]: 'Processing',
    [PaymentStatus.SUCCEEDED]: 'Succeeded',
    [PaymentStatus.FAILED]: 'Failed',
    [PaymentStatus.CANCELLED]: 'Cancelled',
    [PaymentStatus.REQUIRES_ACTION]: 'Requires Action',
  };

  return statusLabels[status] || status;
}

/**
 * Get payment status badge color
 */
export function getPaymentStatusColor(status: PaymentStatus): string {
  const colors: Record<PaymentStatus, string> = {
    [PaymentStatus.PENDING]: 'warning',
    [PaymentStatus.PROCESSING]: 'info',
    [PaymentStatus.SUCCEEDED]: 'success',
    [PaymentStatus.FAILED]: 'error',
    [PaymentStatus.CANCELLED]: 'default',
    [PaymentStatus.REQUIRES_ACTION]: 'warning',
  };

  return colors[status] || 'default';
}

/**
 * Format refund status for display
 */
export function formatRefundStatus(status: RefundStatus): string {
  const statusLabels: Record<RefundStatus, string> = {
    [RefundStatus.PENDING]: 'Pending',
    [RefundStatus.SUCCEEDED]: 'Succeeded',
    [RefundStatus.FAILED]: 'Failed',
    [RefundStatus.CANCELLED]: 'Cancelled',
  };

  return statusLabels[status] || status;
}

// ============================================================================
// Payment Method Formatting
// ============================================================================

/**
 * Format payment method for display
 */
export function formatPaymentMethod(paymentMethod: PaymentMethod): string {
  if (paymentMethod.type === 'card' && paymentMethod.card_brand && paymentMethod.card_last4) {
    const brand = formatCardBrand(paymentMethod.card_brand);
    return `${brand} •••• ${paymentMethod.card_last4}`;
  }

  if (paymentMethod.type === 'bank_account' && paymentMethod.bank_name && paymentMethod.bank_account_last4) {
    return `${paymentMethod.bank_name} •••• ${paymentMethod.bank_account_last4}`;
  }

  return formatPaymentMethodType(paymentMethod.type);
}

/**
 * Format card brand
 */
export function formatCardBrand(brand: string): string {
  const brandNames: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };

  return brandNames[brand.toLowerCase()] || brand.charAt(0).toUpperCase() + brand.slice(1);
}

/**
 * Format payment method type
 */
export function formatPaymentMethodType(type: string): string {
  const typeNames: Record<string, string> = {
    card: 'Card',
    bank_account: 'Bank Account',
    wallet: 'Digital Wallet',
  };

  return typeNames[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Format card expiry date
 */
export function formatCardExpiry(month: number, year: number): string {
  const paddedMonth = month.toString().padStart(2, '0');
  const shortYear = year.toString().slice(-2);
  return `${paddedMonth}/${shortYear}`;
}

/**
 * Check if card is expiring soon (within 2 months)
 */
export function isCardExpiringSoon(month: number, year: number): boolean {
  const now = new Date();
  const expiryDate = new Date(year, month - 1); // month is 0-indexed
  const twoMonthsFromNow = new Date();
  twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);

  return expiryDate <= twoMonthsFromNow && expiryDate >= now;
}

// ============================================================================
// Payment Summary Formatting
// ============================================================================

/**
 * Format payment summary
 */
export function formatPaymentSummary(payment: Payment): string {
  const amount = formatAmount(payment.amount, payment.currency);
  const status = formatPaymentStatus(payment.status);
  const date = formatRelativeTime(payment.created_at);

  return `${amount} - ${status} (${date})`;
}

/**
 * Format refund summary
 */
export function formatRefundSummary(refund: Refund): string {
  const amount = formatAmount(refund.amount, refund.currency);
  const status = formatRefundStatus(refund.status);
  const date = formatRelativeTime(refund.created_at);

  return `${amount} refund - ${status} (${date})`;
}

// ============================================================================
// Transaction ID Formatting
// ============================================================================

/**
 * Format transaction ID for display (shortened)
 */
export function formatTransactionId(id: string, length: number = 8): string {
  if (id.length <= length) {
    return id;
  }

  const start = id.substring(0, length / 2);
  const end = id.substring(id.length - length / 2);
  return `${start}...${end}`;
}

/**
 * Mask sensitive data (e.g., card numbers)
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars) {
    return data;
  }

  const masked = '•'.repeat(data.length - visibleChars);
  const visible = data.slice(-visibleChars);
  return masked + visible;
}

// ============================================================================
// Statistics Formatting
// ============================================================================

/**
 * Format payment statistics
 */
export function formatPaymentStats(stats: {
  total: number;
  succeeded: number;
  failed: number;
  pending: number;
  totalAmount: string;
}): {
  total: string;
  succeeded: string;
  failed: string;
  pending: string;
  successRate: string;
  totalAmount: string;
} {
  const successRate = stats.total > 0
    ? ((stats.succeeded / stats.total) * 100).toFixed(1)
    : '0.0';

  return {
    total: stats.total.toLocaleString(),
    succeeded: stats.succeeded.toLocaleString(),
    failed: stats.failed.toLocaleString(),
    pending: stats.pending.toLocaleString(),
    successRate: `${successRate}%`,
    totalAmount: formatAmount(stats.totalAmount, 'usd'),
  };
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format growth rate
 */
export function formatGrowthRate(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? '+100%' : '0%';
  }

  const growth = ((current - previous) / previous) * 100;
  const sign = growth > 0 ? '+' : '';
  return `${sign}${growth.toFixed(1)}%`;
}

// ============================================================================
// List Formatting
// ============================================================================

/**
 * Format array as comma-separated list
 */
export function formatList(items: string[], maxItems: number = 3): string {
  if (items.length === 0) {
    return 'None';
  }

  if (items.length <= maxItems) {
    return items.join(', ');
  }

  const visible = items.slice(0, maxItems);
  const remaining = items.length - maxItems;
  return `${visible.join(', ')} and ${remaining} more`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - suffix.length) + suffix;
}

// ============================================================================
// Error Message Formatting
// ============================================================================

/**
 * Format error message for user display
 */
export function formatErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && error.message) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Format validation errors
 */
export function formatValidationErrors(errors: Record<string, string>): string {
  const messages = Object.entries(errors).map(([field, message]) => {
    const formattedField = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `${formattedField}: ${message}`;
  });

  return messages.join('; ');
}

// ============================================================================
// Phone Number Formatting
// ============================================================================

/**
 * Format phone number
 */
export function formatPhoneNumber(phone: string, countryCode: string = 'US'): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  if (countryCode === 'US' && cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }

  // For other formats, just add spaces
  if (cleaned.length > 6) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
  }

  return cleaned;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
