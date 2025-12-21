/**
 * Notification Service Middleware
 * Centralized export for all middleware
 */

// ============================================================================
// Validation Middleware
// ============================================================================

export {
  // Email validation
  validateEmailRequest,
  validateBulkEmailRequest,

  // SMS validation
  validateSMSRequest,
  validateBulkSMSRequest,

  // Webhook validation
  validateWebhookRequest,

  // Template validation
  validateTemplateCreation,
  validateTemplateUpdate,
  validateTemplateRender,

  // Notification validation
  validateNotificationCreation,
} from './notification.middleware';

// ============================================================================
// Rate Limiting Middleware
// ============================================================================

export {
  // Rate limiters
  emailRateLimit,
  smsRateLimit,
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
  sanitizeNotificationContent,

  // Validation helpers
  validateUUIDParam,
  validateQueryParams,

  // Feature flags
  requireFeatureEnabled,

  // Logging
  logNotificationRequest,

  // Bulk operations
  validateBulkSize,

  // Priority handling
  setPriority,

  // Status validation
  validateStatusTransition,
} from './notification-utils.middleware';

// ============================================================================
// Re-export shared middleware
// ============================================================================

export {
  requireAuth,
  optionalAuth,
  requireRole,
  requireAdmin,
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
} from '@shared/middleware/auth.middleware';

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
