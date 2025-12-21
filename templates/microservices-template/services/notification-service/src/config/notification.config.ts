import { logger } from '@shared/utils/logger';

/**
 * Notification Service Configuration
 * Manages notification providers, rate limiting, and delivery settings
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface NotificationConfig {
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

  // Email Configuration
  email: {
    enabled: boolean;
    provider: 'smtp' | 'sendgrid' | 'ses';
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: {
      name: string;
      address: string;
    };
    replyTo?: string;
    maxRetries: number;
    retryDelay: number; // in milliseconds
    rateLimit: {
      maxPerMinute: number;
      maxPerHour: number;
    };
  };

  // SMS Configuration
  sms: {
    enabled: boolean;
    provider: 'twilio' | 'sns' | 'nexmo';
    twilio: {
      accountSid: string;
      authToken: string;
      fromNumber: string;
    };
    maxRetries: number;
    retryDelay: number;
    rateLimit: {
      maxPerMinute: number;
      maxPerHour: number;
    };
  };

  // Webhook Configuration
  webhook: {
    enabled: boolean;
    timeout: number; // in milliseconds
    maxRetries: number;
    retryDelay: number;
    retryBackoffMultiplier: number;
    verifySSL: boolean;
    followRedirects: boolean;
    maxRedirects: number;
  };

  // Template Configuration
  template: {
    cacheEnabled: boolean;
    cacheTTL: number; // in seconds
    variablePattern: RegExp;
    maxVariables: number;
    defaultLanguage: string;
    supportedLanguages: string[];
  };

  // Queue Configuration
  queue: {
    enabled: boolean;
    provider: 'redis' | 'kafka';
    processInterval: number; // in milliseconds
    batchSize: number;
    maxConcurrent: number;
  };

  // Notification History
  history: {
    enabled: boolean;
    retentionDays: number;
    storeContent: boolean;
    storeMetadata: boolean;
  };

  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    enabled: boolean;
  };

  // Feature Flags
  features: {
    enableEmailNotifications: boolean;
    enableSMSNotifications: boolean;
    enableWebhookNotifications: boolean;
    enableTemplateEngine: boolean;
    enableNotificationHistory: boolean;
    enableRetryMechanism: boolean;
    enableBatchProcessing: boolean;
  };
}

// ============================================================================
// Configuration Class
// ============================================================================

class NotificationConfiguration {
  private static instance: NotificationConfiguration;
  private config: NotificationConfig;
  private validated = false;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  /**
   * Singleton pattern to ensure single configuration instance
   */
  public static getInstance(): NotificationConfiguration {
    if (!NotificationConfiguration.instance) {
      NotificationConfiguration.instance = new NotificationConfiguration();
    }
    return NotificationConfiguration.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): NotificationConfig {
    return {
      service: {
        name: process.env.SERVICE_NAME || 'notification-service',
        port: parseInt(process.env.NOTIFICATION_SERVICE_PORT || process.env.PORT || '3004', 10),
        env: process.env.NODE_ENV || 'development',
        version: process.env.SERVICE_VERSION || '1.0.0',
      },

      server: {
        port: parseInt(process.env.NOTIFICATION_SERVICE_PORT || process.env.PORT || '3004', 10),
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        bodyLimit: process.env.BODY_LIMIT || '10mb',
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
      },

      email: {
        enabled: process.env.EMAIL_ENABLED !== 'false',
        provider: (process.env.EMAIL_PROVIDER as 'smtp' | 'sendgrid' | 'ses') || 'smtp',
        smtp: {
          host: process.env.SMTP_HOST || 'localhost',
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
          },
        },
        from: {
          name: process.env.EMAIL_FROM_NAME || 'CloudBill',
          address: process.env.EMAIL_FROM_ADDRESS || 'noreply@cloudbill.com',
        },
        replyTo: process.env.EMAIL_REPLY_TO,
        maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || '3', 10),
        retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '5000', 10),
        rateLimit: {
          maxPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT_MINUTE || '60', 10),
          maxPerHour: parseInt(process.env.EMAIL_RATE_LIMIT_HOUR || '1000', 10),
        },
      },

      sms: {
        enabled: process.env.SMS_ENABLED === 'true',
        provider: (process.env.SMS_PROVIDER as 'twilio' | 'sns' | 'nexmo') || 'twilio',
        twilio: {
          accountSid: process.env.TWILIO_ACCOUNT_SID || '',
          authToken: process.env.TWILIO_AUTH_TOKEN || '',
          fromNumber: process.env.TWILIO_FROM_NUMBER || '',
        },
        maxRetries: parseInt(process.env.SMS_MAX_RETRIES || '3', 10),
        retryDelay: parseInt(process.env.SMS_RETRY_DELAY || '5000', 10),
        rateLimit: {
          maxPerMinute: parseInt(process.env.SMS_RATE_LIMIT_MINUTE || '30', 10),
          maxPerHour: parseInt(process.env.SMS_RATE_LIMIT_HOUR || '500', 10),
        },
      },

      webhook: {
        enabled: process.env.WEBHOOK_ENABLED !== 'false',
        timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '10000', 10),
        maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10),
        retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '2000', 10),
        retryBackoffMultiplier: parseFloat(process.env.WEBHOOK_BACKOFF_MULTIPLIER || '2'),
        verifySSL: process.env.WEBHOOK_VERIFY_SSL !== 'false',
        followRedirects: process.env.WEBHOOK_FOLLOW_REDIRECTS !== 'false',
        maxRedirects: parseInt(process.env.WEBHOOK_MAX_REDIRECTS || '5', 10),
      },

      template: {
        cacheEnabled: process.env.TEMPLATE_CACHE_ENABLED !== 'false',
        cacheTTL: parseInt(process.env.TEMPLATE_CACHE_TTL || '3600', 10),
        variablePattern: /\{\{(\w+)\}\}/g,
        maxVariables: parseInt(process.env.TEMPLATE_MAX_VARIABLES || '100', 10),
        defaultLanguage: process.env.TEMPLATE_DEFAULT_LANGUAGE || 'en',
        supportedLanguages: (process.env.TEMPLATE_SUPPORTED_LANGUAGES || 'en,es,fr').split(','),
      },

      queue: {
        enabled: process.env.QUEUE_ENABLED === 'true',
        provider: (process.env.QUEUE_PROVIDER as 'redis' | 'kafka') || 'redis',
        processInterval: parseInt(process.env.QUEUE_PROCESS_INTERVAL || '1000', 10),
        batchSize: parseInt(process.env.QUEUE_BATCH_SIZE || '50', 10),
        maxConcurrent: parseInt(process.env.QUEUE_MAX_CONCURRENT || '10', 10),
      },

      history: {
        enabled: process.env.HISTORY_ENABLED !== 'false',
        retentionDays: parseInt(process.env.HISTORY_RETENTION_DAYS || '90', 10),
        storeContent: process.env.HISTORY_STORE_CONTENT !== 'false',
        storeMetadata: process.env.HISTORY_STORE_METADATA !== 'false',
      },

      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      },

      features: {
        enableEmailNotifications: process.env.FEATURE_EMAIL !== 'false',
        enableSMSNotifications: process.env.FEATURE_SMS === 'true',
        enableWebhookNotifications: process.env.FEATURE_WEBHOOK !== 'false',
        enableTemplateEngine: process.env.FEATURE_TEMPLATES !== 'false',
        enableNotificationHistory: process.env.FEATURE_HISTORY !== 'false',
        enableRetryMechanism: process.env.FEATURE_RETRY !== 'false',
        enableBatchProcessing: process.env.FEATURE_BATCH === 'true',
      },
    };
  }

  /**
   * Validate configuration
   */
  public validate(): void {
    if (this.validated) {
      logger.debug('Configuration already validated', {
        service: 'notification-service',
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

    // Validate email configuration if enabled
    if (this.config.email.enabled) {
      if (this.config.email.provider === 'smtp') {
        if (!this.config.email.smtp.host) {
          logger.warn('SMTP host not configured - email service will be unavailable', {
            service: 'notification-service',
          });
        }
        if (!this.config.email.smtp.auth.user || !this.config.email.smtp.auth.pass) {
          logger.warn('SMTP credentials not configured - email service will be unavailable', {
            service: 'notification-service',
          });
        }
        if (this.config.email.smtp.port < 1 || this.config.email.smtp.port > 65535) {
          logger.warn('SMTP port invalid - email service may not work correctly', {
            service: 'notification-service',
            port: this.config.email.smtp.port,
          });
        }
      }

      if (!this.config.email.from.address) {
        logger.warn('Email from address not configured - using default', {
          service: 'notification-service',
          default: this.config.email.from.address,
        });
      }

      // Email address validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (this.config.email.from.address && !emailRegex.test(this.config.email.from.address)) {
        logger.warn('Email from address format may be invalid', {
          service: 'notification-service',
          address: this.config.email.from.address,
        });
      }
    }

    // Validate SMS configuration if enabled
    if (this.config.sms.enabled) {
      if (this.config.sms.provider === 'twilio') {
        if (!this.config.sms.twilio.accountSid) {
          errors.push('Twilio Account SID is required when SMS is enabled');
        }
        if (!this.config.sms.twilio.authToken) {
          errors.push('Twilio Auth Token is required when SMS is enabled');
        }
        if (!this.config.sms.twilio.fromNumber) {
          errors.push('Twilio from number is required when SMS is enabled');
        }
      }
    }

    // Validate webhook configuration
    if (this.config.webhook.timeout < 1000 || this.config.webhook.timeout > 60000) {
      logger.warn('Webhook timeout should be between 1s and 60s', {
        timeout: this.config.webhook.timeout,
      });
    }

    if (this.config.webhook.maxRetries < 0 || this.config.webhook.maxRetries > 10) {
      errors.push('Webhook max retries must be between 0 and 10');
    }

    // Validate template configuration
    if (this.config.template.cacheTTL < 0) {
      errors.push('Template cache TTL must be non-negative');
    }

    if (this.config.template.maxVariables < 1) {
      errors.push('Template max variables must be at least 1');
    }

    // Validate history configuration
    if (this.config.history.retentionDays < 1) {
      errors.push('History retention days must be at least 1');
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
      logger.error('Notification configuration validation failed', {
        service: 'notification-service',
        errors,
      });
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    this.validated = true;
    logger.info('Notification configuration validated successfully', {
      service: 'notification-service',
      port: this.config.service.port,
      env: this.config.service.env,
      features: this.config.features,
    });
  }

  /**
   * Get the full configuration
   */
  public getConfig(): Readonly<NotificationConfig> {
    if (!this.validated) {
      this.validate();
    }
    return this.config;
  }

  /**
   * Get service configuration
   */
  public getServiceConfig(): Readonly<NotificationConfig['service']> {
    return this.config.service;
  }

  /**
   * Get email configuration
   */
  public getEmailConfig(): Readonly<NotificationConfig['email']> {
    return this.config.email;
  }

  /**
   * Get SMS configuration
   */
  public getSMSConfig(): Readonly<NotificationConfig['sms']> {
    return this.config.sms;
  }

  /**
   * Get webhook configuration
   */
  public getWebhookConfig(): Readonly<NotificationConfig['webhook']> {
    return this.config.webhook;
  }

  /**
   * Get template configuration
   */
  public getTemplateConfig(): Readonly<NotificationConfig['template']> {
    return this.config.template;
  }

  /**
   * Get queue configuration
   */
  public getQueueConfig(): Readonly<NotificationConfig['queue']> {
    return this.config.queue;
  }

  /**
   * Get history configuration
   */
  public getHistoryConfig(): Readonly<NotificationConfig['history']> {
    return this.config.history;
  }

  /**
   * Get rate limit configuration
   */
  public getRateLimitConfig(): Readonly<NotificationConfig['rateLimit']> {
    return this.config.rateLimit;
  }

  /**
   * Get feature flags
   */
  public getFeatures(): Readonly<NotificationConfig['features']> {
    return this.config.features;
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(feature: keyof NotificationConfig['features']): boolean {
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
      email: {
        enabled: this.config.email.enabled,
        provider: this.config.email.provider,
        from: this.config.email.from.address,
      },
      sms: {
        enabled: this.config.sms.enabled,
        provider: this.config.sms.provider,
      },
      webhook: {
        enabled: this.config.webhook.enabled,
        timeout: this.config.webhook.timeout,
      },
      features: this.config.features,
      validated: this.validated,
    };
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const notificationConfig = NotificationConfiguration.getInstance();

// Export class for testing purposes
export { NotificationConfiguration };
