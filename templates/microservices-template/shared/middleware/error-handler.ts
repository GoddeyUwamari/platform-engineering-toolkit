/**
 * Centralized Error Handling Middleware
 * Catches all errors, formats them consistently, and returns proper HTTP responses
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse, ErrorResponse } from '../types';

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base Application Error
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set prototype explicitly to fix instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication Error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization Error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT_ERROR', true);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Database Error (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: Record<string, unknown>) {
    super(message, 500, 'DATABASE_ERROR', true, details);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * External Service Error (502)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service unavailable') {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true);
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

// ============================================================================
// Error Response Formatter
// ============================================================================

/**
 * Format error into standardized API response
 */
const formatErrorResponse = (error: Error, code: string): ErrorResponse => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse: ErrorResponse = {
    code,
    message: error.message || 'An unexpected error occurred',
  };

  // Add details if available (from AppError instances)
  if (error instanceof AppError && error.details) {
    errorResponse.details = error.details;
  }

  // Include stack trace only in development
  if (isDevelopment && error.stack) {
    errorResponse.stack = error.stack;
  }

  return errorResponse;
};

// ============================================================================
// Error Handler Middleware
// ============================================================================

/**
 * Global error handling middleware
 * Should be registered last in the middleware chain
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';

  // Handle custom AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;

    // Log operational errors as warnings
    logger.warn('Operational error occurred', {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      details: err.details,
    });
  } else {
    // Log unexpected errors as errors
    logger.error('Unexpected error occurred', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Format error response
  const errorResponse = formatErrorResponse(err, code);

  // Build API response
  const response: ApiResponse = {
    success: false,
    error: errorResponse,
    timestamp: new Date().toISOString(),
  };

  // Send response
  res.status(statusCode).json(response);
};

// ============================================================================
// Not Found Handler (404)
// ============================================================================

/**
 * Handles requests to non-existent routes
 * Should be registered before error handler
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
};

// ============================================================================
// Async Handler Wrapper
// ============================================================================

/**
 * Wraps async route handlers to catch promise rejections
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ============================================================================
// Validation Error Parser (for Zod/Joi)
// ============================================================================

/**
 * Parse validation errors from Zod or Joi
 */
export const parseValidationError = (error: any): ValidationError => {
  const details: Record<string, unknown> = {};

  // Handle Zod errors
  if (error.name === 'ZodError' && error.errors) {
    error.errors.forEach((err: any) => {
      const path = err.path.join('.');
      details[path] = err.message;
    });
    return new ValidationError('Validation failed', details);
  }

  // Handle Joi errors
  if (error.isJoi && error.details) {
    error.details.forEach((err: any) => {
      const path = err.path.join('.');
      details[path] = err.message;
    });
    return new ValidationError('Validation failed', details);
  }

  // Generic validation error
  return new ValidationError(error.message);
};

// ============================================================================
// Database Error Parser
// ============================================================================

/**
 * Parse PostgreSQL errors into user-friendly messages
 */
export const parseDatabaseError = (error: any): AppError => {
  // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html

  // Unique violation (23505)
  if (error.code === '23505') {
    return new ConflictError('A record with this value already exists');
  }

  // Foreign key violation (23503)
  if (error.code === '23503') {
    return new ValidationError('Referenced record does not exist');
  }

  // Not null violation (23502)
  if (error.code === '23502') {
    return new ValidationError('Required field is missing');
  }

  // Check violation (23514)
  if (error.code === '23514') {
    return new ValidationError('Invalid value provided');
  }

  // Connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return new DatabaseError('Database connection failed');
  }

  // Generic database error
  return new DatabaseError('Database operation failed', {
    code: error.code,
    detail: error.detail,
  });
};

// ============================================================================
// Process-level Error Handlers
// ============================================================================

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
      error: error.message,
      stack: error.stack,
    });

    // Exit process (let process manager restart)
    process.exit(1);
  });
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (): void => {
  process.on('unhandledRejection', (reason: any) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    });

    // Exit process (let process manager restart)
    process.exit(1);
  });
};

// ============================================================================
// Setup Function
// ============================================================================

/**
 * Setup all error handlers
 * Call this in your main application file
 */
export const setupErrorHandlers = (): void => {
  handleUncaughtException();
  handleUnhandledRejection();
  logger.info('Error handlers initialized');
};

export class BusinessRuleError extends AppError {
  constructor(message: string = 'Business rule violation') {
    super(message, 422, 'BUSINESS_RULE_ERROR', true);
    Object.setPrototypeOf(this, BusinessRuleError.prototype);
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  // Middleware
  errorHandler,
  notFoundHandler,
  asyncHandler,

  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,

  // Parsers
  parseValidationError,
  parseDatabaseError,

  // Setup
  setupErrorHandlers,
};