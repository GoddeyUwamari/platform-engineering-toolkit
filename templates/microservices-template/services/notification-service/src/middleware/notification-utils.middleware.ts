/**
 * Notification Utilities Middleware
 * Additional utility middleware for notification service operations
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/utils/logger';
import { asyncHandler, ValidationError } from '@shared/middleware/error-handler';
import { NotificationType, NotificationStatus } from '@shared/types';

// ============================================================================
// Request Enrichment Middleware
// ============================================================================

/**
 * Add tenant context to request
 * Ensures tenant ID is available for all operations
 */
export const addTenantContext = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (req.user?.tenantId) {
      // Store tenant ID for easy access
      req.tenantId = req.user.tenantId;

      logger.debug('Tenant context added to request', {
        service: 'notification-service',
        tenantId: req.tenantId,
        userId: req.user.userId,
        path: req.path,
      });
    }

    next();
  }
);

/**
 * Add request metadata
 * Adds IP, user agent, and timestamp to request for logging
 */
export const addRequestMetadata = (req: Request, _res: Response, next: NextFunction): void => {
  req.metadata = {
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    timestamp: new Date(),
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };

  // Add request ID to response headers
  _res.set('X-Request-ID', req.metadata.requestId);

  logger.debug('Request metadata added', {
    service: 'notification-service',
    requestId: req.metadata.requestId,
    path: req.path,
  });

  next();
};

// ============================================================================
// Content Security Middleware
// ============================================================================

/**
 * Sanitize notification content
 * Removes dangerous content from notification bodies
 */
export const sanitizeNotificationContent = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const { body, subject } = req.body;

    // Sanitize subject
    if (subject && typeof subject === 'string') {
      // Remove control characters
      req.body.subject = subject.replace(/[\x00-\x1F\x7F]/g, '');
    }

    // Sanitize body based on notification type
    if (body && typeof body === 'string') {
      const type = req.body.type;

      switch (type) {
        case NotificationType.EMAIL:
          // For emails, allow HTML but remove dangerous scripts
          req.body.body = sanitizeHTML(body);
          break;

        case NotificationType.SMS:
          // For SMS, remove all control characters
          req.body.body = body.replace(/[\x00-\x1F\x7F]/g, '');
          break;

        case NotificationType.WEBHOOK:
        case NotificationType.IN_APP:
          // For webhooks and in-app, minimal sanitization
          req.body.body = body.trim();
          break;

        default:
          req.body.body = body.trim();
      }
    }

    next();
  }
);

/**
 * Sanitize HTML content (basic XSS protection)
 */
function sanitizeHTML(html: string): string {
  return html
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove on* event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol for images (can be used for XSS)
    .replace(/data:text\/html/gi, '');
}

// ============================================================================
// Validation Helper Middleware
// ============================================================================

/**
 * Validate UUID parameters
 * Ensures route parameters are valid UUIDs
 */
export const validateUUIDParam = (paramName: string = 'id') => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      const value = req.params[paramName];

      if (!value) {
        throw new ValidationError(`${paramName} parameter is required`);
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        throw new ValidationError(`${paramName} must be a valid UUID`);
      }

      next();
    }
  );
};

/**
 * Validate query parameters
 * Ensures query parameters are within acceptable ranges
 */
export const validateQueryParams = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const { limit, offset, page, pageSize } = req.query;

    // Validate limit
    if (limit !== undefined) {
      const limitNum = parseInt(limit as string, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        throw new ValidationError('Limit must be between 1 and 1000');
      }
      req.query.limit = limitNum.toString();
    }

    // Validate offset
    if (offset !== undefined) {
      const offsetNum = parseInt(offset as string, 10);
      if (isNaN(offsetNum) || offsetNum < 0) {
        throw new ValidationError('Offset must be a non-negative number');
      }
      req.query.offset = offsetNum.toString();
    }

    // Validate page (alternative to offset)
    if (page !== undefined) {
      const pageNum = parseInt(page as string, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        throw new ValidationError('Page must be a positive number');
      }
      req.query.page = pageNum.toString();
    }

    // Validate pageSize (alternative to limit)
    if (pageSize !== undefined) {
      const pageSizeNum = parseInt(pageSize as string, 10);
      if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
        throw new ValidationError('Page size must be between 1 and 100');
      }
      req.query.pageSize = pageSizeNum.toString();
    }

    next();
  }
);

// ============================================================================
// Feature Flag Middleware
// ============================================================================

/**
 * Check if a notification feature is enabled
 */
export const requireFeatureEnabled = (feature: 'email' | 'sms' | 'webhook') => {
  return asyncHandler(
    async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
      // In a real implementation, this would check feature flags from config or database
      const features = {
        email: process.env.EMAIL_ENABLED !== 'false',
        sms: process.env.SMS_ENABLED !== 'false',
        webhook: process.env.WEBHOOK_ENABLED !== 'false',
      };

      if (!features[feature]) {
        throw new ValidationError(`${feature.toUpperCase()} notifications are currently disabled`);
      }

      next();
    }
  );
};

// ============================================================================
// Logging Middleware
// ============================================================================

/**
 * Log notification requests
 * Logs all notification-related requests for auditing
 */
export const logNotificationRequest = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const { type, recipient, templateId } = req.body;

    logger.info('Notification request received', {
      service: 'notification-service',
      tenantId: req.user?.tenantId,
      userId: req.user?.userId,
      type,
      recipient: recipient ? maskSensitiveData(recipient, type) : undefined,
      templateId,
      path: req.path,
      method: req.method,
      ip: req.ip,
      requestId: req.metadata?.requestId,
    });

    next();
  }
);

/**
 * Mask sensitive data for logging
 */
function maskSensitiveData(data: string, type?: NotificationType): string {
  if (!data) return '';

  switch (type) {
    case NotificationType.EMAIL:
      // Mask email: user@example.com -> u***@example.com
      const emailParts = data.split('@');
      if (emailParts.length === 2 && emailParts[0] && emailParts[1]) {
        const username = emailParts[0];
        const masked = username.length > 2
          ? username[0] + '*'.repeat(username.length - 1)
          : username;
        return `${masked}@${emailParts[1]}`;
      }
      return data;

    case NotificationType.SMS:
      // Mask phone: +1234567890 -> +1234***890
      if (data.length > 6) {
        return data.substring(0, 4) + '*'.repeat(data.length - 7) + data.substring(data.length - 3);
      }
      return data;

    case NotificationType.WEBHOOK:
      // Mask webhook URL: https://example.com/webhook -> https://example.com/***
      try {
        const url = new URL(data);
        return `${url.protocol}//${url.host}/***`;
      } catch {
        return '***';
      }

    default:
      return '***';
  }
}

// ============================================================================
// Bulk Operations Middleware
// ============================================================================

/**
 * Validate bulk operation size
 */
export const validateBulkSize = (maxSize: number = 1000) => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      const { emails, messages } = req.body;
      const items = emails || messages;

      if (!items || !Array.isArray(items)) {
        throw new ValidationError('Bulk operation requires an array of items');
      }

      if (items.length === 0) {
        throw new ValidationError('Bulk operation cannot be empty');
      }

      if (items.length > maxSize) {
        throw new ValidationError(
          `Bulk operation size (${items.length}) exceeds maximum of ${maxSize}`
        );
      }

      logger.debug('Bulk operation validated', {
        service: 'notification-service',
        itemCount: items.length,
        maxSize,
      });

      next();
    }
  );
};

// ============================================================================
// Priority Handling Middleware
// ============================================================================

/**
 * Set notification priority based on metadata
 */
export const setPriority = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const { metadata } = req.body;

    // Default priority
    let priority = 'normal';

    if (metadata) {
      // Check for explicit priority
      if (metadata.priority) {
        if (['low', 'normal', 'high', 'urgent'].includes(metadata.priority)) {
          priority = metadata.priority;
        }
      } else {
        // Auto-detect priority from keywords
        const content = JSON.stringify(req.body).toLowerCase();
        if (content.includes('urgent') || content.includes('critical')) {
          priority = 'high';
        } else if (content.includes('important')) {
          priority = 'normal';
        }
      }
    }

    // Add priority to request
    if (!req.body.metadata) {
      req.body.metadata = {};
    }
    req.body.metadata.priority = priority;

    next();
  }
);

// ============================================================================
// Status Validation Middleware
// ============================================================================

/**
 * Validate notification status transitions
 */
export const validateStatusTransition = (allowedStatuses: NotificationStatus[]) => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      const { status } = req.body;

      if (status && !allowedStatuses.includes(status)) {
        throw new ValidationError(
          `Invalid status transition. Allowed statuses: ${allowedStatuses.join(', ')}`
        );
      }

      next();
    }
  );
};

// ============================================================================
// TypeScript Declarations
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      metadata?: {
        ip: string;
        userAgent: string;
        timestamp: Date;
        requestId: string;
      };
    }
  }
}
