import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();

/**
 * Webhook Routes
 * Note: No authentication middleware for webhooks as they use signature verification
 */

// Handle Stripe webhook events
router.post('/stripe', WebhookController.handleStripeWebhook);

export default router;
