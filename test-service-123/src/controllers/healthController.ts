import { Request, Response } from 'express';
import { config } from '../config/environment';
import { checkDatabaseHealth } from '../core/database/data-source';
import { checkRedisHealth } from '../core/cache/redis.config';

interface HealthCheckResponse {
  success: boolean;
  message: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

interface ReadinessCheckResponse extends HealthCheckResponse {
  services: {
    database: {
      status: string;
      healthy: boolean;
      details?: Record<string, unknown>;
    };
    redis: {
      status: string;
      healthy: boolean;
      details?: Record<string, unknown>;
    };
  };
}

export const healthCheck = (_req: Request, res: Response): void => {
  const healthResponse: HealthCheckResponse = {
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.node_env,
    version: config.api_version,
  };

  res.status(200).json(healthResponse);
};

export const readinessCheck = async (_req: Request, res: Response): Promise<void> => {
  // Check database health
  const dbHealth = await checkDatabaseHealth();

  // Check Redis health
  const redisHealth = await checkRedisHealth();

  // Determine overall readiness
  const isReady = dbHealth.healthy && redisHealth.healthy;

  const readinessResponse: ReadinessCheckResponse = {
    success: isReady,
    message: isReady ? 'API is ready' : 'API is not ready',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.node_env,
    version: config.api_version,
    services: {
      database: {
        status: dbHealth.healthy ? 'healthy' : 'unhealthy',
        healthy: dbHealth.healthy,
        details: dbHealth.details,
      },
      redis: {
        status: redisHealth.healthy ? 'healthy' : 'unhealthy',
        healthy: redisHealth.healthy,
        details: redisHealth.details,
      },
    },
  };

  // Return 503 if services are not ready
  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json(readinessResponse);
};
