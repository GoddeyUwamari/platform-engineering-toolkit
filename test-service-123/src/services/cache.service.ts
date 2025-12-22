import { getRedisClient } from '../core/cache/redis.config';
import { config } from '../config/environment';

/**
 * Cache Service
 *
 * Provides caching functionality using Redis
 * Implements cache-aside pattern for data caching
 * Handles automatic serialization/deserialization
 */

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 900, // 15 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
  DEFAULT: config.redis.ttl || 3600,
};

/**
 * Cache key prefixes for different data types
 */
export const CachePrefix = {
  USER: 'user:',
  TASK: 'task:',
  USER_TASKS: 'user_tasks:',
  TASK_STATS: 'task_stats:',
  SESSION: 'session:',
};

export class CacheService {
  /**
   * Get value from cache
   * Automatically deserializes JSON data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = getRedisClient();
      const value = await redis.get(key);

      if (!value) {
        return null;
      }

      // Try to parse as JSON, return raw string if parsing fails
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Error getting cache key ${key}:`, error);
      return null; // Fail gracefully - cache misses are acceptable
    }
  }

  /**
   * Set value in cache with TTL
   * Automatically serializes objects to JSON
   */
  async set(key: string, value: unknown, ttl: number = CacheTTL.DEFAULT): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      await redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error(`Error setting cache key ${key}:`, error);
      return false; // Fail gracefully
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Error deleting cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await redis.del(...keys);
      return result;
    } catch (error) {
      console.error(`Error deleting cache pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Error checking cache key existence ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key (in seconds)
   */
  async ttl(key: string): Promise<number> {
    try {
      const redis = getRedisClient();
      return await redis.ttl(key);
    } catch (error) {
      console.error(`Error getting TTL for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Increment numeric value in cache
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const redis = getRedisClient();
      return await redis.incrby(key, amount);
    } catch (error) {
      console.error(`Error incrementing cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Decrement numeric value in cache
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      const redis = getRedisClient();
      return await redis.decrby(key, amount);
    } catch (error) {
      console.error(`Error decrementing cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Flush all cache (development only)
   */
  async flush(): Promise<boolean> {
    try {
      if (config.node_env === 'production') {
        console.warn('⚠️  Cache flush is disabled in production');
        return false;
      }

      const redis = getRedisClient();
      await redis.flushdb();
      console.info('✅ Cache flushed successfully');
      return true;
    } catch (error) {
      console.error('Error flushing cache:', error);
      return false;
    }
  }

  /**
   * Cache-aside pattern: Get or Set
   * Fetches from cache, or executes callback and caches result
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttl: number = CacheTTL.DEFAULT
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Cache miss - execute callback
      const result = await callback();

      // Store in cache for next time
      await this.set(key, result, ttl);

      return result;
    } catch (error) {
      console.error(`Error in cache getOrSet for key ${key}:`, error);
      // If cache fails, just execute callback
      return await callback();
    }
  }

  /**
   * Invalidate user-related cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      await this.del(`${CachePrefix.USER}${userId}`);
      await this.delPattern(`${CachePrefix.USER_TASKS}${userId}:*`);
      await this.del(`${CachePrefix.TASK_STATS}${userId}`);
    } catch (error) {
      console.error(`Error invalidating user cache for ${userId}:`, error);
    }
  }

  /**
   * Invalidate task-related cache
   */
  async invalidateTaskCache(taskId: string): Promise<void> {
    try {
      await this.del(`${CachePrefix.TASK}${taskId}`);
    } catch (error) {
      console.error(`Error invalidating task cache for ${taskId}:`, error);
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
