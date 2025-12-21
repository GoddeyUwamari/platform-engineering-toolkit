import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { asyncHandler } from '@shared/middleware/error-handler';
import { WebhookService } from '../services/webhook.service';

/**
 * Webhook Controller
 * Handles Stripe webhook events
 */

export class WebhookController {
  /**
   * Handle Stripe webhook
   * POST /api/payments/webhooks/stripe
   */
  public static handleStripeWebhook = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        logger.warn('Missing stripe-signature header');
        res.status(400).json({
          success: false,
          message: 'Missing stripe-signature header',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      try {
        // Get raw body (should be set by middleware)
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);

        // Construct and verify webhook event
        const event = WebhookService.constructEvent(rawBody, signature);

        logger.info('Webhook event received', {
          eventId: event.id,
          eventType: event.type,
        });

        // Handle the event asynchronously
        // Don't wait for completion to respond quickly to Stripe
        WebhookService.handleWebhookEvent(event).catch((error) => {
          logger.error('Error processing webhook event', {
            error,
            eventId: event.id,
            eventType: event.type,
          });
        });

        // Respond immediately to Stripe
        res.status(200).json({
          success: true,
          message: 'Webhook received',
          eventId: event.id,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Webhook signature verification failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(400).json({
          success: false,
          message: 'Webhook signature verification failed',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}
