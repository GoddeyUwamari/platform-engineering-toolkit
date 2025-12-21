import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';
import {
  requireAuth,
  validateEmailRequest,
  validateBulkEmailRequest,
  emailRateLimit,
  sanitizeNotificationContent,
  logNotificationRequest,
  requireFeatureEnabled,
  addTenantContext,
  addRequestMetadata,
} from '../middleware';

/**
 * Email Routes
 * Defines all email sending endpoints
 */

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(addTenantContext);
router.use(addRequestMetadata);

/**
 * @route   POST /api/email/send
 * @desc    Send a single email
 * @access  Private
 */
router.post(
  '/send',
  requireFeatureEnabled('email'),
  emailRateLimit,
  validateEmailRequest,
  sanitizeNotificationContent,
  logNotificationRequest,
  EmailController.sendEmail
);

/**
 * @route   POST /api/email/bulk
 * @desc    Send bulk emails
 * @access  Private
 */
router.post(
  '/bulk',
  requireFeatureEnabled('email'),
  emailRateLimit,
  validateBulkEmailRequest,
  logNotificationRequest,
  EmailController.sendBulkEmails
);

/**
 * @route   POST /api/email/test
 * @desc    Send a test email
 * @access  Private
 */
router.post(
  '/test',
  requireFeatureEnabled('email'),
  EmailController.sendTestEmail
);

/**
 * @route   GET /api/email/status
 * @desc    Check email service status
 * @access  Private
 */
router.get('/status', EmailController.getEmailServiceStatus);

export default router;
