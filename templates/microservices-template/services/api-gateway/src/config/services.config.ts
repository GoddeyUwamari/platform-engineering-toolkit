// services/api-gateway/src/config/services.config.ts
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service Registry Configuration
 * 
 * Centralized configuration for all microservices
 * Each service has a base URL that can be configured via environment variables
 * 
 * Environment Variables:
 * - AUTH_SERVICE_URL: Auth service base URL (default: http://localhost:3001)
 * - BILLING_SERVICE_URL: Billing service base URL (default: http://localhost:3002)
 * - PAYMENT_SERVICE_URL: Payment service base URL (default: http://localhost:3003)
 * - NOTIFICATION_SERVICE_URL: Notification service base URL (default: http://localhost:3004)
 * - ANALYTICS_SERVICE_URL: Analytics service base URL (default: http://localhost:3005)
 */

interface ServiceConfig {
  AUTH_SERVICE: string;
  BILLING_SERVICE: string;
  PAYMENT_SERVICE: string;
  NOTIFICATION_SERVICE: string;
  ANALYTICS_SERVICE: string;
}

export const SERVICES: ServiceConfig = {
  // Auth Service - User authentication and authorization
  AUTH_SERVICE: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  
  // Billing Service - Subscription management, invoicing, usage tracking
  BILLING_SERVICE: process.env.BILLING_SERVICE_URL || 'http://localhost:3002',
  
  // Payment Service - Payment processing, Stripe integration
  PAYMENT_SERVICE: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
  
  // Notification Service - Email, SMS, webhooks, push notifications
  NOTIFICATION_SERVICE: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
  
  // Analytics Service - Usage analytics, reporting, metrics
  ANALYTICS_SERVICE: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3005',
};

/**
 * Service metadata for documentation and monitoring
 */
export const SERVICE_METADATA = {
  'auth-service': {
    name: 'Authentication Service',
    description: 'Handles user authentication, authorization, and JWT token management',
    url: SERVICES.AUTH_SERVICE,
    port: 3001,
    status: 'active',
    version: '1.0.0',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/refresh',
      'POST /api/auth/logout',
      'GET /api/auth/me',
      'PATCH /api/auth/profile',
      'POST /api/auth/change-password',
      'POST /api/auth/verify-email',
      'POST /api/auth/forgot-password',
      'POST /api/auth/reset-password',
    ],
  },
  'billing-service': {
    name: 'Billing Service',
    description: 'Manages subscriptions, invoices, and usage-based billing',
    url: SERVICES.BILLING_SERVICE,
    port: 3002,
    status: 'pending',
    version: '0.0.0',
    endpoints: [
      'GET /api/billing/subscriptions',
      'POST /api/billing/subscriptions',
      'GET /api/billing/invoices',
      'GET /api/billing/usage',
      'POST /api/billing/plans',
    ],
  },
  'payment-service': {
    name: 'Payment Service',
    description: 'Processes payments and integrates with payment gateways (Stripe)',
    url: SERVICES.PAYMENT_SERVICE,
    port: 3003,
    status: 'pending',
    version: '0.0.0',
    endpoints: [
      'POST /api/payment/checkout',
      'POST /api/payment/webhook',
      'GET /api/payment/methods',
      'POST /api/payment/methods',
      'DELETE /api/payment/methods/:id',
    ],
  },
  'notification-service': {
    name: 'Notification Service',
    description: 'Sends emails, SMS, webhooks, and push notifications',
    url: SERVICES.NOTIFICATION_SERVICE,
    port: 3004,
    status: 'pending',
    version: '0.0.0',
    endpoints: [
      'POST /api/notification/email',
      'POST /api/notification/sms',
      'POST /api/notification/webhook',
      'GET /api/notification/templates',
      'POST /api/notification/templates',
    ],
  },
  'analytics-service': {
    name: 'Analytics Service',
    description: 'Provides usage analytics, reports, and business metrics',
    url: SERVICES.ANALYTICS_SERVICE,
    port: 3005,
    status: 'pending',
    version: '0.0.0',
    endpoints: [
      'GET /api/analytics/dashboard',
      'GET /api/analytics/usage',
      'GET /api/analytics/revenue',
      'GET /api/analytics/users',
      'POST /api/analytics/events',
    ],
  },
};

/**
 * Get all active services
 */
export const getActiveServices = (): string[] => {
  return Object.entries(SERVICE_METADATA)
    .filter(([_, metadata]) => metadata.status === 'active')
    .map(([key]) => key);
};

/**
 * Get service URL by name
 */
export const getServiceUrl = (serviceName: string): string | undefined => {
  const serviceKey = serviceName.toUpperCase().replace('-', '_');
  return SERVICES[serviceKey as keyof ServiceConfig];
};

/**
 * Validate that all required environment variables are set
 */
export const validateServiceConfig = (): void => {
  const requiredServices = ['AUTH_SERVICE'];
  const missingServices: string[] = [];
  
  requiredServices.forEach((service) => {
    if (!SERVICES[service as keyof ServiceConfig]) {
      missingServices.push(service);
    }
  });
  
  if (missingServices.length > 0) {
    throw new Error(
      `Missing required service URLs: ${missingServices.join(', ')}\n` +
      'Please set the following environment variables:\n' +
      missingServices.map((s) => `- ${s}_URL`).join('\n')
    );
  }
};

/**
 * Log service configuration on startup
 */
export const logServiceConfiguration = (): void => {
  console.log('\n📡 Service Registry Configuration:');
  console.log('═══════════════════════════════════════════');
  
Object.entries(SERVICE_METADATA).forEach(([_key, metadata]) => {
    const statusEmoji = metadata.status === 'active' ? '✅' : '⏳';
    console.log(`${statusEmoji} ${metadata.name}`);
    console.log(`   URL: ${metadata.url}`);
    console.log(`   Status: ${metadata.status}`);
    console.log(`   Version: ${metadata.version}`);
    console.log('');
  });
  
  console.log('═══════════════════════════════════════════\n');
};

// Validate configuration on import
try {
  validateServiceConfig();
} catch (error) {
  console.error('❌ Service configuration error:', (error as Error).message);
  // Don't exit in development, allow gateway to start
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}