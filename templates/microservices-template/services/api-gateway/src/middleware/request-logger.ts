// services/api-gateway/src/middleware/request-logger.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '@shared/utils/logger';

/**
 * Request logging middleware
 * - Generates unique request ID for tracing
 * - Logs incoming requests with metadata
 * - Logs response time and status code
 * - Attaches request ID to request object
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique request ID
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  // Attach request ID to request object for use in other middleware
  (req as any).id = requestId;
  
  // Add request ID to response headers for client-side tracing
  res.setHeader('X-Request-ID', requestId);
  
  // Capture start time
  const startTime = Date.now();
  
  // Get request metadata
  const tenantIdHeader = req.headers['x-tenant-id'];
  const metadata = {
    requestId,
    method: req.method,
    path: req.path,
    url: req.url,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    tenantId: Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader,
    contentLength: req.headers['content-length'],
    referer: req.headers['referer'],
  };
  
  // Log incoming request
  logger.info(`[Gateway] → ${req.method} ${req.path}`, {
    ...metadata,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
  });
  
  // Capture response finish event
  const originalSend = res.send;
  res.send = function (data: any): Response {
    // Calculate response time
    const duration = Date.now() - startTime;
    
    // Determine log level based on status code
    const statusCode = res.statusCode;
    let logLevel: 'info' | 'warn' | 'error' = 'info';
    
    if (statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400) {
      logLevel = 'warn';
    }
    
    // Log response
    logger[logLevel](`[Gateway] ← ${statusCode} ${req.method} ${req.path} ${duration}ms`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode,
      duration,
      contentLength: res.getHeader('content-length'),
      ip: metadata.ip,
    });
    
    // Call original send method
    return originalSend.call(this, data);
  };
  
  // Handle response errors
  res.on('error', (error: Error) => {
    logger.error(`[Gateway] Response error for ${req.method} ${req.path}`, {
      requestId,
      error: error.message,
      stack: error.stack,
    });
  });
  
  next();
};