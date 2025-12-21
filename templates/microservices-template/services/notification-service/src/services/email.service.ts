import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { logger } from '@shared/utils/logger';
import { notificationConfig } from '../config/notification.config';
import { SendEmailDTO, EmailAttachment } from '../models/notification.model';

/**
 * Email Service
 * Handles sending emails via SMTP using Nodemailer
 */

class EmailService {
  private transporter: Transporter | null = null;
  private initialized = false;

  /**
   * Initialize email service with SMTP configuration
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Email service already initialized', {
        service: 'notification-service',
      });
      return;
    }

    try {
      const emailConfig = notificationConfig.getEmailConfig();

      if (!emailConfig.enabled) {
        logger.info('Email service is disabled', {
          service: 'notification-service',
        });
        return;
      }

      // Check if SMTP credentials are configured
      if (!emailConfig.smtp.auth.user || !emailConfig.smtp.auth.pass) {
        logger.warn('SMTP credentials not configured - email service will not be available', {
          service: 'notification-service',
          hint: 'Set SMTP_USER and SMTP_PASS environment variables to enable email',
        });
        return;
      }

      // Check if SMTP host is configured
      if (!emailConfig.smtp.host || emailConfig.smtp.host === 'localhost') {
        logger.warn('SMTP host not properly configured - email service will not be available', {
          service: 'notification-service',
          host: emailConfig.smtp.host,
          hint: 'Set SMTP_HOST environment variable to a valid SMTP server',
        });
        return;
      }

      // Create SMTP transporter
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure, // true for 465, false for other ports
        auth: {
          user: emailConfig.smtp.auth.user,
          pass: emailConfig.smtp.auth.pass,
        },
        // Connection timeout
        connectionTimeout: 10000,
        // Socket timeout
        socketTimeout: 10000,
        // Pooling
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });

      // Verify SMTP connection
      await this.transporter.verify();

      this.initialized = true;

      logger.info('Email service initialized successfully', {
        service: 'notification-service',
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
      });
    } catch (error) {
      logger.warn('Failed to initialize email service - service will start without email capability', {
        service: 'notification-service',
        error: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Check SMTP configuration and credentials',
      });

      // Clean up transporter if verification failed
      if (this.transporter) {
        this.transporter.close();
        this.transporter = null;
      }

      // Don't throw error - allow service to start without email
      // Email sending will fail gracefully
    }
  }

  /**
   * Send an email
   */
  public async sendEmail(emailData: SendEmailDTO): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (!this.initialized || !this.transporter) {
      const error = 'Email service not initialized or disabled';
      logger.error(error, { service: 'notification-service' });
      return { success: false, error };
    }

    try {
      const emailConfig = notificationConfig.getEmailConfig();

      // Prepare email options
      const mailOptions: SendMailOptions = {
        from: {
          name: emailConfig.from.name,
          address: emailConfig.from.address,
        },
        to: emailData.recipient,
        subject: emailData.subject,
        html: emailData.body, // HTML body
        text: this.stripHtml(emailData.body), // Plain text fallback
      };

      // Add optional fields
      if (emailData.cc && emailData.cc.length > 0) {
        mailOptions.cc = emailData.cc.join(',');
      }

      if (emailData.bcc && emailData.bcc.length > 0) {
        mailOptions.bcc = emailData.bcc.join(',');
      }

      if (emailConfig.replyTo) {
        mailOptions.replyTo = emailConfig.replyTo;
      }

      if (emailData.attachments && emailData.attachments.length > 0) {
        mailOptions.attachments = emailData.attachments.map(this.formatAttachment);
      }

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        service: 'notification-service',
        recipient: emailData.recipient,
        subject: emailData.subject,
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to send email', {
        service: 'notification-service',
        recipient: emailData.recipient,
        subject: emailData.subject,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk emails (with rate limiting)
   */
  public async sendBulkEmails(
    emails: SendEmailDTO[],
    options: { batchSize?: number; delayMs?: number } = {}
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{ recipient: string; success: boolean; error?: string }>;
  }> {
    const { batchSize = 10, delayMs = 1000 } = options;
    const results: Array<{ recipient: string; success: boolean; error?: string }> = [];

    let successful = 0;
    let failed = 0;

    // Process emails in batches
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      // Send batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const result = await this.sendEmail(email);
          return {
            recipient: email.recipient,
            success: result.success,
            error: result.error,
          };
        })
      );

      // Aggregate results
      for (const result of batchResults) {
        results.push(result);
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      }

      // Delay between batches to respect rate limits
      if (i + batchSize < emails.length) {
        await this.delay(delayMs);
      }
    }

    logger.info('Bulk email sending completed', {
      service: 'notification-service',
      total: emails.length,
      successful,
      failed,
    });

    return {
      total: emails.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Test email configuration by sending a test email
   */
  public async sendTestEmail(recipient: string): Promise<boolean> {
    const testEmail: SendEmailDTO = {
      recipient,
      subject: 'CloudBill Notification Service - Test Email',
      body: `
        <h1>Test Email</h1>
        <p>This is a test email from the CloudBill Notification Service.</p>
        <p>If you received this email, your email configuration is working correctly.</p>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
    };

    const result = await this.sendEmail(testEmail);
    return result.success;
  }

  /**
   * Close email service and cleanup resources
   */
  public async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      this.initialized = false;

      logger.info('Email service closed', {
        service: 'notification-service',
      });
    }
  }

  /**
   * Check if email service is initialized and ready
   */
  public isReady(): boolean {
    return this.initialized && this.transporter !== null;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Strip HTML tags from string (for plain text fallback)
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*<\/style>/gmi, '')
      .replace(/<script[^>]*>.*<\/script>/gmi, '')
      .replace(/<[^>]+>/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }

  /**
   * Format attachment for nodemailer
   */
  private formatAttachment(attachment: EmailAttachment): any {
    return {
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
      encoding: attachment.encoding || 'base64',
    };
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate email address format
   */
  public isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export class for testing
export { EmailService };
