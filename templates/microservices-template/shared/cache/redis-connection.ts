/**
 * Redis Connection Manager
 * 
 * Handles connection to Redis for caching and session management.
 * Uses ioredis library for robust Redis operations.
 * 
 * Environment Variables Required:
 * - REDIS_HOST: Redis server hostname (default: localhost)
 * - REDIS_PORT: Redis server port (default: 6380)
 * - REDIS_PASSWORD: Redis authentication password
 * - REDIS_DB: Redis database number (default: 0)
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Redis client instance (Singleton pattern)
 * Only one connection is created and reused throughout the application
 */
let redisClient: Redis | null = null;

/**
 * Redis Configuration Interface
 */
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
  retryStrategy: (times: number) => number | void;
}

/**
 * Get Redis configuration from environment variables
 * Uses values from docker-compose.yml when running in Docker
 */
const getRedisConfig = (): RedisConfig => {
  return {
    // In Docker: 'redis' (service name), Outside Docker: 'localhost'
    host: process.env.REDIS_HOST || 'localhost',
    
    // In Docker: 6379 (internal), Outside Docker: 6380 (mapped port)
    port: parseInt(process.env.REDIS_PORT || '6380', 10),
    
    // Password from docker-compose.yml (default: redis123)
    password: process.env.REDIS_PASSWORD || undefined,
    
    // Redis database number (0-15, default: 0)
    db: parseInt(process.env.REDIS_DB || '0', 10),
    
    // Maximum retry attempts per request
    maxRetriesPerRequest: 3,
    
    // Enable ready check before accepting commands
    enableReadyCheck: true,
    
    // Retry strategy: exponential backoff with max 2 seconds
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      logger.info(`🔄 Redis retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
  };
};

/**
 * Initialize Redis connection
 * Call this when your application starts (in index.ts)
 * 
 * @returns Promise<Redis> - Connected Redis client
 * @throws Error if connection fails
 */
export const connectRedis = async (): Promise<Redis> => {
  // If already connected, return existing client
  if (redisClient) {
    logger.info('♻️  Redis client already connected');
    return redisClient;
  }

  try {
    const config = getRedisConfig();
    
    logger.info('🔌 Connecting to Redis...', {
      host: config.host,
      port: config.port,
      db: config.db,
    });
    
    // Create new Redis client with configuration
    redisClient = new Redis(config);

    // ========================================================================
    // EVENT HANDLERS - Monitor Redis connection lifecycle
    // ========================================================================
    
    /**
     * 'connect' event: Fired when connection is establishing
     */
    redisClient.on('connect', () => {
      logger.info('📡 Redis connecting...');
    });

    /**
     * 'ready' event: Fired when Redis is ready to accept commands
     * This is what we want to see!
     */
    redisClient.on('ready', () => {
      logger.info('✅ Redis connected and ready!', {
        host: config.host,
        port: config.port,
        db: config.db,
      });
    });

    /**
     * 'error' event: Fired on connection errors
     * Logs error but doesn't crash the app (retryStrategy handles reconnection)
     */
    redisClient.on('error', (error: any) => {
      logger.error('❌ Redis error:', {
        message: error.message,
      });
    });

    /**
     * 'close' event: Fired when connection is closed
     */
    redisClient.on('close', () => {
      logger.warn('⚠️  Redis connection closed');
    });

    /**
     * 'reconnecting' event: Fired when attempting to reconnect
     */
    redisClient.on('reconnecting', (delay: number) => {
      logger.info(`🔄 Redis reconnecting in ${delay}ms...`);
    });

    /**
     * 'end' event: Fired when connection is completely terminated
     */
    redisClient.on('end', () => {
      logger.warn('🛑 Redis connection ended');
      redisClient = null; // Reset client so new connection can be created
    });

    // ========================================================================
    // TEST CONNECTION - Verify Redis is working
    // ========================================================================
    
    const pingResult = await redisClient.ping();
    
    if (pingResult === 'PONG') {
      logger.info('🏓 Redis PING successful - Connection verified!');
    } else {
      throw new Error(`Redis PING failed: received "${pingResult}" instead of "PONG"`);
    }

    return redisClient;

  } catch (error) {
    logger.error('💥 Failed to connect to Redis:', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Clean up failed connection attempt
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
    }
    
    throw error;
  }
};

/**
 * Get the Redis client instance
 * Make sure to call connectRedis() first during app startup!
 * 
 * @returns Redis - Active Redis client
 * @throws Error if Redis is not connected
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error(
      '❌ Redis client not initialized! Call connectRedis() during app startup.'
    );
  }
  
  if (redisClient.status !== 'ready') {
    logger.warn(`⚠️  Redis status: ${redisClient.status}`);
  }
  
  return redisClient;
};

/**
 * Close Redis connection gracefully
 * Call this when shutting down your application
 * 
 * @returns Promise<void>
 */
export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      logger.info('👋 Closing Redis connection...');
      
      // Gracefully close connection (waits for pending commands)
      await redisClient.quit();
      
      redisClient = null;
      logger.info('✅ Redis disconnected successfully');
      
    } catch (error) {
      logger.error('❌ Error disconnecting Redis:', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Force close if graceful shutdown fails
      if (redisClient) {
        redisClient.disconnect();
        redisClient = null;
      }
    }
  } else {
    logger.info('ℹ️  Redis already disconnected');
  }
};

/**
 * Check if Redis is currently connected and ready
 * 
 * @returns boolean - True if connected and ready
 */
export const isRedisConnected = (): boolean => {
  return redisClient !== null && redisClient.status === 'ready';
};

/**
 * Health check - Test Redis connection
 * Useful for health check endpoints (/health)
 * 
 * @returns Promise<boolean> - True if Redis responds to PING
 */
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    if (!redisClient) {
      logger.warn('⚠️  Redis health check: Client not initialized');
      return false;
    }
    
    if (redisClient.status !== 'ready') {
      logger.warn(`⚠️  Redis health check: Status is "${redisClient.status}"`);
      return false;
    }
    
    // Test with PING command
    const result = await redisClient.ping();
    
    if (result === 'PONG') {
      logger.debug('✅ Redis health check passed');
      return true;
    } else {
      logger.warn(`⚠️  Redis health check: Unexpected response "${result}"`);
      return false;
    }
    
  } catch (error) {
    logger.error('❌ Redis health check failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

/**
 * Get Redis connection info for debugging
 * 
 * @returns object - Connection status and info
 */
export const getRedisInfo = () => {
  if (!redisClient) {
    return {
      connected: false,
      status: 'not_initialized',
    };
  }
  
  return {
    connected: redisClient.status === 'ready',
    status: redisClient.status,
    host: redisClient.options.host,
    port: redisClient.options.port,
    db: redisClient.options.db,
  };
};