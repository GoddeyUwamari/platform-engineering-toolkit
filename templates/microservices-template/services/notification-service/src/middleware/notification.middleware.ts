/**
 * Notification Middleware
 * Validation middleware for notification operations (email, SMS, webhook, template)
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/utils/logger';
import {
  ValidationError,
  AuthenticationError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import { NotificationType } from '@shared/types';

// ============================================================================
// Configuration
// ============================================================================

const MAX_EMAIL_RECIPIENTS = 100; // Maximum recipients per email
const MAX_EMAIL_BODY_LENGTH = 1000000; // 1MB
const MAX_EMAIL_SUBJECT_LENGTH = 998; // RFC 2822 limit
const MAX_SMS_BODY_LENGTH = 1600; // Concatenated SMS
const MAX_WEBHOOK_BODY_SIZE = 100000; // 100KB
const MAX_TEMPLATE_BODY_LENGTH = 50000; // 50KB
const MAX_TEMPLATE_VARIABLES = 100;
const MAX_BULK_BATCH_SIZE = 1000;

const ALLOWED_WEBHOOK_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// ============================================================================
// General Validation Helpers
// ============================================================================

/**
 * Validate that user is authenticated
 */
const requireAuthentication = (req: Request): void => {
  if (!req.user || !req.user.tenantId || !req.user.userId) {
    throw new AuthenticationError('User not authenticated');
  }
};

/**
 * Validate email address format
 */
const validateEmailAddress = (email: string, fieldName: string = 'Email'): void => {
  if (!email) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (typeof email !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new ValidationError(`${fieldName} has invalid format`);
  }

  if (email.length > 254) {
    throw new ValidationError(`${fieldName} exceeds maximum length of 254 characters`);
  }
};

/**
 * Validate phone number format
 */
const validatePhoneNumber = (phoneNumber: string, fieldName: string = 'Phone number'): void => {
  if (!phoneNumber) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (typeof phoneNumber !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  // Remove spaces, dashes, and parentheses
  const cleaned = phoneNumber.replace(/[\s-()]/g, '');

  // Basic validation: should start with + and contain 10-15 digits
  const phoneRegex = /^\+?[1-9]\d{9,14}$/;
  if (!phoneRegex.test(cleaned)) {
    throw new ValidationError(`${fieldName} has invalid format (E.164 format required: +1234567890)`);
  }
};

/**
 * Validate URL format
 */
const validateURL = (url: string, fieldName: string = 'URL'): void => {
  if (!url) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (typeof url !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new ValidationError(`${fieldName} must use HTTP or HTTPS protocol`);
    }
  } catch (error) {
    throw new ValidationError(`${fieldName} has invalid format`);
  }
};

/**
 * Validate string length
 */
const validateStringLength = (
  value: string,
  fieldName: string,
  maxLength: number,
  minLength: number = 1
): void => {
  if (!value) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  if (value.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`);
  }

  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }
};

/**
 * Validate notification type
 */
const validateNotificationType = (type: string): void => {
  if (!type) {
    throw new ValidationError('Notification type is required');
  }

  const validTypes = Object.values(NotificationType);
  if (!validTypes.includes(type as NotificationType)) {
    throw new ValidationError(
      `Invalid notification type. Supported types: ${validTypes.join(', ')}`
    );
  }
};

// ============================================================================
// Email Validation Middleware
// ============================================================================

/**
 * Validate single email request
 * POST /api/email/send
 */
export const validateEmailRequest = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { recipient, subject, body, cc, bcc, attachments } = req.body;

    // Validate recipient
    validateEmailAddress(recipient, 'Recipient');

    // Validate subject
    if (!subject) {
      throw new ValidationError('Email subject is required');
    }
    validateStringLength(subject, 'Subject', MAX_EMAIL_SUBJECT_LENGTH);

    // Validate body
    if (!body) {
      throw new ValidationError('Email body is required');
    }
    validateStringLength(body, 'Body', MAX_EMAIL_BODY_LENGTH);

    // Validate CC recipients
    if (cc) {
      if (!Array.isArray(cc)) {
        throw new ValidationError('CC must be an array');
      }
      if (cc.length > MAX_EMAIL_RECIPIENTS) {
        throw new ValidationError(`CC recipients cannot exceed ${MAX_EMAIL_RECIPIENTS}`);
      }
      cc.forEach((email: string, index: number) => {
        validateEmailAddress(email, `CC recipient ${index + 1}`);
      });
    }

    // Validate BCC recipients
    if (bcc) {
      if (!Array.isArray(bcc)) {
        throw new ValidationError('BCC must be an array');
      }
      if (bcc.length > MAX_EMAIL_RECIPIENTS) {
        throw new ValidationError(`BCC recipients cannot exceed ${MAX_EMAIL_RECIPIENTS}`);
      }
      bcc.forEach((email: string, index: number) => {
        validateEmailAddress(email, `BCC recipient ${index + 1}`);
      });
    }

    // Validate attachments
    if (attachments) {
      if (!Array.isArray(attachments)) {
        throw new ValidationError('Attachments must be an array');
      }
      if (attachments.length > 10) {
        throw new ValidationError('Cannot attach more than 10 files');
      }
      attachments.forEach((attachment: any, index: number) => {
        if (!attachment.filename) {
          throw new ValidationError(`Attachment ${index + 1} missing filename`);
        }
        if (!attachment.content) {
          throw new ValidationError(`Attachment ${index + 1} missing content`);
        }
      });
    }

    logger.debug('Email request validated', {
      service: 'notification-service',
      recipient,
      hasAttachments: !!attachments,
    });

    next();
  }
);

/**
 * Validate bulk email request
 * POST /api/email/bulk
 */
export const validateBulkEmailRequest = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { emails, batchSize, delayMs } = req.body;

    // Validate emails array
    if (!emails || !Array.isArray(emails)) {
      throw new ValidationError('Emails must be an array');
    }

    if (emails.length === 0) {
      throw new ValidationError('Emails array cannot be empty');
    }

    if (emails.length > MAX_BULK_BATCH_SIZE) {
      throw new ValidationError(`Cannot send more than ${MAX_BULK_BATCH_SIZE} emails at once`);
    }

    // Validate each email
    emails.forEach((email: any, index: number) => {
      if (!email.recipient) {
        throw new ValidationError(`Email ${index + 1} missing recipient`);
      }
      validateEmailAddress(email.recipient, `Email ${index + 1} recipient`);

      if (!email.subject) {
        throw new ValidationError(`Email ${index + 1} missing subject`);
      }

      if (!email.body) {
        throw new ValidationError(`Email ${index + 1} missing body`);
      }
    });

    // Validate optional batch parameters
    if (batchSize !== undefined) {
      if (typeof batchSize !== 'number' || batchSize < 1 || batchSize > 100) {
        throw new ValidationError('Batch size must be between 1 and 100');
      }
    }

    if (delayMs !== undefined) {
      if (typeof delayMs !== 'number' || delayMs < 0 || delayMs > 60000) {
        throw new ValidationError('Delay must be between 0 and 60000 milliseconds');
      }
    }

    logger.debug('Bulk email request validated', {
      service: 'notification-service',
      emailCount: emails.length,
      batchSize,
    });

    next();
  }
);

// ============================================================================
// SMS Validation Middleware
// ============================================================================

/**
 * Validate single SMS request
 * POST /api/sms/send
 */
export const validateSMSRequest = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { recipient, body } = req.body;

    // Validate recipient
    validatePhoneNumber(recipient, 'Recipient');

    // Validate body
    if (!body) {
      throw new ValidationError('SMS body is required');
    }
    validateStringLength(body, 'Body', MAX_SMS_BODY_LENGTH);

    logger.debug('SMS request validated', {
      service: 'notification-service',
      recipient,
      bodyLength: body.length,
    });

    next();
  }
);

/**
 * Validate bulk SMS request
 * POST /api/sms/bulk
 */
export const validateBulkSMSRequest = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { messages, batchSize, delayMs } = req.body;

    // Validate messages array
    if (!messages || !Array.isArray(messages)) {
      throw new ValidationError('Messages must be an array');
    }

    if (messages.length === 0) {
      throw new ValidationError('Messages array cannot be empty');
    }

    if (messages.length > MAX_BULK_BATCH_SIZE) {
      throw new ValidationError(`Cannot send more than ${MAX_BULK_BATCH_SIZE} messages at once`);
    }

    // Validate each message
    messages.forEach((message: any, index: number) => {
      if (!message.recipient) {
        throw new ValidationError(`Message ${index + 1} missing recipient`);
      }
      validatePhoneNumber(message.recipient, `Message ${index + 1} recipient`);

      if (!message.body) {
        throw new ValidationError(`Message ${index + 1} missing body`);
      }
    });

    // Validate optional batch parameters
    if (batchSize !== undefined) {
      if (typeof batchSize !== 'number' || batchSize < 1 || batchSize > 50) {
        throw new ValidationError('Batch size must be between 1 and 50');
      }
    }

    if (delayMs !== undefined) {
      if (typeof delayMs !== 'number' || delayMs < 0 || delayMs > 60000) {
        throw new ValidationError('Delay must be between 0 and 60000 milliseconds');
      }
    }

    logger.debug('Bulk SMS request validated', {
      service: 'notification-service',
      messageCount: messages.length,
      batchSize,
    });

    next();
  }
);

// ============================================================================
// Webhook Validation Middleware
// ============================================================================

/**
 * Validate webhook request
 * POST /api/webhook/send
 */
export const validateWebhookRequest = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { url, method, headers, body } = req.body;

    // Validate URL
    validateURL(url, 'Webhook URL');

    // Validate method
    if (method && !ALLOWED_WEBHOOK_METHODS.includes(method.toUpperCase())) {
      throw new ValidationError(
        `Invalid HTTP method. Allowed methods: ${ALLOWED_WEBHOOK_METHODS.join(', ')}`
      );
    }

    // Validate headers
    if (headers) {
      if (typeof headers !== 'object' || Array.isArray(headers)) {
        throw new ValidationError('Headers must be an object');
      }

      // Check for dangerous headers
      const dangerousHeaders = ['host', 'connection', 'transfer-encoding'];
      Object.keys(headers).forEach((key) => {
        if (dangerousHeaders.includes(key.toLowerCase())) {
          throw new ValidationError(`Header "${key}" is not allowed`);
        }
      });
    }

    // Validate body
    if (!body) {
      throw new ValidationError('Webhook body is required');
    }

    if (typeof body !== 'object') {
      throw new ValidationError('Webhook body must be an object');
    }

    const bodySize = JSON.stringify(body).length;
    if (bodySize > MAX_WEBHOOK_BODY_SIZE) {
      throw new ValidationError(
        `Webhook body size (${bodySize} bytes) exceeds maximum of ${MAX_WEBHOOK_BODY_SIZE} bytes`
      );
    }

    logger.debug('Webhook request validated', {
      service: 'notification-service',
      url,
      method: method || 'POST',
      bodySize,
    });

    next();
  }
);

// ============================================================================
// Template Validation Middleware
// ============================================================================

/**
 * Validate template creation request
 * POST /api/templates
 */
export const validateTemplateCreation = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { name, type, subject, body, variables, slug } = req.body;

    // Validate name
    if (!name) {
      throw new ValidationError('Template name is required');
    }
    validateStringLength(name, 'Name', 200);

    // Validate type
    validateNotificationType(type);

    // Validate subject (required for email templates)
    if (type === NotificationType.EMAIL) {
      if (!subject) {
        throw new ValidationError('Subject is required for email templates');
      }
      validateStringLength(subject, 'Subject', 500);
    }

    // Validate body
    if (!body) {
      throw new ValidationError('Template body is required');
    }
    validateStringLength(body, 'Body', MAX_TEMPLATE_BODY_LENGTH);

    // Validate variables
    if (variables) {
      if (!Array.isArray(variables)) {
        throw new ValidationError('Variables must be an array');
      }

      if (variables.length > MAX_TEMPLATE_VARIABLES) {
        throw new ValidationError(`Cannot have more than ${MAX_TEMPLATE_VARIABLES} variables`);
      }

      variables.forEach((variable: string, index: number) => {
        if (typeof variable !== 'string') {
          throw new ValidationError(`Variable ${index + 1} must be a string`);
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable)) {
          throw new ValidationError(
            `Variable "${variable}" has invalid format (must start with letter or underscore, contain only alphanumeric and underscore)`
          );
        }
      });
    }

    // Validate slug if provided
    if (slug) {
      if (typeof slug !== 'string') {
        throw new ValidationError('Slug must be a string');
      }
      if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new ValidationError('Slug must contain only lowercase letters, numbers, and hyphens');
      }
      if (slug.length > 100) {
        throw new ValidationError('Slug cannot exceed 100 characters');
      }
    }

    logger.debug('Template creation request validated', {
      service: 'notification-service',
      name,
      type,
      variableCount: variables?.length || 0,
    });

    next();
  }
);

/**
 * Validate template update request
 * PUT /api/templates/:id
 */
export const validateTemplateUpdate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { name, subject, body, description, isActive } = req.body;

    // At least one field must be provided
    if (!name && !subject && !body && !description && isActive === undefined) {
      throw new ValidationError('At least one field must be provided for update');
    }

    // Validate name if provided
    if (name !== undefined) {
      validateStringLength(name, 'Name', 200);
    }

    // Validate subject if provided
    if (subject !== undefined) {
      validateStringLength(subject, 'Subject', 500);
    }

    // Validate body if provided
    if (body !== undefined) {
      validateStringLength(body, 'Body', MAX_TEMPLATE_BODY_LENGTH);
    }

    // Validate description if provided
    if (description !== undefined && description !== null) {
      validateStringLength(description, 'Description', 1000);
    }

    // Validate isActive if provided
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      throw new ValidationError('isActive must be a boolean');
    }

    logger.debug('Template update request validated', {
      service: 'notification-service',
      templateId: req.params.id,
    });

    next();
  }
);

/**
 * Validate template render request
 * POST /api/templates/render
 */
export const validateTemplateRender = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { templateId, templateSlug, variables } = req.body;

    // Either templateId or templateSlug must be provided
    if (!templateId && !templateSlug) {
      throw new ValidationError('Either templateId or templateSlug is required');
    }

    // Validate variables
    if (!variables) {
      throw new ValidationError('Variables object is required');
    }

    if (typeof variables !== 'object' || Array.isArray(variables)) {
      throw new ValidationError('Variables must be an object');
    }

    logger.debug('Template render request validated', {
      service: 'notification-service',
      templateId,
      templateSlug,
      variableCount: Object.keys(variables).length,
    });

    next();
  }
);

// ============================================================================
// Notification Creation Middleware
// ============================================================================

/**
 * Validate notification creation request
 * POST /api/notifications
 */
export const validateNotificationCreation = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    requireAuthentication(req);

    const { type, body, recipient, subject } = req.body;

    // Validate type
    validateNotificationType(type);

    // Validate body
    if (!body) {
      throw new ValidationError('Notification body is required');
    }

    // Validate recipient
    if (!recipient) {
      throw new ValidationError('Recipient is required');
    }

    // Type-specific validation
    switch (type) {
      case NotificationType.EMAIL:
        validateEmailAddress(recipient, 'Recipient');
        if (!subject) {
          throw new ValidationError('Subject is required for email notifications');
        }
        break;

      case NotificationType.SMS:
        validatePhoneNumber(recipient, 'Recipient');
        break;

      case NotificationType.WEBHOOK:
        validateURL(recipient, 'Recipient');
        break;

      case NotificationType.IN_APP:
        // In-app notifications use user ID, no format validation needed
        break;

      default:
        throw new ValidationError(`Unsupported notification type: ${type}`);
    }

    logger.debug('Notification creation request validated', {
      service: 'notification-service',
      type,
      recipient,
    });

    next();
  }
);
