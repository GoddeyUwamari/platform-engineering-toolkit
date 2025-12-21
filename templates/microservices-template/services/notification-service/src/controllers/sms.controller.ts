import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ApiResponse } from '@shared/types';
import {
  ValidationError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import { smsService } from '../services/sms.service';
import { templateService } from '../services/template.service';
import { SendSMSDTO } from '../models/notification.model';

/**
 * SMS Controller
 * Handles HTTP requests for SMS sending
 */

export class SMSController {
  /**
   * Send a single SMS
   * POST /api/sms/send
   */
  public static sendSMS = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { recipient, body, templateId, templateVariables, metadata } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!recipient) {
        throw new ValidationError('Recipient phone number is required');
      }

      if (!smsService.isValidPhoneNumber(recipient)) {
        throw new ValidationError('Invalid recipient phone number format');
      }

      let finalBody = body;

      // If template is provided, render it
      if (templateId && templateVariables) {
        const rendered = await templateService.renderTemplate(
          { templateId, variables: templateVariables },
          tenantId
        );
        finalBody = rendered.body;
      }

      if (!finalBody) {
        throw new ValidationError('SMS body is required');
      }

      const smsData: SendSMSDTO = {
        recipient,
        body: finalBody,
        metadata,
      };

      const result = await smsService.sendSMS(smsData);

      const response: ApiResponse = {
        success: result.success,
        data: {
          messageId: result.messageId,
          recipient,
        },
        message: result.success ? 'SMS sent successfully' : 'Failed to send SMS',
        timestamp: new Date().toISOString(),
      };

      if (!result.success) {
        logger.error('SMS sending failed', {
          tenantId,
          recipient,
          error: result.error,
        });
      }

      res.status(result.success ? 200 : 500).json(response);
    }
  );

  /**
   * Send bulk SMS messages
   * POST /api/sms/bulk
   */
  public static sendBulkSMS = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { messages, batchSize, delayMs } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new ValidationError('Messages array is required');
      }

      // Validate all phone numbers
      for (const message of messages) {
        if (!message.recipient || !smsService.isValidPhoneNumber(message.recipient)) {
          throw new ValidationError(`Invalid phone number: ${message.recipient}`);
        }
        if (!message.body) {
          throw new ValidationError('All messages must have a body');
        }
      }

      const result = await smsService.sendBulkSMS(messages, {
        batchSize,
        delayMs,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          total: result.total,
          successful: result.successful,
          failed: result.failed,
          results: result.results,
        },
        message: `Sent ${result.successful} of ${result.total} SMS messages`,
        timestamp: new Date().toISOString(),
      };

      logger.info('Bulk SMS sending completed', {
        tenantId,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Send test SMS
   * POST /api/sms/test
   */
  public static sendTestSMS = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { recipient } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!recipient || !smsService.isValidPhoneNumber(recipient)) {
        throw new ValidationError('Valid recipient phone number is required');
      }

      const result = await smsService.sendTestSMS(recipient);

      const response: ApiResponse = {
        success: result,
        message: result
          ? 'Test SMS sent successfully'
          : 'Failed to send test SMS',
        timestamp: new Date().toISOString(),
      };

      logger.info('Test SMS sent', {
        tenantId,
        recipient,
        success: result,
      });

      res.status(result ? 200 : 500).json(response);
    }
  );

  /**
   * Check SMS service status
   * GET /api/sms/status
   */
  public static getSMSServiceStatus = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const isReady = smsService.isReady();

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
