import Stripe from 'stripe';
import { logger } from '@shared/utils/logger';

/**
 * Stripe Configuration for Payment Service
 * Manages Stripe SDK initialization and configuration
 */

class StripeConfig {
  private static instance: StripeConfig;
  private stripeClient: Stripe | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Singleton pattern to ensure single Stripe configuration instance
   */
  public static getInstance(): StripeConfig {
    if (!StripeConfig.instance) {
      StripeConfig.instance = new StripeConfig();
    }
    return StripeConfig.instance;
  }

  /**
   * Initialize Stripe client
   */
  public initialize(): void {
    if (this.initialized) {
      if (this.stripeClient) {
        logger.warn('Stripe client already initialized', {
          service: 'payment-service',
        });
      }
      return;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      logger.warn('⚠️  STRIPE_SECRET_KEY not configured - Payment processing will not be available', {
        service: 'payment-service',
        message: 'Set STRIPE_SECRET_KEY environment variable to enable Stripe payment processing',
      });
      this.initialized = true;
      this.stripeClient = null;
      return;
    }

    try {
      logger.info('Initializing Stripe client...', {
        service: 'payment-service',
        apiVersion: '2023-10-16',
      });

      this.stripeClient = new Stripe(secretKey, {
        apiVersion: '2023-10-16',
        typescript: true,
        maxNetworkRetries: 2,
        timeout: 30000, // 30 seconds
        telemetry: false, // Disable telemetry for security
      });

      this.initialized = true;

      logger.info('Stripe client initialized successfully', {
        service: 'payment-service',
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY?.substring(0, 10) + '...',
      });

    } catch (error) {
      logger.error('Failed to initialize Stripe client', {
        service: 'payment-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get Stripe client instance
   */
  public getClient(): Stripe {
    if (!this.initialized) {
      throw new Error('Stripe client not initialized. Call initialize() first.');
    }
    if (!this.stripeClient) {
      throw new Error('Stripe client not available. STRIPE_SECRET_KEY environment variable is not configured. Please set STRIPE_SECRET_KEY to enable payment processing.');
    }
    return this.stripeClient;
  }

  /**
   * Get Stripe configuration
   */
  public getConfig(): {
    publishableKey: string;
    webhookSecret: string | undefined;
    currency: string;
  } {
    return {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      currency: process.env.STRIPE_CURRENCY || 'usd',
    };
  }

  /**
   * Validate webhook signature
   */
  public constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret?: string
  ): Stripe.Event {
    if (!this.stripeClient) {
      throw new Error('Stripe client not initialized');
    }

    const secret = webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      throw new Error('Webhook secret not configured');
    }

    try {
      return this.stripeClient.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      logger.error('Webhook signature verification failed', {
        service: 'payment-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if Stripe is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.stripeClient !== null;
  }

  /**
   * Test Stripe connection
   */
  public async testConnection(): Promise<boolean> {
    if (!this.stripeClient) {
      return false;
    }

    try {
      // Try to retrieve the account to test connection
      await this.stripeClient.accounts.retrieve();
      logger.info('Stripe connection test successful', {
        service: 'payment-service',
      });
      return true;
    } catch (error) {
      logger.error('Stripe connection test failed', {
        service: 'payment-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

// Export singleton instance
export const stripeConfig = StripeConfig.getInstance();

// Export class for testing purposes
export { StripeConfig };
