/**
 * Payment Utility Middleware
 * Common utility middleware for payment operations
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/utils/logger';
import { ValidationError } from '@shared/middleware/error-handler';

// ============================================================================
// Request Context Enrichment
// ============================================================================

/**
 * Add tenant context to request
 */
export function addTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const tenantId = req.user?.tenantId;

  if (tenantId) {
    // Add to request for easy access
    (req as any).tenantId = tenantId;

    logger.debug('Tenant context added to request', {
      service: 'payment-service',
      tenantId,
      path: req.path,
    });
  }

  next();
}

/**
 * Add request metadata for tracking
 */
export function addRequestMetadata(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  (req as any).requestMetadata = {
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    userAgent: req.get('user-agent'),
    ip: req.ip,
    method: req.method,
    path: req.path,
  };

  next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// ============================================================================
// Content Security
// ============================================================================

/**
 * Sanitize payment description and metadata
 */
export function sanitizePaymentContent(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body.description) {
    req.body.description = sanitizeString(req.body.description);
  }

  if (req.body.metadata && typeof req.body.metadata === 'object') {
    req.body.metadata = sanitizeObject(req.body.metadata);
  }

  next();
}

/**
 * Sanitize string content
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;

  return str
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .substring(0, 1000); // Limit length
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================================================
// Amount Validation and Formatting
// ============================================================================

/**
 * Validate and normalize payment amount
 */
export function validateAndNormalizeAmount(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body.amount !== undefined) {
    const amount = req.body.amount;

    // Ensure it's a number
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new ValidationError('Amount must be a valid number');
    }

    // Round to 2 decimal places
    req.body.amount = Math.round(amount * 100) / 100;

    // Validate range
    if (req.body.amount <= 0) {
      throw new ValidationError('Amount must be greater than 0');
    }

    if (req.body.amount > 999999.99) {
      throw new ValidationError('Amount exceeds maximum allowed value');
    }
  }

  next();
}

/**
 * Validate currency code
 */
export function validateCurrency(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const currency = req.body.currency || req.query.currency;

  if (currency) {
    if (typeof currency !== 'string') {
      throw new ValidationError('Currency must be a string');
    }

    const normalizedCurrency = currency.toLowerCase();
    const supportedCurrencies = ['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'inr'];

    if (!supportedCurrencies.includes(normalizedCurrency)) {
      throw new ValidationError(
        `Unsupported currency. Supported currencies: ${supportedCurrencies.join(', ')}`
      );
    }

    // Normalize to lowercase
    if (req.body.currency) {
      req.body.currency = normalizedCurrency;
    }
  }

  next();
}

// ============================================================================
// Logging Middleware
// ============================================================================

/**
 * Log payment request
 */
export function logPaymentRequest(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.userId;

  logger.info('Payment request received', {
    service: 'payment-service',
    tenantId,
    userId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    hasAmount: !!req.body.amount,
    hasCurrency: !!req.body.currency,
  });

  next();
}

/**
 * Log payment response
 */
export function logPaymentResponse(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const originalSend = res.send;

  res.send = function (data: any): Response {
    const tenantId = req.user?.tenantId;

    logger.info('Payment response sent', {
      service: 'payment-service',
      tenantId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      success: res.statusCode >= 200 && res.statusCode < 300,
    });

    return originalSend.call(this, data);
  };

  next();
}

// ============================================================================
// Webhook Validation
// ============================================================================

/**
 * Preserve raw body for webhook signature verification
 */
export function preserveRawBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // This should be used before JSON body parser
  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    (req as any).rawBody = data;
    next();
  });
}

// ============================================================================
// Idempotency
// ============================================================================

/**
 * Handle idempotency key for safe retries
 */
export function handleIdempotencyKey(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (idempotencyKey) {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 10) {
      throw new ValidationError('Invalid idempotency key format');
    }

    (req as any).idempotencyKey = idempotencyKey;

    logger.debug('Idempotency key detected', {
      service: 'payment-service',
      tenantId: req.user?.tenantId,
      key: idempotencyKey.substring(0, 10) + '...',
    });
  }

  next();
}

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Check if feature is enabled for tenant
 */
export function requireFeatureEnabled(featureName: string) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // In production, check against feature flag service
    // For now, all features are enabled
    const isEnabled = true;

    if (!isEnabled) {
      throw new ValidationError(`Feature '${featureName}' is not enabled for this tenant`);
    }

    next();
  };
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Validate bulk operation size
 */
export function validateBulkSize(maxSize: number = 100) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const items = req.body.items || req.body.payments || req.body.refunds;

    if (items && Array.isArray(items)) {
      if (items.length === 0) {
        throw new ValidationError('Bulk operation must contain at least one item');
      }

      if (items.length > maxSize) {
        throw new ValidationError(`Bulk operation cannot exceed ${maxSize} items`);
      }
    }

    next();
  };
}

// ============================================================================
// Timeout Protection
// ============================================================================

/**
 * Set request timeout
 */
export function setRequestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          service: 'payment-service',
          tenantId: req.user?.tenantId,
          path: req.path,
          timeoutMs,
        });

        res.status(408).json({
          success: false,
          error: 'Request timeout',
          message: `Request exceeded ${timeoutMs}ms timeout`,
        });
      }
    }, timeoutMs);

    // Clear timeout on response
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}

// ============================================================================
// Conditional Processing
// ============================================================================

/**
 * Skip middleware if condition is met
 */
export function skipIf(condition: (req: Request) => boolean, middleware: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (condition(req)) {
      return next();
    }
    return middleware(req, res, next);
  };
}

/**
 * Apply middleware only if condition is met
 */
export function applyIf(condition: (req: Request) => boolean, middleware: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (condition(req)) {
      return middleware(req, res, next);
    }
    return next();
  };
}
