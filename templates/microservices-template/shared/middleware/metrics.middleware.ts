import { Request, Response, NextFunction, Router } from 'express';
import { ServiceMetrics, recordHttpMetrics, getMetrics, getMetricsContentType } from '../utils/metrics';

/**
 * Metrics Middleware
 *
 * Automatically collects HTTP request metrics:
 * - Request count by method, route, status code
 * - Request duration
 * - Active connections
 * - Tenant-specific metrics
 */

// Extend Express Request to include metrics tracking
declare global {
  namespace Express {
    interface Request {
      metricsStartTime?: number;
    }
  }
}

/**
 * Middleware options
 */
export interface MetricsMiddlewareOptions {
  /**
   * Paths to exclude from metrics collection
   * Example: ['/health', '/metrics']
   */
  excludePaths?: string[];

  /**
   * Whether to include tenant ID in metrics labels
   */
  includeTenantId?: boolean;

  /**
   * Custom route normalizer function
   */
  normalizeRoute?: (path: string) => string;
}

/**
 * Default options
 */
const defaultOptions: MetricsMiddlewareOptions = {
  excludePaths: ['/metrics', '/health', '/health/live', '/health/ready'],
  includeTenantId: true,
};

/**
 * Create metrics collection middleware
 * @param metrics - Service metrics instance
 * @param options - Middleware options
 */
export function createMetricsMiddleware(
  metrics: ServiceMetrics,
  options: MetricsMiddlewareOptions = {}
) {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip metrics collection for excluded paths
    if (config.excludePaths?.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Record start time
    req.metricsStartTime = Date.now();

    // Increment active connections
    metrics.activeConnections.inc({ service: metrics.serviceName });

    // Handle response finish event
    res.on('finish', () => {
      if (!req.metricsStartTime) return;

      // Calculate duration
      const duration = Date.now() - req.metricsStartTime;

      // Get tenant ID if available
      const tenantId = config.includeTenantId ? (req as any).tenantId : undefined;

      // Record metrics
      recordHttpMetrics(
        metrics,
        req.method,
        req.route?.path || req.path, // Use route path if available for better grouping
        res.statusCode,
        duration,
        tenantId
      );

      // Decrement active connections
      metrics.activeConnections.dec({ service: metrics.serviceName });
    });

    // Handle connection close (e.g., client disconnect)
    res.on('close', () => {
      if (req.metricsStartTime) {
        // Decrement active connections if not already decremented
        metrics.activeConnections.dec({ service: metrics.serviceName });
      }
    });

    next();
  };
}

/**
 * Create metrics endpoint router
 * Returns a router with GET /metrics endpoint
 * @param metrics - Service metrics instance
 */
export function createMetricsEndpoint(metrics: ServiceMetrics): Router {
  const router = Router();

  router.get('/metrics', async (_req: Request, res: Response) => {
    try {
      // Set content type for Prometheus
      res.setHeader('Content-Type', getMetricsContentType(metrics.register));

      // Get metrics in Prometheus format
      const metricsOutput = await getMetrics(metrics.register);

      // Send metrics
      res.send(metricsOutput);
    } catch (error) {
      // Log error but don't expose internal details
      console.error('Error generating metrics:', error);
      res.status(500).send('Error generating metrics');
    }
  });

  return router;
}

/**
 * Simple middleware to expose metrics endpoint
 * @param metrics - Service metrics instance
 * @param path - Path to expose metrics (default: /metrics)
 */
export function exposeMetrics(metrics: ServiceMetrics, path: string = '/metrics') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path === path) {
      try {
        res.setHeader('Content-Type', getMetricsContentType(metrics.register));
        const metricsOutput = await getMetrics(metrics.register);
        res.send(metricsOutput);
      } catch (error) {
        console.error('Error generating metrics:', error);
        res.status(500).send('Error generating metrics');
      }
    } else {
      next();
    }
  };
}

// ============================================================================
// Export
// ============================================================================

export default {
  createMetricsMiddleware,
  createMetricsEndpoint,
  exposeMetrics,
};
