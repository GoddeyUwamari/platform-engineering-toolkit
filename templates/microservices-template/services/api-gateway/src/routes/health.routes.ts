// services/api-gateway/src/routes/health.routes.ts
import { Router, Request, Response } from 'express';
import logger from '@shared/utils/logger';
import { SERVICES } from '../config/services.config';

const router = Router();

/**
 * Check if a service is healthy by making HTTP request to its health endpoint
 */
const checkServiceHealth = async (
  _serviceName: string,
  serviceUrl: string
): Promise<{ status: 'healthy' | 'unhealthy'; responseTime: number; error?: string }> => {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const response = await fetch(`${serviceUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return { status: 'healthy', responseTime };
    } else {
      return {
        status: 'unhealthy',
        responseTime,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'unhealthy',
      responseTime,
      error: error.name === 'AbortError' ? 'Timeout' : error.message,
    };
  }
};

/**
 * Check PostgreSQL database health using direct connection
 */
const checkPostgresHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  error?: string;
}> => {
  const startTime = Date.now();

  try {
    // Create a temporary PostgreSQL client for health check
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'cloudbill',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      connectionTimeoutMillis: 5000,
    });

    // Test connection with simple query
    await pool.query('SELECT 1');
    await pool.end();

    const responseTime = Date.now() - startTime;
    return { status: 'healthy', responseTime };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      error: error.message || 'Database connection failed',
    };
  }
};

/**
 * Check Redis cache health using direct connection
 */
const checkRedisHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  error?: string;
}> => {
  const startTime = Date.now();

  try {
    // Create a temporary Redis client for health check
    const { default: Redis } = await import('ioredis');
    const redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    // Connect and test with PING
    await redisClient.connect();
    const result = await redisClient.ping();
    await redisClient.quit();

    const responseTime = Date.now() - startTime;

    if (result === 'PONG') {
      return { status: 'healthy', responseTime };
    } else {
      return {
        status: 'unhealthy',
        responseTime,
        error: `Unexpected PING response: ${result}`,
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      error: error.message || 'Redis connection failed',
    };
  }
};

/**
 * GET /health
 * Comprehensive health check - checks gateway and all registered services
 */
router.get('/', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Check all services and infrastructure in parallel
    const [serviceChecks, postgresCheck, redisCheck] = await Promise.all([
      Promise.all([
        checkServiceHealth('auth-service', SERVICES.AUTH_SERVICE),
        checkServiceHealth('billing-service', SERVICES.BILLING_SERVICE),
        checkServiceHealth('payment-service', SERVICES.PAYMENT_SERVICE),
        checkServiceHealth('notification-service', SERVICES.NOTIFICATION_SERVICE),
      ]),
      checkPostgresHealth(),
      checkRedisHealth(),
    ]);

    const services = {
      'auth-service': serviceChecks[0],
      'billing-service': serviceChecks[1],
      'payment-service': serviceChecks[2],
      'notification-service': serviceChecks[3],
      postgresql: postgresCheck,
      redis: redisCheck,
    };
    
    // Determine overall health
    const allHealthy = Object.values(services).every(
      (service) => service.status === 'healthy'
    );
    
    const totalDuration = Date.now() - startTime;
    
    const healthStatus = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      gateway: {
        status: 'healthy',
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          unit: 'MB',
        },
        cpu: {
          user: process.cpuUsage().user,
          system: process.cpuUsage().system,
        },
      },
      services,
      checks: {
        duration: `${totalDuration}ms`,
        total: Object.keys(services).length,
        healthy: Object.values(services).filter((s) => s.status === 'healthy').length,
        unhealthy: Object.values(services).filter((s) => s.status === 'unhealthy').length,
      },
    };
    
    // Return 200 if all healthy, 503 if any service is down
    const statusCode = allHealthy ? 200 : 503;
    
    if (!allHealthy) {
      logger.warn('[Gateway] Health check detected unhealthy services', healthStatus);
    }
    
    res.status(statusCode).json(healthStatus);
  } catch (error: any) {
    logger.error('[Gateway] Health check error:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      gateway: {
        status: 'healthy',
      },
    });
  }
});

/**
 * GET /health/live
 * Kubernetes liveness probe - checks if gateway is running
 * Should return 200 if the application is alive
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /health/ready
 * Kubernetes readiness probe - checks if gateway is ready to accept traffic
 * Should return 200 if the application can handle requests
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check if critical services are available
    const serviceChecks = await Promise.all([
      checkServiceHealth('auth-service', SERVICES.AUTH_SERVICE),
      checkServiceHealth('billing-service', SERVICES.BILLING_SERVICE),
      checkServiceHealth('payment-service', SERVICES.PAYMENT_SERVICE),
      checkServiceHealth('notification-service', SERVICES.NOTIFICATION_SERVICE),
    ]);

    const services = {
      'auth-service': serviceChecks[0],
      'billing-service': serviceChecks[1],
      'payment-service': serviceChecks[2],
      'notification-service': serviceChecks[3],
    };

    // Gateway is ready if auth service is healthy (critical service)
    const isReady = services['auth-service'].status === 'healthy';

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services,
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        reason: 'Critical services unavailable',
        services,
      });
    }
  } catch (error: any) {
    logger.error('[Gateway] Readiness check error:', error);

    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * GET /health/services
 * Detailed service health check
 */
router.get('/services', async (_req: Request, res: Response) => {
  try {
    const serviceChecks = await Promise.all([
      checkServiceHealth('auth-service', SERVICES.AUTH_SERVICE),
      checkServiceHealth('billing-service', SERVICES.BILLING_SERVICE),
      checkServiceHealth('payment-service', SERVICES.PAYMENT_SERVICE),
      checkServiceHealth('notification-service', SERVICES.NOTIFICATION_SERVICE),
    ]);

    const services = [
      {
        name: 'auth-service',
        url: SERVICES.AUTH_SERVICE,
        ...serviceChecks[0],
      },
      {
        name: 'billing-service',
        url: SERVICES.BILLING_SERVICE,
        ...serviceChecks[1],
      },
      {
        name: 'payment-service',
        url: SERVICES.PAYMENT_SERVICE,
        ...serviceChecks[2],
      },
      {
        name: 'notification-service',
        url: SERVICES.NOTIFICATION_SERVICE,
        ...serviceChecks[3],
      },
    ];
    
    res.json({
      timestamp: new Date().toISOString(),
      total: services.length,
      healthy: services.filter((s) => s.status === 'healthy').length,
      unhealthy: services.filter((s) => s.status === 'unhealthy').length,
      services,
    });
  } catch (error: any) {
    logger.error('[Gateway] Service health check error:', error);
    
    res.status(500).json({
      error: 'Failed to check service health',
      message: error.message,
    });
  }
});

export { router as healthRouter };