import { Router } from 'express';
import { SMSController } from '../controllers/sms.controller';
import {
  requireAuth,
  validateSMSRequest,
  validateBulkSMSRequest,
  smsRateLimit,
  sanitizeNotificationContent,
  logNotificationRequest,
  requireFeatureEnabled,
  addTenantContext,
  addRequestMetadata,
} from '../middleware';

/**
 * SMS Routes
 * Defines all SMS sending endpoints
 */

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(addTenantContext);
router.use(addRequestMetadata);

/**
 * @route   POST /api/sms/send
 * @desc    Send a single SMS
 * @access  Private
 */
router.post(
  '/send',
  requireFeatureEnabled('sms'),
  smsRateLimit,
  validateSMSRequest,
  sanitizeNotificationContent,
  logNotificationRequest,
  SMSController.sendSMS
);

/**
 * @route   POST /api/sms/bulk
 * @desc    Send bulk SMS messages
 * @access  Private
 */
router.post(
  '/bulk',
  requireFeatureEnabled('sms'),
  smsRateLimit,
  validateBulkSMSRequest,
  logNotificationRequest,
  SMSController.sendBulkSMS
);

/**
 * @route   POST /api/sms/test
 * @desc    Send a test SMS
 * @access  Private
 */
router.post(
  '/test',
  requireFeatureEnabled('sms'),
  SMSController.sendTestSMS
);

/**
 * @route   GET /api/sms/status
 * @desc    Check SMS service status
 * @access  Private
 */
router.get('/status', SMSController.getSMSServiceStatus);

export default router;
