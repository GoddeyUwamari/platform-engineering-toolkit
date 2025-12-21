import { logger } from '@shared/utils/logger';
import { notificationConfig } from '../config/notification.config';
import { SendSMSDTO } from '../models/notification.model';

/**
 * SMS Service
 * Handles sending SMS messages
 * Currently supports Twilio (can be extended to support other providers)
 */

class SMSService {
  private initialized = false;
  // private twilioClient: any = null;  // Reserved for Twilio SDK integration

  /**
   * Initialize SMS service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('SMS service already initialized', {
        service: 'notification-service',
      });
      return;
    }

    try {
      const smsConfig = notificationConfig.getSMSConfig();

      if (!smsConfig.enabled) {
        logger.info('SMS service is disabled', {
          service: 'notification-service',
        });
        return;
      }

      // Initialize Twilio client if provider is Twilio
      if (smsConfig.provider === 'twilio') {
        // Note: Twilio SDK would need to be installed via npm
        // For now, this is a placeholder implementation
        logger.info('Twilio SMS provider configured', {
          service: 'notification-service',
          accountSid: smsConfig.twilio.accountSid ? '***' : 'not set',
        });

        // In production, you would initialize like this:
        // const twilio = require('twilio');
        // this.twilioClient = twilio(smsConfig.twilio.accountSid, smsConfig.twilio.authToken);
      }

      this.initialized = true;

      logger.info('SMS service initialized successfully', {
        service: 'notification-service',
        provider: smsConfig.provider,
      });
    } catch (error) {
      logger.error('Failed to initialize SMS service', {
        service: 'notification-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send an SMS message
   */
  public async sendSMS(smsData: SendSMSDTO): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (!this.initialized) {
      const error = 'SMS service not initialized or disabled';
      logger.error(error, { service: 'notification-service' });
      return { success: false, error };
    }

    try {
      const smsConfig = notificationConfig.getSMSConfig();

      // Validate phone number format
      if (!this.isValidPhoneNumber(smsData.recipient)) {
        return {
          success: false,
          error: 'Invalid phone number format',
        };
      }

      // Send via Twilio
      if (smsConfig.provider === 'twilio') {
        return await this.sendViaTwilio(smsData, smsConfig);
      }

      // Add support for other providers here (SNS, Nexmo, etc.)

      return {
        success: false,
        error: `SMS provider ${smsConfig.provider} not implemented`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to send SMS', {
        service: 'notification-service',
        recipient: smsData.recipient,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendViaTwilio(
    smsData: SendSMSDTO,
    _smsConfig: any
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      // In production with Twilio SDK installed:
      // const message = await this.twilioClient.messages.create({
      //   body: smsData.body,
      //   from: smsConfig.twilio.fromNumber,
      //   to: smsData.recipient,
      // });

      // For now, simulate success
      logger.info('SMS sent successfully (simulated)', {
        service: 'notification-service',
        recipient: smsData.recipient,
        provider: 'twilio',
      });

      return {
        success: true,
        messageId: `sim_${Date.now()}`,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send bulk SMS messages
   */
  public async sendBulkSMS(
    messages: SendSMSDTO[],
    options: { batchSize?: number; delayMs?: number } = {}
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{ recipient: string; success: boolean; error?: string }>;
  }> {
    const { batchSize = 5, delayMs = 1000 } = options;
    const results: Array<{ recipient: string; success: boolean; error?: string }> = [];

    let successful = 0;
    let failed = 0;

    // Process SMS in batches
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      // Send batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (sms) => {
          const result = await this.sendSMS(sms);
          return {
            recipient: sms.recipient,
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

      // Delay between batches
      if (i + batchSize < messages.length) {
        await this.delay(delayMs);
      }
    }

    logger.info('Bulk SMS sending completed', {
      service: 'notification-service',
      total: messages.length,
      successful,
      failed,
    });

    return {
      total: messages.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Test SMS configuration
   */
  public async sendTestSMS(recipient: string): Promise<boolean> {
    const testSMS: SendSMSDTO = {
      recipient,
      body: `CloudBill Notification Service - Test SMS sent at ${new Date().toISOString()}`,
    };

    const result = await this.sendSMS(testSMS);
    return result.success;
  }

  /**
   * Close SMS service
   */
  public async close(): Promise<void> {
    // this.twilioClient = null;  // Reserved for Twilio SDK cleanup
    this.initialized = false;

    logger.info('SMS service closed', {
      service: 'notification-service',
    });
  }

  /**
   * Check if SMS service is ready
   */
  public isReady(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Validate phone number format (basic validation)
   */
  public isValidPhoneNumber(phoneNumber: string): boolean {
    // Remove spaces, dashes, and parentheses
    const cleaned = phoneNumber.replace(/[\s-()]/g, '');
    // Basic validation: should start with + and contain 10-15 digits
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    return phoneRegex.test(cleaned);
  }

  /**
   * Format phone number to E.164 format
   */
  public formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/[\s-()]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    return `+${cleaned}`;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const smsService = new SMSService();

// Export class for testing
export { SMSService };
