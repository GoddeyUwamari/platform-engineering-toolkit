import { logger } from '@shared/utils/logger';

/**
 * Billing Service Configuration
 * Manages billing-specific settings, payment providers, and invoice generation
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface BillingConfig {
  // Service Configuration
  service: {
    name: string;
    port: number;
    env: string;
    version: string;
  };

  // Server Configuration
  server: {
    port: number;
    corsOrigin: string;
    bodyLimit: string;
    requestTimeout: number;
  };

  // Invoice Configuration
  invoice: {
    defaultCurrency: string;
    defaultDueDays: number;
    numberPrefix: string;
    pdfWatermarkDraft: boolean;
    allowVoidPaid: boolean;
    autoFinalizeOnPayment: boolean;
  };

  // Subscription Configuration
  subscription: {
    defaultBillingCycle: 'monthly' | 'yearly';
    defaultCurrency: string;
    allowMidCycleCancellation: boolean;
    prorateCancellations: boolean;
    trialPeriodDays: number;
    gracePeridDays: number;
  };

  // Payment Configuration
  payment: {
    providers: {
      stripe: {
        enabled: boolean;
        secretKey?: string;
        publishableKey?: string;
        webhookSecret?: string;
      };
    };
    defaultProvider: 'stripe' | 'manual';
    requirePaymentMethod: boolean;
    autoRetryFailedPayments: boolean;
    maxRetryAttempts: number;
  };

  // Usage Tracking Configuration
  usage: {
    batchSize: number;
    aggregationInterval: number; // in minutes
    retentionDays: number;
    allowNegativeUsage: boolean;
  };

  // Notification Configuration
  notifications: {
    sendInvoiceEmails: boolean;
    sendPaymentConfirmations: boolean;
    sendSubscriptionAlerts: boolean;
    overdueReminderDays: number[];
  };

  // Tax Configuration
  tax: {
    defaultRate: number;
    enableTaxCalculation: boolean;
    taxInclusivePricing: boolean;
  };

  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    enabled: boolean;
  };

  // Feature Flags
  features: {
    enablePdfGeneration: boolean;
    enableUsageBasedBilling: boolean;
    enableMultipleCurrencies: boolean;
    enableDiscounts: boolean;
    enableCredits: boolean;
  };
}

// ============================================================================
// Configuration Class
// ============================================================================

class BillingConfiguration {
  private static instance: BillingConfiguration;
  private config: BillingConfig;
  private validated = false;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  /**
   * Singleton pattern to ensure single configuration instance
   */
  public static getInstance(): BillingConfiguration {
    if (!BillingConfiguration.instance) {
      BillingConfiguration.instance = new BillingConfiguration();
    }
    return BillingConfiguration.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): BillingConfig {
    return {
      service: {
        name: process.env.SERVICE_NAME || 'billing-service',
        port: parseInt(process.env.BILLING_SERVICE_PORT || process.env.PORT || '3002', 10),
        env: process.env.NODE_ENV || 'development',
        version: process.env.SERVICE_VERSION || '1.0.0',
      },

      server: {
        port: parseInt(process.env.BILLING_SERVICE_PORT || process.env.PORT || '3002', 10),
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        bodyLimit: process.env.BODY_LIMIT || '10mb',
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
      },

      invoice: {
        defaultCurrency: process.env.INVOICE_DEFAULT_CURRENCY || 'USD',
        defaultDueDays: parseInt(process.env.INVOICE_DUE_DAYS || '30', 10),
        numberPrefix: process.env.INVOICE_NUMBER_PREFIX || 'INV',
        pdfWatermarkDraft: process.env.INVOICE_PDF_WATERMARK_DRAFT !== 'false',
        allowVoidPaid: process.env.INVOICE_ALLOW_VOID_PAID === 'true',
        autoFinalizeOnPayment: process.env.INVOICE_AUTO_FINALIZE === 'true',
      },

      subscription: {
        defaultBillingCycle: (process.env.SUBSCRIPTION_DEFAULT_CYCLE as 'monthly' | 'yearly') || 'monthly',
        defaultCurrency: process.env.SUBSCRIPTION_DEFAULT_CURRENCY || 'USD',
        allowMidCycleCancellation: process.env.SUBSCRIPTION_ALLOW_MID_CYCLE_CANCEL !== 'false',
        prorateCancellations: process.env.SUBSCRIPTION_PRORATE_CANCELLATIONS === 'true',
        trialPeriodDays: parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || '14', 10),
        gracePeridDays: parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '3', 10),
      },

      payment: {
        providers: {
          stripe: {
            enabled: process.env.STRIPE_ENABLED === 'true',
            secretKey: process.env.STRIPE_SECRET_KEY,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          },
        },
        defaultProvider: (process.env.PAYMENT_DEFAULT_PROVIDER as 'stripe' | 'manual') || 'stripe',
        requirePaymentMethod: process.env.PAYMENT_REQUIRE_METHOD !== 'false',
        autoRetryFailedPayments: process.env.PAYMENT_AUTO_RETRY === 'true',
        maxRetryAttempts: parseInt(process.env.PAYMENT_MAX_RETRIES || '3', 10),
      },

      usage: {
        batchSize: parseInt(process.env.USAGE_BATCH_SIZE || '100', 10),
        aggregationInterval: parseInt(process.env.USAGE_AGGREGATION_INTERVAL || '60', 10),
        retentionDays: parseInt(process.env.USAGE_RETENTION_DAYS || '365', 10),
        allowNegativeUsage: process.env.USAGE_ALLOW_NEGATIVE === 'true',
      },

      notifications: {
        sendInvoiceEmails: process.env.NOTIFICATIONS_SEND_INVOICE !== 'false',
        sendPaymentConfirmations: process.env.NOTIFICATIONS_SEND_PAYMENT !== 'false',
        sendSubscriptionAlerts: process.env.NOTIFICATIONS_SEND_SUBSCRIPTION !== 'false',
        overdueReminderDays: this.parseNumberArray(process.env.NOTIFICATIONS_OVERDUE_DAYS || '7,14,30'),
      },

      tax: {
        defaultRate: parseFloat(process.env.TAX_DEFAULT_RATE || '0'),
        enableTaxCalculation: process.env.TAX_ENABLED === 'true',
        taxInclusivePricing: process.env.TAX_INCLUSIVE === 'true',
      },

      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      },

      features: {
        enablePdfGeneration: process.env.FEATURE_PDF_GENERATION !== 'false',
        enableUsageBasedBilling: process.env.FEATURE_USAGE_BILLING !== 'false',
        enableMultipleCurrencies: process.env.FEATURE_MULTI_CURRENCY === 'true',
        enableDiscounts: process.env.FEATURE_DISCOUNTS !== 'false',
        enableCredits: process.env.FEATURE_CREDITS !== 'false',
      },
    };
  }

  /**
   * Parse comma-separated string of numbers
   */
  private parseNumberArray(value: string): number[] {
    return value.split(',').map((v) => parseInt(v.trim(), 10)).filter((n) => !isNaN(n));
  }

  /**
   * Validate configuration
   */
  public validate(): void {
    if (this.validated) {
      logger.debug('Configuration already validated', {
        service: 'billing-service',
      });
      return;
    }

    const errors: string[] = [];

    // Validate service configuration
    if (!this.config.service.name) {
      errors.push('Service name is required');
    }

    if (this.config.service.port < 1 || this.config.service.port > 65535) {
      errors.push('Service port must be between 1 and 65535');
    }

    // Validate invoice configuration
    if (this.config.invoice.defaultDueDays < 0) {
      errors.push('Invoice due days must be non-negative');
    }

    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    if (!validCurrencies.includes(this.config.invoice.defaultCurrency)) {
      logger.warn('Invoice default currency not in common list', {
        currency: this.config.invoice.defaultCurrency,
        validCurrencies,
      });
    }

    // Validate subscription configuration
    if (!['monthly', 'yearly'].includes(this.config.subscription.defaultBillingCycle)) {
      errors.push('Subscription default billing cycle must be "monthly" or "yearly"');
    }

    if (this.config.subscription.trialPeriodDays < 0) {
      errors.push('Trial period days must be non-negative');
    }

    if (this.config.subscription.gracePeridDays < 0) {
      errors.push('Grace period days must be non-negative');
    }

    // Validate payment configuration
    if (this.config.payment.providers.stripe.enabled) {
      if (!this.config.payment.providers.stripe.secretKey) {
        errors.push('Stripe secret key is required when Stripe is enabled');
      }
      if (!this.config.payment.providers.stripe.publishableKey) {
        logger.warn('Stripe publishable key not set', {
          service: 'billing-service',
        });
      }
    }

    if (!['stripe', 'manual'].includes(this.config.payment.defaultProvider)) {
      errors.push('Payment default provider must be "stripe" or "manual"');
    }

    if (this.config.payment.maxRetryAttempts < 0 || this.config.payment.maxRetryAttempts > 10) {
      errors.push('Payment max retry attempts must be between 0 and 10');
    }

    // Validate usage configuration
    if (this.config.usage.batchSize < 1 || this.config.usage.batchSize > 1000) {
      errors.push('Usage batch size must be between 1 and 1000');
    }

    if (this.config.usage.retentionDays < 1) {
      errors.push('Usage retention days must be at least 1');
    }

    // Validate tax configuration
    if (this.config.tax.defaultRate < 0 || this.config.tax.defaultRate > 100) {
      errors.push('Tax default rate must be between 0 and 100');
    }

    // Validate rate limiting
    if (this.config.rateLimit.windowMs < 1000) {
      errors.push('Rate limit window must be at least 1000ms (1 second)');
    }

    if (this.config.rateLimit.maxRequests < 1) {
      errors.push('Rate limit max requests must be at least 1');
    }

    // Log errors and throw if any
    if (errors.length > 0) {
      logger.error('Billing configuration validation failed', {
        service: 'billing-service',
        errors,
      });
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    this.validated = true;
    logger.info('Billing configuration validated successfully', {
      service: 'billing-service',
      port: this.config.service.port,
      env: this.config.service.env,
      features: this.config.features,
    });
  }

  /**
   * Get the full configuration
   */
  public getConfig(): Readonly<BillingConfig> {
    if (!this.validated) {
      this.validate();
    }
    return this.config;
  }

  /**
   * Get service configuration
   */
  public getServiceConfig(): Readonly<BillingConfig['service']> {
    return this.config.service;
  }

  /**
   * Get invoice configuration
   */
  public getInvoiceConfig(): Readonly<BillingConfig['invoice']> {
    return this.config.invoice;
  }

  /**
   * Get subscription configuration
   */
  public getSubscriptionConfig(): Readonly<BillingConfig['subscription']> {
    return this.config.subscription;
  }

  /**
   * Get payment configuration
   */
  public getPaymentConfig(): Readonly<BillingConfig['payment']> {
    return this.config.payment;
  }

  /**
   * Get usage configuration
   */
  public getUsageConfig(): Readonly<BillingConfig['usage']> {
    return this.config.usage;
  }

  /**
   * Get notifications configuration
   */
  public getNotificationsConfig(): Readonly<BillingConfig['notifications']> {
    return this.config.notifications;
  }

  /**
   * Get tax configuration
   */
  public getTaxConfig(): Readonly<BillingConfig['tax']> {
    return this.config.tax;
  }

  /**
   * Get rate limit configuration
   */
  public getRateLimitConfig(): Readonly<BillingConfig['rateLimit']> {
    return this.config.rateLimit;
  }

  /**
   * Get feature flags
   */
  public getFeatures(): Readonly<BillingConfig['features']> {
    return this.config.features;
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(feature: keyof BillingConfig['features']): boolean {
    return this.config.features[feature];
  }

  /**
   * Check if running in production
   */
  public isProduction(): boolean {
    return this.config.service.env === 'production';
  }

  /**
   * Check if running in development
   */
  public isDevelopment(): boolean {
    return this.config.service.env === 'development';
  }

  /**
   * Check if running in test mode
   */
  public isTest(): boolean {
    return this.config.service.env === 'test';
  }

  /**
   * Get configuration summary for logging
   */
  public getSummary(): Record<string, any> {
    return {
      service: {
        name: this.config.service.name,
        port: this.config.service.port,
        env: this.config.service.env,
        version: this.config.service.version,
      },
      invoice: {
        defaultCurrency: this.config.invoice.defaultCurrency,
        defaultDueDays: this.config.invoice.defaultDueDays,
      },
      subscription: {
        defaultBillingCycle: this.config.subscription.defaultBillingCycle,
        trialPeriodDays: this.config.subscription.trialPeriodDays,
      },
      payment: {
        defaultProvider: this.config.payment.defaultProvider,
        stripeEnabled: this.config.payment.providers.stripe.enabled,
      },
      features: this.config.features,
      validated: this.validated,
    };
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const billingConfig = BillingConfiguration.getInstance();

// Export class for testing purposes
export { BillingConfiguration };
