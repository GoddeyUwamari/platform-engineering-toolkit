"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMetricsRegistry = createMetricsRegistry;
exports.createHttpRequestCounter = createHttpRequestCounter;
exports.createHttpRequestDuration = createHttpRequestDuration;
exports.createActiveConnectionsGauge = createActiveConnectionsGauge;
exports.createDbQueryDuration = createDbQueryDuration;
exports.createDbQueryCounter = createDbQueryCounter;
exports.createDbConnectionsGauge = createDbConnectionsGauge;
exports.createRedisOperationDuration = createRedisOperationDuration;
exports.createRedisOperationCounter = createRedisOperationCounter;
exports.createActiveSubscriptionsGauge = createActiveSubscriptionsGauge;
exports.createInvoiceCounter = createInvoiceCounter;
exports.createInvoiceAmountHistogram = createInvoiceAmountHistogram;
exports.createPaymentCounter = createPaymentCounter;
exports.createPaymentAmountHistogram = createPaymentAmountHistogram;
exports.createRefundCounter = createRefundCounter;
exports.createLoginCounter = createLoginCounter;
exports.createTokenCounter = createTokenCounter;
exports.createActiveSessionsGauge = createActiveSessionsGauge;
exports.createEmailCounter = createEmailCounter;
exports.createSmsCounter = createSmsCounter;
exports.createWebhookCounter = createWebhookCounter;
exports.createWebhookDuration = createWebhookDuration;
exports.initializeMetrics = initializeMetrics;
exports.getMetrics = getMetrics;
exports.getMetricsContentType = getMetricsContentType;
exports.normalizeRoutePath = normalizeRoutePath;
exports.recordHttpMetrics = recordHttpMetrics;
exports.recordDbMetrics = recordDbMetrics;
exports.recordRedisMetrics = recordRedisMetrics;
const prom_client_1 = require("prom-client");
function createMetricsRegistry(serviceName) {
    const register = new prom_client_1.Registry();
    register.setDefaultLabels({
        service: serviceName,
        environment: process.env.NODE_ENV || 'development',
    });
    (0, prom_client_1.collectDefaultMetrics)({
        register,
        prefix: 'cloudbill_',
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });
    return register;
}
function createHttpRequestCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code', 'tenant_id'],
        registers: [register],
    });
}
function createHttpRequestDuration(register) {
    return new prom_client_1.Histogram({
        name: 'cloudbill_http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code', 'tenant_id'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
        registers: [register],
    });
}
function createActiveConnectionsGauge(register) {
    return new prom_client_1.Gauge({
        name: 'cloudbill_http_active_connections',
        help: 'Number of active HTTP connections',
        labelNames: ['service'],
        registers: [register],
    });
}
function createDbQueryDuration(register) {
    return new prom_client_1.Histogram({
        name: 'cloudbill_db_query_duration_seconds',
        help: 'Duration of database queries in seconds',
        labelNames: ['operation', 'table', 'tenant_id'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
        registers: [register],
    });
}
function createDbQueryCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_db_queries_total',
        help: 'Total number of database queries',
        labelNames: ['operation', 'table', 'status', 'tenant_id'],
        registers: [register],
    });
}
function createDbConnectionsGauge(register) {
    return new prom_client_1.Gauge({
        name: 'cloudbill_db_connections_active',
        help: 'Number of active database connections',
        labelNames: ['pool'],
        registers: [register],
    });
}
function createRedisOperationDuration(register) {
    return new prom_client_1.Histogram({
        name: 'cloudbill_redis_operation_duration_seconds',
        help: 'Duration of Redis operations in seconds',
        labelNames: ['operation', 'status'],
        buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
        registers: [register],
    });
}
function createRedisOperationCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_redis_operations_total',
        help: 'Total number of Redis operations',
        labelNames: ['operation', 'status'],
        registers: [register],
    });
}
function createActiveSubscriptionsGauge(register) {
    return new prom_client_1.Gauge({
        name: 'cloudbill_subscriptions_active',
        help: 'Number of active subscriptions',
        labelNames: ['plan_id', 'tenant_id'],
        registers: [register],
    });
}
function createInvoiceCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_invoices_total',
        help: 'Total number of invoices generated',
        labelNames: ['status', 'tenant_id'],
        registers: [register],
    });
}
function createInvoiceAmountHistogram(register) {
    return new prom_client_1.Histogram({
        name: 'cloudbill_invoice_amount_dollars',
        help: 'Invoice amounts in dollars',
        labelNames: ['status', 'tenant_id'],
        buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000],
        registers: [register],
    });
}
function createPaymentCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_payments_total',
        help: 'Total number of payment attempts',
        labelNames: ['status', 'payment_method', 'tenant_id'],
        registers: [register],
    });
}
function createPaymentAmountHistogram(register) {
    return new prom_client_1.Histogram({
        name: 'cloudbill_payment_amount_dollars',
        help: 'Payment amounts in dollars',
        labelNames: ['status', 'payment_method', 'tenant_id'],
        buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000],
        registers: [register],
    });
}
function createRefundCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_refunds_total',
        help: 'Total number of refunds processed',
        labelNames: ['reason', 'tenant_id'],
        registers: [register],
    });
}
function createLoginCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_login_attempts_total',
        help: 'Total number of login attempts',
        labelNames: ['status', 'method', 'tenant_id'],
        registers: [register],
    });
}
function createTokenCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_tokens_generated_total',
        help: 'Total number of tokens generated',
        labelNames: ['type', 'tenant_id'],
        registers: [register],
    });
}
function createActiveSessionsGauge(register) {
    return new prom_client_1.Gauge({
        name: 'cloudbill_sessions_active',
        help: 'Number of active user sessions',
        labelNames: ['tenant_id'],
        registers: [register],
    });
}
function createEmailCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_emails_total',
        help: 'Total number of email notifications sent',
        labelNames: ['status', 'type', 'tenant_id'],
        registers: [register],
    });
}
function createSmsCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_sms_total',
        help: 'Total number of SMS notifications sent',
        labelNames: ['status', 'tenant_id'],
        registers: [register],
    });
}
function createWebhookCounter(register) {
    return new prom_client_1.Counter({
        name: 'cloudbill_webhooks_total',
        help: 'Total number of webhook deliveries',
        labelNames: ['status', 'event_type', 'tenant_id'],
        registers: [register],
    });
}
function createWebhookDuration(register) {
    return new prom_client_1.Histogram({
        name: 'cloudbill_webhook_delivery_duration_seconds',
        help: 'Duration of webhook delivery in seconds',
        labelNames: ['status', 'event_type', 'tenant_id'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
        registers: [register],
    });
}
function initializeMetrics(serviceName) {
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
async function getMetrics(register) {
    return register.metrics();
}
function getMetricsContentType(register) {
    return register.contentType;
}
function normalizeRoutePath(path) {
    return path
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
        .replace(/\/\d+/g, '/:id')
        .replace(/\/[a-z0-9]{20,}/gi, '/:id');
}
function recordHttpMetrics(metrics, method, route, statusCode, duration, tenantId) {
    const normalizedRoute = normalizeRoutePath(route);
    const labels = {
        method: method.toUpperCase(),
        route: normalizedRoute,
        status_code: statusCode.toString(),
        tenant_id: tenantId || 'unknown',
    };
    metrics.httpRequestCounter.inc(labels);
    metrics.httpRequestDuration.observe(labels, duration / 1000);
}
function recordDbMetrics(metrics, operation, table, duration, success, tenantId) {
    if (!metrics.dbQueryDuration || !metrics.dbQueryCounter)
        return;
    const durationLabels = {
        operation: operation.toUpperCase(),
        table,
        tenant_id: tenantId || 'unknown',
    };
    const counterLabels = {
        ...durationLabels,
        status: success ? 'success' : 'error',
    };
    metrics.dbQueryDuration.observe(durationLabels, duration / 1000);
    metrics.dbQueryCounter.inc(counterLabels);
}
function recordRedisMetrics(metrics, operation, duration, success) {
    if (!metrics.redisOperationDuration || !metrics.redisOperationCounter)
        return;
    const labels = {
        operation: operation.toUpperCase(),
        status: success ? 'success' : 'error',
    };
    metrics.redisOperationDuration.observe(labels, duration / 1000);
    metrics.redisOperationCounter.inc(labels);
}
exports.default = {
    initializeMetrics,
    getMetrics,
    getMetricsContentType,
    normalizeRoutePath,
    recordHttpMetrics,
    recordDbMetrics,
    recordRedisMetrics,
};
//# sourceMappingURL=metrics.js.map