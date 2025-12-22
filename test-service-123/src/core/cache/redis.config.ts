import Redis, { RedisOptions } from 'ioredis';
import { config } from '../../config/environment';

/**
 * Redis Client Configuration
 *
 * Implements connection with retry strategy and error handling
 * Used for caching and session management
 */

let redisClient: Redis | null = null;

const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,

  // Connection retry strategy with exponential backoff
  retryStrategy: (times: number): number | void => {
    const maxRetries = 3;
    if (times > maxRetries) {
      console.error(`❌ Redis connection failed after ${maxRetries} attempts`);
      return undefined; // Stop retrying
    }

    const delay = Math.min(times * 1000, 3000); // Max 3 seconds
    console.info(`⏳ Redis reconnecting in ${delay}ms... (attempt ${times}/${maxRetries})`);
    return delay;
  },

  // Connection timeout
  connectTimeout: 10000,

  // Enable automatic reconnection
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,

  // Disable offline queue (fail fast if Redis is down)
  enableOfflineQueue: false,

  // Keep alive
  keepAlive: 30000,
};

/**
 * Initialize Redis connection
 */
export const initializeRedis = (): Redis => {
  try {
    console.info('🔌 Attempting to connect to Redis...');

    redisClient = new Redis(redisOptions);

    // Connection success handler
    redisClient.on('connect', () => {
      console.info('✅ Redis connection established successfully');
      console.info(`📊 Redis: ${config.redis.host}:${config.redis.port}`);
      console.info(`🗃️  Database: ${config.redis.db}`);
    });

    // Connection ready handler
    redisClient.on('ready', () => {
      console.info('✅ Redis client is ready to accept commands');
    });

    // Error handler
    redisClient.on('error', (error: Error) => {
      console.error('❌ Redis error:', error.message);
    });

    // Reconnecting handler
    redisClient.on('reconnecting', () => {
      console.info('🔄 Reconnecting to Redis...');
    });

    // Close handler
    redisClient.on('close', () => {
      console.info('⚠️  Redis connection closed');
    });

    return redisClient;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error);
    throw new Error(`Redis initialization failed: ${(error as Error).message}`);
  }
};

/**
 * Get Redis client instance
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis() first.');
  }
  return redisClient;
};

/**
 * Close Redis connection gracefully
 */
export const closeRedis = async (): Promise<void> => {
  try {
    if (redisClient) {
      await redisClient.quit();
      console.info('✅ Redis connection closed gracefully');
      redisClient = null;
    }
  } catch (error) {
    console.error('❌ Error closing Redis connection:', error);
    // Force disconnect if graceful shutdown fails
    if (redisClient) {
      redisClient.disconnect();
      redisClient = null;
    }
  }
};

/**
 * Check Redis health status
 */
export const checkRedisHealth = async (): Promise<{
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
}> => {
  try {
    if (!redisClient) {
      return {
        healthy: false,
        message: 'Redis not initialized',
      };
    }

    // Ping Redis to check connection
    const pong = await redisClient.ping();

    if (pong === 'PONG') {
      return {
        healthy: true,
        message: 'Redis connection is healthy',
        details: {
          host: config.redis.host,
          port: config.redis.port,
          db: config.redis.db,
          status: redisClient.status,
        },
      };
    }

    return {
      healthy: false,
      message: 'Redis ping failed',
    };
  } catch (error) {
    return {
      healthy: false,
      message: 'Redis health check failed',
      details: {
        error: (error as Error).message,
      },
    };
  }
};
