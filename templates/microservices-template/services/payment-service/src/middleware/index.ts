/**
 * Payment Service Middleware
 * Centralized export for all middleware
 */

// ============================================================================
// Validation Middleware
// ============================================================================

export {
  // Payment intent validation
  validatePaymentIntentCreation,
  validatePaymentConfirmation,

  // Payment method validation
  validatePaymentMethodCreation,
  validatePaymentMethodUpdate,

  // Refund validation
  validateRefundCreation,

  // Query parameter validation
  validatePaginationParams,
  validatePaymentFilters,

  // ID validation
  validateUUIDParam,
  validateStripeIdParam,
} from './payment.middleware';

// ============================================================================
// Rate Limiting Middleware
// ============================================================================

export {
  // Rate limiters
  paymentIntentRateLimit,
  paymentMethodRateLimit,
  refundRateLimit,
  webhookRateLimit,
  apiRateLimit,
  customRateLimit,

  // Usage statistics
  getUsageStats,

  // Rate limiter instance
  rateLimiter,
} from './rate-limiter.middleware';

// ============================================================================
// Utility Middleware
// ============================================================================

export {
  // Request enrichment
  addTenantContext,
  addRequestMetadata,

  // Content security
  sanitizePaymentContent,

  // Amount validation
  validateAndNormalizeAmount,
  validateCurrency,

  // Logging
  logPaymentRequest,
  logPaymentResponse,

  // Webhook utilities
  preserveRawBody,

  // Idempotency
  handleIdempotencyKey,

  // Feature flags
  requireFeatureEnabled,

  // Bulk operations
  validateBulkSize,

  // Timeout protection
  setRequestTimeout,

  // Conditional processing
  skipIf,
  applyIf,
} from './payment-utils.middleware';

// ============================================================================
// Re-export shared middleware
// ============================================================================

export {
  requireAuth,
  requireRole,
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
} from '@shared/middleware/auth.middleware';

export {
  resolveTenant,
  setDatabaseTenantContext,
} from '@shared/middleware/tenant.middleware';

export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} from '@shared/middleware/error-handler';
