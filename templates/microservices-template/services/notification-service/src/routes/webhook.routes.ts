import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import {
  requireAuth,
  validateWebhookRequest,
  webhookRateLimit,
  logNotificationRequest,
  requireFeatureEnabled,
  addTenantContext,
  addRequestMetadata,
} from '../middleware';

/**
 * Webhook Routes
 * Defines all webhook sending endpoints
 */

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(addTenantContext);
router.use(addRequestMetadata);

/**
 * @route   POST /api/webhook/send
 * @desc    Send a webhook
 * @access  Private
 */
router.post(
  '/send',
  requireFeatureEnabled('webhook'),
  webhookRateLimit,
  validateWebhookRequest,
  logNotificationRequest,
  WebhookController.sendWebhook
);

/**
 * @route   POST /api/webhook/send-with-retry
 * @desc    Send a webhook with retry logic
 * @access  Private
 */
router.post(
  '/send-with-retry',
  requireFeatureEnabled('webhook'),
  webhookRateLimit,
  validateWebhookRequest,
  logNotificationRequest,
  WebhookController.sendWebhookWithRetry
);

/**
 * @route   POST /api/webhook/test
 * @desc    Send a test webhook
 * @access  Private
 */
router.post(
  '/test',
  requireFeatureEnabled('webhook'),
  WebhookController.sendTestWebhook
);

/**
 * @route   GET /api/webhook/status
 * @desc    Check webhook service status
 * @access  Private
 */
router.get('/status', WebhookController.getWebhookServiceStatus);

export default router;
