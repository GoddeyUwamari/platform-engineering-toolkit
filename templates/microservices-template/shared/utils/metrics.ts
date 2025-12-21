import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Production-Grade Metrics Collection with Prometheus
 *
 * Features:
 * - HTTP request metrics (count, duration, status codes)
 * - System metrics (CPU, memory, event loop lag)
 * - Database query metrics
 * - Redis operation metrics
 * - Business-specific metrics
 * - Multi-tenant metrics tracking
 */

// ============================================================================
// Registry Configuration
// ============================================================================

/**
 * Create a new Prometheus registry
 * Each service should create its own registry instance
 */
export function createMetricsRegistry(serviceName: string): Registry {
  const register = new Registry();

  // Set default labels for all metrics
  register.setDefaultLabels({
    service: serviceName,
    environment: process.env.NODE_ENV || 'development',
  });

  // Collect default system metrics (CPU, memory, event loop, etc.)
  collectDefaultMetrics({
    register,
    prefix: 'cloudbill_',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  });

  return register;
}

// ============================================================================
// HTTP Metrics
// ============================================================================

/**
 * Counter for total HTTP requests
 */
export function createHttpRequestCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'tenant_id'],
    registers: [register],
  });
}

/**
 * Histogram for HTTP request duration
 */
export function createHttpRequestDuration(register: Registry): Histogram<string> {
  return new Histogram({
    name: 'cloudbill_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code', 'tenant_id'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10], // 1ms to 10s
    registers: [register],
  });
}

/**
 * Gauge for active HTTP connections
 */
export function createActiveConnectionsGauge(register: Registry): Gauge<string> {
  return new Gauge({
    name: 'cloudbill_http_active_connections',
    help: 'Number of active HTTP connections',
    labelNames: ['service'],
    registers: [register],
  });
}

// ============================================================================
// Database Metrics
// ============================================================================

/**
 * Histogram for database query duration
 */
export function createDbQueryDuration(register: Registry): Histogram<string> {
  return new Histogram({
    name: 'cloudbill_db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table', 'tenant_id'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5], // 1ms to 5s
    registers: [register],
  });
}

/**
 * Counter for database queries
 */
export function createDbQueryCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_db_queries_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'table', 'status', 'tenant_id'],
    registers: [register],
  });
}

/**
 * Gauge for active database connections
 */
export function createDbConnectionsGauge(register: Registry): Gauge<string> {
  return new Gauge({
    name: 'cloudbill_db_connections_active',
    help: 'Number of active database connections',
    labelNames: ['pool'],
    registers: [register],
  });
}

// ============================================================================
// Redis Metrics
// ============================================================================

/**
 * Histogram for Redis operation duration
 */
export function createRedisOperationDuration(register: Registry): Histogram<string> {
  return new Histogram({
    name: 'cloudbill_redis_operation_duration_seconds',
    help: 'Duration of Redis operations in seconds',
    labelNames: ['operation', 'status'],
    buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1], // 0.1ms to 1s
    registers: [register],
  });
}

/**
 * Counter for Redis operations
 */
export function createRedisOperationCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_redis_operations_total',
    help: 'Total number of Redis operations',
    labelNames: ['operation', 'status'],
    registers: [register],
  });
}

// ============================================================================
// Business Metrics - Billing Service
// ============================================================================

/**
 * Gauge for active subscriptions
 */
export function createActiveSubscriptionsGauge(register: Registry): Gauge<string> {
  return new Gauge({
    name: 'cloudbill_subscriptions_active',
    help: 'Number of active subscriptions',
    labelNames: ['plan_id', 'tenant_id'],
    registers: [register],
  });
}

/**
 * Counter for invoice generation
 */
export function createInvoiceCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_invoices_total',
    help: 'Total number of invoices generated',
    labelNames: ['status', 'tenant_id'],
    registers: [register],
  });
}

/**
 * Histogram for invoice amount
 */
export function createInvoiceAmountHistogram(register: Registry): Histogram<string> {
  return new Histogram({
    name: 'cloudbill_invoice_amount_dollars',
    help: 'Invoice amounts in dollars',
    labelNames: ['status', 'tenant_id'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000],
    registers: [register],
  });
}

// ============================================================================
// Business Metrics - Payment Service
// ============================================================================

/**
 * Counter for payment attempts
 */
export function createPaymentCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_payments_total',
    help: 'Total number of payment attempts',
    labelNames: ['status', 'payment_method', 'tenant_id'],
    registers: [register],
  });
}

/**
 * Histogram for payment amount
 */
export function createPaymentAmountHistogram(register: Registry): Histogram<string> {
  return new Histogram({
    name: 'cloudbill_payment_amount_dollars',
    help: 'Payment amounts in dollars',
    labelNames: ['status', 'payment_method', 'tenant_id'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000],
    registers: [register],
  });
}

/**
 * Counter for refunds
 */
export function createRefundCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_refunds_total',
    help: 'Total number of refunds processed',
    labelNames: ['reason', 'tenant_id'],
    registers: [register],
  });
}

// ============================================================================
// Business Metrics - Auth Service
// ============================================================================

/**
 * Counter for login attempts
 */
export function createLoginCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_login_attempts_total',
    help: 'Total number of login attempts',
    labelNames: ['status', 'method', 'tenant_id'],
    registers: [register],
  });
}

/**
 * Counter for token generation
 */
export function createTokenCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_tokens_generated_total',
    help: 'Total number of tokens generated',
    labelNames: ['type', 'tenant_id'],
    registers: [register],
  });
}

/**
 * Gauge for active sessions
 */
export function createActiveSessionsGauge(register: Registry): Gauge<string> {
  return new Gauge({
    name: 'cloudbill_sessions_active',
    help: 'Number of active user sessions',
    labelNames: ['tenant_id'],
    registers: [register],
  });
}

// ============================================================================
// Business Metrics - Notification Service
// ============================================================================

/**
 * Counter for email notifications
 */
export function createEmailCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_emails_total',
    help: 'Total number of email notifications sent',
    labelNames: ['status', 'type', 'tenant_id'],
    registers: [register],
  });
}

/**
 * Counter for SMS notifications
 */
export function createSmsCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_sms_total',
    help: 'Total number of SMS notifications sent',
    labelNames: ['status', 'tenant_id'],
    registers: [register],
  });
}

/**
 * Counter for webhook deliveries
 */
export function createWebhookCounter(register: Registry): Counter<string> {
  return new Counter({
    name: 'cloudbill_webhooks_total',
    help: 'Total number of webhook deliveries',
    labelNames: ['status', 'event_type', 'tenant_id'],
    registers: [register],
  });
}

/**
 * Histogram for webhook delivery time
 */
export function createWebhookDuration(register: Registry): Histogram<string> {
  return new Histogram({
    name: 'cloudbill_webhook_delivery_duration_seconds',
    help: 'Duration of webhook delivery in seconds',
    labelNames: ['status', 'event_type', 'tenant_id'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30], // 100ms to 30s
    registers: [register],
  });
}

// ============================================================================
// Metrics Container
// ============================================================================

/**
 * Interface for service metrics
 */
export interface ServiceMetrics {
  serviceName: string;
  register: Registry;
  httpRequestCounter: Counter<string>;
  httpRequestDuration: Histogram<string>;
  activeConnections: Gauge<string>;
  dbQueryDuration?: Histogram<string>;
  dbQueryCounter?: Counter<string>;
  dbConnections?: Gauge<string>;
  redisOperationDuration?: Histogram<string>;
  redisOperationCounter?: Counter<string>;
}

/**
 * Initialize standard metrics for a service
 */
export function initializeMetrics(serviceName: string): ServiceMetrics {
  const register = createMetricsRegistry(serviceName);

  return {
    serviceName,
    register,
    httpRequestCounter: createHttpRequestCounter(register),
    httpRequestDuration: createHttpRequestDuration(register),
    activeConnections: createActiveConnectionsGauge(register),
    dbQueryDuration: createDbQueryDuration(register),
    dbQueryCounter: createDbQueryCounter(register),
    dbConnections: createDbConnectionsGauge(register),
    redisOperationDuration: createRedisOperationDuration(register),
    redisOperationCounter: createRedisOperationCounter(register),
  };
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(register: Registry): Promise<string> {
  return register.metrics();
}

/**
 * Get content type for Prometheus metrics
 */
export function getMetricsContentType(register: Registry): string {
  return register.contentType;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize route path for metrics (remove IDs)
 * Example: /users/123 -> /users/:id
 */
export function normalizeRoutePath(path: string): string {
  return path
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Replace other potential ID patterns
    .replace(/\/[a-z0-9]{20,}/gi, '/:id');
}

/**
 * Record HTTP request metrics
 */
export function recordHttpMetrics(
  metrics: ServiceMetrics,
  method: string,
  route: string,
  statusCode: number,
  duration: number,
  tenantId?: string
): void {
  const normalizedRoute = normalizeRoutePath(route);
  const labels = {
    method: method.toUpperCase(),
    route: normalizedRoute,
    status_code: statusCode.toString(),
    tenant_id: tenantId || 'unknown',
  };

  // Increment request counter
  metrics.httpRequestCounter.inc(labels);

  // Record request duration
  metrics.httpRequestDuration.observe(labels, duration / 1000); // Convert ms to seconds
}

/**
 * Record database query metrics
 */
export function recordDbMetrics(
  metrics: ServiceMetrics,
  operation: string,
  table: string,
  duration: number,
  success: boolean,
  tenantId?: string
): void {
  if (!metrics.dbQueryDuration || !metrics.dbQueryCounter) return;

  const durationLabels = {
    operation: operation.toUpperCase(),
    table,
    tenant_id: tenantId || 'unknown',
  };

  const counterLabels = {
    ...durationLabels,
    status: success ? 'success' : 'error',
  };

  // Record query duration
  metrics.dbQueryDuration.observe(durationLabels, duration / 1000); // Convert ms to seconds

  // Increment query counter
  metrics.dbQueryCounter.inc(counterLabels);
}

/**
 * Record Redis operation metrics
 */
export function recordRedisMetrics(
  metrics: ServiceMetrics,
  operation: string,
  duration: number,
  success: boolean
): void {
  if (!metrics.redisOperationDuration || !metrics.redisOperationCounter) return;

  const labels = {
    operation: operation.toUpperCase(),
    status: success ? 'success' : 'error',
  };

  // Record operation duration
  metrics.redisOperationDuration.observe(labels, duration / 1000); // Convert ms to seconds

  // Increment operation counter
  metrics.redisOperationCounter.inc(labels);
}

// ============================================================================
// Export
// ============================================================================

export default {
  initializeMetrics,
  getMetrics,
  getMetricsContentType,
  normalizeRoutePath,
  recordHttpMetrics,
  recordDbMetrics,
  recordRedisMetrics,
};
