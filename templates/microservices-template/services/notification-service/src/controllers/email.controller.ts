import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ApiResponse } from '@shared/types';
import {
  ValidationError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import { emailService } from '../services/email.service';
import { templateService } from '../services/template.service';
import { SendEmailDTO } from '../models/notification.model';

/**
 * Email Controller
 * Handles HTTP requests for email sending
 */

export class EmailController {
  /**
   * Send a single email
   * POST /api/email/send
   */
  public static sendEmail = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { recipient, subject, body, cc, bcc, attachments, templateId, templateVariables, metadata } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!recipient) {
        throw new ValidationError('Recipient email address is required');
      }

      if (!emailService.isValidEmail(recipient)) {
        throw new ValidationError('Invalid recipient email address');
      }

      let finalSubject = subject;
      let finalBody = body;

      // If template is provided, render it
      if (templateId && templateVariables) {
        const rendered = await templateService.renderTemplate(
          { templateId, variables: templateVariables },
          tenantId
        );
        finalSubject = rendered.subject || subject;
        finalBody = rendered.body;
      }

      if (!finalSubject || !finalBody) {
        throw new ValidationError('Email subject and body are required');
      }

      const emailData: SendEmailDTO = {
        recipient,
        subject: finalSubject,
        body: finalBody,
        cc,
        bcc,
        attachments,
        metadata,
      };

      const result = await emailService.sendEmail(emailData);

      const response: ApiResponse = {
        success: result.success,
        data: {
          messageId: result.messageId,
          recipient,
        },
        message: result.success ? 'Email sent successfully' : 'Failed to send email',
        timestamp: new Date().toISOString(),
      };

      if (!result.success) {
        logger.error('Email sending failed', {
          tenantId,
          recipient,
          error: result.error,
        });
      }

      res.status(result.success ? 200 : 500).json(response);
    }
  );

  /**
   * Send bulk emails
   * POST /api/email/bulk
   */
  public static sendBulkEmails = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { emails, batchSize, delayMs } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        throw new ValidationError('Emails array is required');
      }

      // Validate all email addresses
      for (const email of emails) {
        if (!email.recipient || !emailService.isValidEmail(email.recipient)) {
          throw new ValidationError(`Invalid email recipient: ${email.recipient}`);
        }
        if (!email.subject || !email.body) {
          throw new ValidationError('All emails must have subject and body');
        }
      }

      const result = await emailService.sendBulkEmails(emails, {
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
        message: `Sent ${result.successful} of ${result.total} emails`,
        timestamp: new Date().toISOString(),
      };

      logger.info('Bulk email sending completed', {
        tenantId,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Send test email
   * POST /api/email/test
   */
  public static sendTestEmail = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { recipient } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!recipient || !emailService.isValidEmail(recipient)) {
        throw new ValidationError('Valid recipient email address is required');
      }

      const result = await emailService.sendTestEmail(recipient);

      const response: ApiResponse = {
        success: result,
        message: result
          ? 'Test email sent successfully'
          : 'Failed to send test email',
        timestamp: new Date().toISOString(),
      };

      logger.info('Test email sent', {
        tenantId,
        recipient,
        success: result,
      });

      res.status(result ? 200 : 500).json(response);
    }
  );

  /**
   * Check email service status
   * GET /api/email/status
   */
  public static getEmailServiceStatus = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const isReady = emailService.isReady();

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
