import { NotificationType } from '@shared/types';

/**
 * Notification Helper Utilities
 * Common utility functions for notification processing
 */

/**
 * Sanitize email content to prevent XSS attacks
 */
export function sanitizeEmailContent(html: string): string {
  // Basic sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phoneNumber: string, defaultCountryCode: string = '+1'): string {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // If already has country code, add +
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }

  // Add default country code
  return `${defaultCountryCode}${cleaned}`;
}

/**
 * Extract email addresses from string
 */
export function extractEmailAddresses(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
}

/**
 * Validate notification content length based on type
 */
export function validateContentLength(type: NotificationType, content: string): {
  isValid: boolean;
  maxLength: number;
  currentLength: number;
  error?: string;
} {
  const limits: Record<NotificationType, number> = {
    [NotificationType.EMAIL]: 1000000, // 1MB for emails
    [NotificationType.SMS]: 1600, // SMS character limit (concatenated)
    [NotificationType.WEBHOOK]: 100000, // 100KB for webhooks
    [NotificationType.IN_APP]: 10000, // 10KB for in-app
  };

  const maxLength = limits[type] || 100000; // Default to 100KB
  const currentLength = content.length;
  const isValid = currentLength <= maxLength;

  return {
    isValid,
    maxLength,
    currentLength,
    error: isValid ? undefined : `Content exceeds maximum length of ${maxLength} characters`,
  };
}

/**
 * Calculate estimated SMS segments
 */
export function calculateSMSSegments(message: string): {
  segments: number;
  charactersPerSegment: number;
  totalCharacters: number;
} {
  const totalCharacters = message.length;
  const hasUnicode = /[^\x00-\x7F]/.test(message);

  const charactersPerSegment = hasUnicode ? 70 : 160;
  const segments = Math.ceil(totalCharacters / charactersPerSegment);

  return {
    segments,
    charactersPerSegment,
    totalCharacters,
  };
}

/**
 * Generate unique message ID
 */
export function generateMessageId(prefix: string = 'msg'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Parse template variables from content
 */
export function parseTemplateVariables(content: string): string[] {
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];

  const matches = content.matchAll(variableRegex);
  for (const match of matches) {
    if (match[1]) {
      variables.push(match[1].trim());
    }
  }

  return Array.from(new Set(variables)); // Remove duplicates
}

/**
 * Replace template variables in content
 */
export function replaceTemplateVariables(
  content: string,
  variables: Record<string, any>,
  options: {
    escapeHtml?: boolean;
    defaultValue?: string;
  } = {}
): string {
  const { escapeHtml = false, defaultValue = '' } = options;

  return content.replace(/\{\{([^}]+)\}\}/g, (_match, variableName) => {
    const trimmedName = variableName.trim();
    let value = variables[trimmedName];

    if (value === undefined || value === null) {
      return defaultValue;
    }

    // Convert to string
    value = String(value);

    // Optionally escape HTML
    if (escapeHtml) {
      value = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    return value;
  });
}

/**
 * Validate email template HTML
 */
export function validateEmailHTML(html: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for balanced tags
  const openTags = html.match(/<([a-z][a-z0-9]*)\b[^>]*>/gi) || [];
  const closeTags = html.match(/<\/([a-z][a-z0-9]*)>/gi) || [];

  if (openTags.length !== closeTags.length) {
    warnings.push('Potentially unbalanced HTML tags');
  }

  // Check for dangerous content
  if (/<script/i.test(html)) {
    errors.push('Script tags are not allowed in email templates');
  }

  if (/javascript:/i.test(html)) {
    errors.push('JavaScript protocol is not allowed');
  }

  // Check for common email client issues
  if (!/<!DOCTYPE/i.test(html) && html.length > 1000) {
    warnings.push('Missing DOCTYPE declaration');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Convert markdown to HTML (basic implementation)
 */
export function markdownToHTML(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

/**
 * Generate unsubscribe link
 */
export function generateUnsubscribeLink(
  baseUrl: string,
  userId: string,
  tenantId: string,
  token: string
): string {
  return `${baseUrl}/unsubscribe?user=${userId}&tenant=${tenantId}&token=${token}`;
}

/**
 * Calculate notification priority score
 */
export function calculatePriorityScore(metadata: Record<string, any>): number {
  let score = 0;

  // High priority keywords
  const highPriorityKeywords = ['urgent', 'critical', 'important', 'alert'];
  const content = JSON.stringify(metadata).toLowerCase();

  for (const keyword of highPriorityKeywords) {
    if (content.includes(keyword)) {
      score += 10;
    }
  }

  // Priority level from metadata
  if (metadata.priority === 'high') score += 20;
  if (metadata.priority === 'medium') score += 10;

  return score;
}

/**
 * Batch array into chunks
 */
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];

  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }

  return batches;
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
