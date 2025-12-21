"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMetricsMiddleware = createMetricsMiddleware;
exports.createMetricsEndpoint = createMetricsEndpoint;
exports.exposeMetrics = exposeMetrics;
const express_1 = require("express");
const metrics_1 = require("../utils/metrics");
const defaultOptions = {
    excludePaths: ['/metrics', '/health', '/health/live', '/health/ready'],
    includeTenantId: true,
};
function createMetricsMiddleware(metrics, options = {}) {
    const config = { ...defaultOptions, ...options };
    return (req, res, next) => {
        if (config.excludePaths?.some(path => req.path.startsWith(path))) {
            return next();
        }
        req.metricsStartTime = Date.now();
        metrics.activeConnections.inc({ service: metrics.serviceName });
        res.on('finish', () => {
            if (!req.metricsStartTime)
                return;
            const duration = Date.now() - req.metricsStartTime;
            const tenantId = config.includeTenantId ? req.tenantId : undefined;
            (0, metrics_1.recordHttpMetrics)(metrics, req.method, req.route?.path || req.path, res.statusCode, duration, tenantId);
            metrics.activeConnections.dec({ service: metrics.serviceName });
        });
        res.on('close', () => {
            if (req.metricsStartTime) {
                metrics.activeConnections.dec({ service: metrics.serviceName });
            }
        });
        next();
    };
}
function createMetricsEndpoint(metrics) {
    const router = (0, express_1.Router)();
    router.get('/metrics', async (_req, res) => {
        try {
            res.setHeader('Content-Type', (0, metrics_1.getMetricsContentType)(metrics.register));
            const metricsOutput = await (0, metrics_1.getMetrics)(metrics.register);
            res.send(metricsOutput);
        }
        catch (error) {
            console.error('Error generating metrics:', error);
            res.status(500).send('Error generating metrics');
        }
    });
    return router;
}
function exposeMetrics(metrics, path = '/metrics') {
    return async (req, res, next) => {
        if (req.path === path) {
            try {
                res.setHeader('Content-Type', (0, metrics_1.getMetricsContentType)(metrics.register));
                const metricsOutput = await (0, metrics_1.getMetrics)(metrics.register);
                res.send(metricsOutput);
            }
            catch (error) {
                console.error('Error generating metrics:', error);
                res.status(500).send('Error generating metrics');
            }
        }
        else {
            next();
        }
    };
}
exports.default = {
    createMetricsMiddleware,
    createMetricsEndpoint,
    exposeMetrics,
};
//# sourceMappingURL=metrics.middleware.js.map