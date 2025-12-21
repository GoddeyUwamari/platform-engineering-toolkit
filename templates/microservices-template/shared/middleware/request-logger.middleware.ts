import { Request, Response, NextFunction } from 'express';
import { logger, generateCorrelationId, LogMetadata } from '../utils/logger';

/**
 * Request Logger Middleware
 *
 * Automatically logs all HTTP requests with:
 * - Correlation ID for request tracing
 * - Request details (method, path, headers)
 * - Response details (status code, duration)
 * - User and tenant context
 * - Error handling
 */

// Extend Express Request to include correlation ID
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

/**
 * Request logger middleware options
 */
export interface RequestLoggerOptions {
  /**
   * Service name to include in logs
   */
  serviceName?: string;

  /**
   * Whether to log request body (default: false for security)
   */
  logRequestBody?: boolean;

  /**
   * Whether to log response body (default: false for performance)
   */
  logResponseBody?: boolean;

  /**
   * Paths to skip logging (e.g., health checks)
   */
  skipPaths?: string[];

  /**
   * Log level for successful requests (default: 'http')
   */
  successLogLevel?: 'debug' | 'http' | 'info';

  /**
   * Custom correlation ID header name (default: 'X-Correlation-ID')
   */
  correlationIdHeader?: string;
}

/**
 * Default options
 */
const defaultOptions: RequestLoggerOptions = {
  serviceName: 'app',
  logRequestBody: false,
  logResponseBody: false,
  skipPaths: [],
  successLogLevel: 'http',
  correlationIdHeader: 'X-Correlation-ID',
};

/**
 * Create request logger middleware
 * @param options - Middleware options
 */
export function createRequestLogger(options: RequestLoggerOptions = {}) {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip logging for specified paths
    if (config.skipPaths && config.skipPaths.includes(req.path)) {
      return next();
    }

    // Generate or extract correlation ID
    const correlationId =
      (req.headers[config.correlationIdHeader!.toLowerCase()] as string) ||
      generateCorrelationId();

    // Store correlation ID in request for downstream use
    req.correlationId = correlationId;
    req.startTime = Date.now();

    // Set correlation ID in response headers
    res.setHeader(config.correlationIdHeader!, correlationId);

    // Build request metadata
    const requestMetadata: LogMetadata = {
      service: config.serviceName,
      correlationId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    // Add tenant context if available
    if ((req as any).tenantId) {
      requestMetadata.tenantId = (req as any).tenantId;
    }

    // Add user context if available (from auth middleware)
    if ((req as any).user) {
      requestMetadata.userId = (req as any).user.userId || (req as any).user.id;
    }

    // Add request body if enabled (be careful with sensitive data)
    if (config.logRequestBody && req.body) {
      requestMetadata.requestBody = req.body;
    }

    // Log incoming request
    logger.http('Incoming request', requestMetadata);

    // Capture response finish event
    const originalSend = res.send;
    let responseBody: any;

    // Intercept res.send to capture response body if needed
    if (config.logResponseBody) {
      res.send = function (body: any): Response {
        responseBody = body;
        res.send = originalSend;
        return res.send(body);
      };
    }

    // Log response when finished
    res.on('finish', () => {
      const duration = req.startTime ? Date.now() - req.startTime : 0;
      const statusCode = res.statusCode;

      const responseMetadata: LogMetadata = {
        service: config.serviceName,
        correlationId,
        method: req.method,
        path: req.path,
        statusCode,
        duration,
      };

      // Add tenant and user context
      if ((req as any).tenantId) {
        responseMetadata.tenantId = (req as any).tenantId;
      }

      if ((req as any).user) {
        responseMetadata.userId = (req as any).user.userId || (req as any).user.id;
      }

      // Add response body if enabled
      if (config.logResponseBody && responseBody) {
        responseMetadata.responseBody = responseBody;
      }

      // Determine log level based on status code
      if (statusCode >= 500) {
        logger.error('Request failed with server error', responseMetadata);
      } else if (statusCode >= 400) {
        logger.warn('Request failed with client error', responseMetadata);
      } else {
        // Use configured success log level
        const logLevel = config.successLogLevel || 'http';
        logger[logLevel]('Request completed successfully', responseMetadata);
      }
    });

    // Handle errors
    res.on('error', (error: Error) => {
      logger.error('Response error', {
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

/**
 * Simple request logger with default options
 * Logs all requests with correlation IDs
 */
export const requestLogger = createRequestLogger();

/**
 * Create a service-specific request logger
 * @param serviceName - Name of the service
 */
export function createServiceRequestLogger(serviceName: string, options?: Omit<RequestLoggerOptions, 'serviceName'>) {
  return createRequestLogger({
    ...options,
    serviceName,
  });
}

/**
 * Middleware to extract correlation ID from request
 * Useful if you only want correlation tracking without full logging
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    generateCorrelationId();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

export default requestLogger;
