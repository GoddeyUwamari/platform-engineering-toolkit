import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Production-Grade Structured Logger
 *
 * Features:
 * - JSON-formatted logs for production (easy parsing)
 * - Pretty-printed logs for development (human-readable)
 * - Daily log rotation with automatic cleanup
 * - Correlation IDs for request tracing
 * - Tenant context tracking
 * - Performance metrics
 * - Error stack traces
 * - Multiple transports (console, file, rotating file)
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface LogMetadata {
  service?: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  ip?: string;
  userAgent?: string;
  error?: unknown;
  [key: string]: unknown;
}

// ============================================================================
// Configuration
// ============================================================================

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Determine environment and log level
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// ============================================================================
// Custom Formats
// ============================================================================

/**
 * Format for production (JSON)
 * Outputs structured JSON logs that can be easily parsed by log aggregators
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Format for development (Pretty-printed)
 * Human-readable format with colors for local development
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, correlationId, tenantId, duration, error, ...rest } = info as any;

    let log = `${timestamp} [${level}]`;

    if (service) {
      log += ` [${service}]`;
    }

    if (correlationId && typeof correlationId === 'string') {
      log += ` [${correlationId.substring(0, 8)}]`;
    }

    if (tenantId && typeof tenantId === 'string') {
      log += ` [tenant:${tenantId.substring(0, 8)}]`;
    }

    log += `: ${message}`;

    if (duration !== undefined) {
      log += ` (${duration}ms)`;
    }

    // Add additional metadata if present
    const metadata = Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : '';
    if (metadata) {
      log += `\n${metadata}`;
    }

    // Add error stack if present
    if (error && typeof error === 'object' && error.stack) {
      log += `\n${error.stack}`;
    }

    return log;
  })
);

/**
 * Format for file logs (JSON without colors)
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ============================================================================
// Transports Configuration
// ============================================================================

const transports: winston.transport[] = [
  // Console transport - uses development or production format based on environment
  new winston.transports.Console({
    format: isDevelopment ? developmentFormat : productionFormat,
    level: LOG_LEVEL,
  }),
];

// File transports (only in non-test environments)
if (NODE_ENV !== 'test') {
  // Daily rotating file for all logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
      level: LOG_LEVEL,
    })
  );

  // Daily rotating file for errors only
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
      level: 'error',
    })
  );

  // Separate file for HTTP requests (useful for access logs)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'http-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      format: fileFormat,
      level: 'http',
    })
  );
}

// ============================================================================
// Logger Instance
// ============================================================================

const Logger = winston.createLogger({
  level: LOG_LEVEL,
  levels,
  transports,
  exitOnError: false,
  // Prevent unhandled exceptions from crashing the process
  exceptionHandlers: NODE_ENV !== 'test' ? [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat,
    })
  ] : [],
  rejectionHandlers: NODE_ENV !== 'test' ? [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat,
    })
  ] : [],
});

// ============================================================================
// Logger Helper Functions
// ============================================================================

/**
 * Enhanced logger with structured logging capabilities
 */
export const logger = {
  /**
   * Log error messages
   * @param message - The error message
   * @param meta - Additional metadata (including error object)
   */
  error: (message: string, meta?: LogMetadata): void => {
    const metadata = formatMetadata(meta);
    Logger.error(message, metadata);
  },

  /**
   * Log warning messages
   * @param message - The warning message
   * @param meta - Additional metadata
   */
  warn: (message: string, meta?: LogMetadata): void => {
    const metadata = formatMetadata(meta);
    Logger.warn(message, metadata);
  },

  /**
   * Log info messages
   * @param message - The info message
   * @param meta - Additional metadata
   */
  info: (message: string, meta?: LogMetadata): void => {
    const metadata = formatMetadata(meta);
    Logger.info(message, metadata);
  },

  /**
   * Log HTTP requests
   * @param message - The HTTP request message
   * @param meta - Additional metadata (method, path, status, duration)
   */
  http: (message: string, meta?: LogMetadata): void => {
    const metadata = formatMetadata(meta);
    Logger.http(message, metadata);
  },

  /**
   * Log debug messages (development only)
   * @param message - The debug message
   * @param meta - Additional metadata
   */
  debug: (message: string, meta?: LogMetadata): void => {
    const metadata = formatMetadata(meta);
    Logger.debug(message, metadata);
  },

  /**
   * Create a child logger with default metadata
   * Useful for adding service context to all logs
   * @param defaultMeta - Default metadata to include in all logs
   */
  child: (defaultMeta: LogMetadata) => {
    return Logger.child({ ...formatMetadata(defaultMeta) });
  },
};

/**
 * Format metadata for consistent logging
 * @param meta - Raw metadata object
 */
function formatMetadata(meta?: LogMetadata): Record<string, unknown> {
  if (!meta) return {};

  const formatted: Record<string, unknown> = { ...meta };

  // Format error objects
  if (meta.error !== undefined && meta.error !== null) {
    if (meta.error instanceof Error) {
      // Format Error objects with full details
      formatted.error = {
        message: meta.error.message,
        stack: meta.error.stack,
        code: (meta.error as any).code,
        name: meta.error.name,
      };
    } else if (typeof meta.error === 'string') {
      // Format string errors
      formatted.error = {
        message: meta.error,
      };
    } else if (typeof meta.error === 'object') {
      // If it's an object, try to extract meaningful info
      const errorObj = meta.error as any;
      formatted.error = {
        message: errorObj.message || JSON.stringify(meta.error),
        stack: errorObj.stack,
        code: errorObj.code,
        name: errorObj.name,
      };
    } else {
      // For other types, convert to string
      formatted.error = {
        message: String(meta.error),
      };
    }
  }

  // Format duration to include unit
  if (meta.duration !== undefined) {
    formatted.duration = meta.duration;
  }

  return formatted;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a correlation ID for request tracing
 * Uses a simple UUID v4 format
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create a logger instance with service context
 * @param serviceName - Name of the service
 */
export function createServiceLogger(serviceName: string) {
  return {
    error: (message: string, meta?: LogMetadata) =>
      logger.error(message, { ...meta, service: serviceName }),
    warn: (message: string, meta?: LogMetadata) =>
      logger.warn(message, { ...meta, service: serviceName }),
    info: (message: string, meta?: LogMetadata) =>
      logger.info(message, { ...meta, service: serviceName }),
    http: (message: string, meta?: LogMetadata) =>
      logger.http(message, { ...meta, service: serviceName }),
    debug: (message: string, meta?: LogMetadata) =>
      logger.debug(message, { ...meta, service: serviceName }),
  };
}

/**
 * Log a performance metric
 * @param operation - Name of the operation
 * @param startTime - Start time of the operation
 * @param meta - Additional metadata
 */
export function logPerformance(
  operation: string,
  startTime: number,
  meta?: LogMetadata
): void {
  const duration = Date.now() - startTime;
  logger.info(`${operation} completed`, {
    ...meta,
    duration,
  });
}

// ============================================================================
// Export
// ============================================================================

export default logger;
