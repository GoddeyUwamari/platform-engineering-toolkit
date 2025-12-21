"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
exports.createRequestLogger = createRequestLogger;
exports.createServiceRequestLogger = createServiceRequestLogger;
exports.correlationIdMiddleware = correlationIdMiddleware;
const logger_1 = require("../utils/logger");
const defaultOptions = {
    serviceName: 'app',
    logRequestBody: false,
    logResponseBody: false,
    skipPaths: [],
    successLogLevel: 'http',
    correlationIdHeader: 'X-Correlation-ID',
};
function createRequestLogger(options = {}) {
    const config = { ...defaultOptions, ...options };
    return (req, res, next) => {
        if (config.skipPaths && config.skipPaths.includes(req.path)) {
            return next();
        }
        const correlationId = req.headers[config.correlationIdHeader.toLowerCase()] ||
            (0, logger_1.generateCorrelationId)();
        req.correlationId = correlationId;
        req.startTime = Date.now();
        res.setHeader(config.correlationIdHeader, correlationId);
        const requestMetadata = {
            service: config.serviceName,
            correlationId,
            method: req.method,
            path: req.path,
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.get('user-agent'),
        };
        if (req.tenantId) {
            requestMetadata.tenantId = req.tenantId;
        }
        if (req.user) {
            requestMetadata.userId = req.user.userId || req.user.id;
        }
        if (config.logRequestBody && req.body) {
            requestMetadata.requestBody = req.body;
        }
        logger_1.logger.http('Incoming request', requestMetadata);
        const originalSend = res.send;
        let responseBody;
        if (config.logResponseBody) {
            res.send = function (body) {
                responseBody = body;
                res.send = originalSend;
                return res.send(body);
            };
        }
        res.on('finish', () => {
            const duration = req.startTime ? Date.now() - req.startTime : 0;
            const statusCode = res.statusCode;
            const responseMetadata = {
                service: config.serviceName,
                correlationId,
                method: req.method,
                path: req.path,
                statusCode,
                duration,
            };
            if (req.tenantId) {
                responseMetadata.tenantId = req.tenantId;
            }
            if (req.user) {
                responseMetadata.userId = req.user.userId || req.user.id;
            }
            if (config.logResponseBody && responseBody) {
                responseMetadata.responseBody = responseBody;
            }
            if (statusCode >= 500) {
                logger_1.logger.error('Request failed with server error', responseMetadata);
            }
            else if (statusCode >= 400) {
                logger_1.logger.warn('Request failed with client error', responseMetadata);
            }
            else {
                const logLevel = config.successLogLevel || 'http';
                logger_1.logger[logLevel]('Request completed successfully', responseMetadata);
            }
        });
        res.on('error', (error) => {
            logger_1.logger.error('Response error', {
                service: config.serviceName,
                correlationId,
                method: req.method,
                path: req.path,
                error,
            });
        });
        next();
    };
}
exports.requestLogger = createRequestLogger();
function createServiceRequestLogger(serviceName, options) {
    return createRequestLogger({
        ...options,
        serviceName,
    });
}
function correlationIdMiddleware(req, res, next) {
    const correlationId = req.headers['x-correlation-id'] ||
        req.headers['x-request-id'] ||
        (0, logger_1.generateCorrelationId)();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
}
exports.default = exports.requestLogger;
//# sourceMappingURL=request-logger.middleware.js.map