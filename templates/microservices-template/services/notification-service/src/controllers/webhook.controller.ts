import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ApiResponse } from '@shared/types';
import {
  ValidationError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import { webhookService } from '../services/webhook.service';
import { SendWebhookDTO } from '../models/notification.model';

/**
 * Webhook Controller
 * Handles HTTP requests for webhook sending
 */

export class WebhookController {
  /**
   * Send a webhook
   * POST /api/webhook/send
   */
  public static sendWebhook = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { url, method, headers, body, metadata } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!url) {
        throw new ValidationError('Webhook URL is required');
      }

      if (!webhookService.isValidURL(url)) {
        throw new ValidationError('Invalid webhook URL format');
      }

      if (!body || typeof body !== 'object') {
        throw new ValidationError('Webhook body must be a valid object');
      }

      const webhookData: SendWebhookDTO = {
        url,
        method: method || 'POST',
        headers,
        body,
        metadata,
      };

      const result = await webhookService.sendWebhook(webhookData);

      const response: ApiResponse = {
        success: result.success,
        data: {
          statusCode: result.statusCode,
          response: result.response,
          url: webhookService.sanitizeUrl(url),
        },
        message: result.success ? 'Webhook sent successfully' : 'Failed to send webhook',
        timestamp: new Date().toISOString(),
      };

      if (!result.success) {
        logger.error('Webhook sending failed', {
          tenantId,
          url: webhookService.sanitizeUrl(url),
          error: result.error,
        });
      }

      res.status(result.success ? 200 : 500).json(response);
    }
  );

  /**
   * Send a webhook with retry
   * POST /api/webhook/send-with-retry
   */
  public static sendWebhookWithRetry = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { url, method, headers, body, metadata, maxRetries } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!url) {
        throw new ValidationError('Webhook URL is required');
      }

      if (!webhookService.isValidURL(url)) {
        throw new ValidationError('Invalid webhook URL format');
      }

      if (!body || typeof body !== 'object') {
        throw new ValidationError('Webhook body must be a valid object');
      }

      const webhookData: SendWebhookDTO = {
        url,
        method: method || 'POST',
        headers,
        body,
        metadata,
      };

      const result = await webhookService.sendWebhookWithRetry(webhookData, maxRetries);

      const response: ApiResponse = {
        success: result.success,
        data: {
          statusCode: result.statusCode,
          response: result.response,
          attempts: result.attempts,
          url: webhookService.sanitizeUrl(url),
        },
        message: result.success
          ? `Webhook sent successfully after ${result.attempts} attempt(s)`
          : 'Failed to send webhook after retries',
        timestamp: new Date().toISOString(),
      };

      logger.info('Webhook sent with retry', {
        tenantId,
        url: webhookService.sanitizeUrl(url),
        success: result.success,
        attempts: result.attempts,
      });

      res.status(result.success ? 200 : 500).json(response);
    }
  );

  /**
   * Send test webhook
   * POST /api/webhook/test
   */
  public static sendTestWebhook = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { url } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!url || !webhookService.isValidURL(url)) {
        throw new ValidationError('Valid webhook URL is required');
      }

      const result = await webhookService.sendTestWebhook(url);

      const response: ApiResponse = {
        success: result,
        message: result
          ? 'Test webhook sent successfully'
          : 'Failed to send test webhook',
        timestamp: new Date().toISOString(),
      };

      logger.info('Test webhook sent', {
        tenantId,
        url: webhookService.sanitizeUrl(url),
        success: result,
      });

      res.status(result ? 200 : 500).json(response);
    }
  );

  /**
   * Check webhook service status
   * GET /api/webhook/status
   */
  public static getWebhookServiceStatus = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const isReady = webhookService.isReady();

      const response: ApiResponse = {
        success: true,
        data: {
          ready: isReady,
          status: isReady ? 'operational' : 'unavailable',
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );
}
