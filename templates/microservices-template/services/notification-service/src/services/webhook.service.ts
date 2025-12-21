import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '@shared/utils/logger';
import { notificationConfig } from '../config/notification.config';
import { SendWebhookDTO } from '../models/notification.model';

/**
 * Webhook Service
 * Handles sending HTTP webhooks to external services
 */

class WebhookService {
  private initialized = false;

  /**
   * Initialize webhook service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Webhook service already initialized', {
        service: 'notification-service',
      });
      return;
    }

    try {
      const webhookConfig = notificationConfig.getWebhookConfig();

      if (!webhookConfig.enabled) {
        logger.info('Webhook service is disabled', {
          service: 'notification-service',
        });
        return;
      }

      this.initialized = true;

      logger.info('Webhook service initialized successfully', {
        service: 'notification-service',
        timeout: webhookConfig.timeout,
        maxRetries: webhookConfig.maxRetries,
      });
    } catch (error) {
      logger.error('Failed to initialize webhook service', {
        service: 'notification-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send a webhook
   */
  public async sendWebhook(webhookData: SendWebhookDTO): Promise<{
    success: boolean;
    statusCode?: number;
    response?: any;
    error?: string;
  }> {
    if (!this.initialized) {
      const error = 'Webhook service not initialized or disabled';
      logger.error(error, { service: 'notification-service' });
      return { success: false, error };
    }

    try {
      const webhookConfig = notificationConfig.getWebhookConfig();

      // Validate URL
      if (!this.isValidURL(webhookData.url)) {
        return {
          success: false,
          error: 'Invalid webhook URL',
        };
      }

      // Prepare request config
      const requestConfig: AxiosRequestConfig = {
        method: webhookData.method || 'POST',
        url: webhookData.url,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CloudBill-Notification-Service/1.0',
          ...webhookData.headers,
        },
        data: webhookData.body,
        timeout: webhookConfig.timeout,
        maxRedirects: webhookConfig.maxRedirects,
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      };

      // SSL verification
      if (!webhookConfig.verifySSL) {
        // In production, be cautious about disabling SSL verification
        // requestConfig.httpsAgent = new https.Agent({ rejectUnauthorized: false });
      }

      const startTime = Date.now();
      const response: AxiosResponse = await axios(requestConfig);
      const duration = Date.now() - startTime;

      const success = response.status >= 200 && response.status < 300;

      logger.info(`Webhook ${success ? 'sent successfully' : 'failed'}`, {
        service: 'notification-service',
        url: webhookData.url,
        method: webhookData.method || 'POST',
        statusCode: response.status,
        duration,
      });

      return {
        success,
        statusCode: response.status,
        response: response.data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to send webhook', {
        service: 'notification-service',
        url: webhookData.url,
        method: webhookData.method || 'POST',
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send webhook with retry logic
   */
  public async sendWebhookWithRetry(
    webhookData: SendWebhookDTO,
    maxRetries?: number
  ): Promise<{
    success: boolean;
    statusCode?: number;
    response?: any;
    error?: string;
    attempts: number;
  }> {
    const webhookConfig = notificationConfig.getWebhookConfig();
    const retries = maxRetries !== undefined ? maxRetries : webhookConfig.maxRetries;

    let lastError: string | undefined;
    let lastStatusCode: number | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await this.sendWebhook(webhookData);

      if (result.success) {
        return {
          ...result,
          attempts: attempt + 1,
        };
      }

      lastError = result.error;
      lastStatusCode = result.statusCode;

      // Don't retry on client errors (4xx)
      if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
        logger.warn('Webhook returned client error, not retrying', {
          service: 'notification-service',
          url: webhookData.url,
          statusCode: result.statusCode,
        });
        break;
      }

      // Calculate backoff delay if not last attempt
      if (attempt < retries) {
        const delay = this.calculateBackoffDelay(
          attempt,
          webhookConfig.retryDelay,
          webhookConfig.retryBackoffMultiplier
        );

        logger.info('Webhook failed, retrying...', {
          service: 'notification-service',
          url: webhookData.url,
          attempt: attempt + 1,
          maxRetries: retries,
          delayMs: delay,
        });

        await this.delay(delay);
      }
    }

    return {
      success: false,
      statusCode: lastStatusCode,
      error: lastError || 'Max retries exceeded',
      attempts: retries + 1,
    };
  }

  /**
   * Test webhook configuration
   */
  public async sendTestWebhook(url: string): Promise<boolean> {
    const testWebhook: SendWebhookDTO = {
      url,
      method: 'POST',
      body: {
        test: true,
        message: 'CloudBill Notification Service - Test Webhook',
        timestamp: new Date().toISOString(),
      },
    };

    const result = await this.sendWebhook(testWebhook);
    return result.success;
  }

  /**
   * Close webhook service
   */
  public async close(): Promise<void> {
    this.initialized = false;

    logger.info('Webhook service closed', {
      service: 'notification-service',
    });
  }

  /**
   * Check if webhook service is ready
   */
  public isReady(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Validate URL format
   */
  public isValidURL(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(
    attempt: number,
    baseDelay: number,
    multiplier: number
  ): number {
    return Math.min(baseDelay * Math.pow(multiplier, attempt), 30000); // Max 30 seconds
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sanitize webhook URL for logging (hide query params with sensitive data)
   */
  public sanitizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      // Remove query parameters that might contain sensitive data
      parsedUrl.search = '';
      return parsedUrl.toString();
    } catch {
      return url;
    }
  }
}

// Export singleton instance
export const webhookService = new WebhookService();

// Export class for testing
export { WebhookService };
