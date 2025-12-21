/**
 * Rate Limiting Middleware
 * Prevents abuse and ensures fair usage of notification services
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/utils/logger';
import { getRedisClient } from '@shared/cache/redis-connection';

// ============================================================================
// Configuration
// ============================================================================

// Rate limit windows (in seconds)
const RATE_LIMIT_WINDOW = {
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
};

// Rate limits per tenant per time window
const RATE_LIMITS = {
  EMAIL: {
    PER_MINUTE: 60,
    PER_HOUR: 1000,
    PER_DAY: 10000,
  },
  SMS: {
    PER_MINUTE: 30,
    PER_HOUR: 500,
    PER_DAY: 5000,
  },
  WEBHOOK: {
    PER_MINUTE: 100,
    PER_HOUR: 2000,
    PER_DAY: 20000,
  },
  API_REQUEST: {
    PER_MINUTE: 120,
    PER_HOUR: 3000,
    PER_DAY: 30000,
  },
};

// Burst protection (max requests in 1 second)
const BURST_LIMIT = 10;

// ============================================================================
// Rate Limiter Class
// ============================================================================

class RateLimiter {
  /**
   * Get Redis client (lazy initialization)
   */
  private getRedis() {
    return getRedisClient();
  }

  /**
   * Check rate limit for a given key
   */
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      const redis = this.getRedis();

      // Use Redis sorted set for sliding window rate limiting
      const redisKey = `rate_limit:${key}`;

      // Remove expired entries
      await redis.zremrangebyscore(redisKey, 0, windowStart);

      // Count requests in current window
      const count = await redis.zcard(redisKey);

      if (count >= limit) {
        // Get the oldest entry to calculate reset time
        const oldestEntry = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
        const resetAt = oldestEntry.length > 1 && oldestEntry[1]
          ? new Date(parseInt(oldestEntry[1]) + windowSeconds * 1000)
          : new Date(now + windowSeconds * 1000);

        return {
          allowed: false,
          remaining: 0,
          resetAt,
        };
      }

      // Add current request
      await redis.zadd(redisKey, now, `${now}-${Math.random()}`);

      // Set expiration on key
      await redis.expire(redisKey, windowSeconds);

      return {
        allowed: true,
        remaining: limit - count - 1,
        resetAt: new Date(now + windowSeconds * 1000),
      };
    } catch (error) {
      // If Redis fails, log error but allow the request (fail open)
      logger.error('Rate limiter Redis error', {
        service: 'notification-service',
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });

      return {
        allowed: true,
        remaining: limit,
        resetAt: new Date(now + windowSeconds * 1000),
      };
    }
  }

  /**
   * Check burst protection (max requests per second)
   */
  async checkBurst(key: string): Promise<boolean> {
    try {
      const redis = this.getRedis();
      const redisKey = `burst:${key}`;
      const count = await redis.incr(redisKey);

      if (count === 1) {
        // First request, set expiration
        await redis.expire(redisKey, 1);
      }

      return count <= BURST_LIMIT;
    } catch (error) {
      logger.error('Burst protection Redis error', {
        service: 'notification-service',
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      return true; // Fail open
    }
  }

  /**
   * Get current usage stats for a key
   */
  async getUsageStats(
    key: string,
    windowSeconds: number
  ): Promise<{ count: number; limit: number; resetAt: Date }> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      const redis = this.getRedis();
      const redisKey = `rate_limit:${key}`;

      // Remove expired entries
      await redis.zremrangebyscore(redisKey, 0, windowStart);

      // Count requests
      const count = await redis.zcard(redisKey);

      return {
        count,
        limit: 0, // Will be set by caller
        resetAt: new Date(now + windowSeconds * 1000),
      };
    } catch (error) {
      return {
        count: 0,
        limit: 0,
        resetAt: new Date(now + windowSeconds * 1000),
      };
    }
  }
}

const rateLimiter = new RateLimiter();

// ============================================================================
// Middleware Factory Functions
// ============================================================================

/**
 * Create rate limit middleware for a specific service type
 */
function createRateLimitMiddleware(
  serviceType: 'EMAIL' | 'SMS' | 'WEBHOOK' | 'API_REQUEST',
  checkDaily: boolean = true
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        // If no tenant, skip rate limiting (shouldn't happen with auth middleware)
        return next();
      }

      const key = `${tenantId}:${serviceType.toLowerCase()}`;

      // Check burst protection
      const burstAllowed = await rateLimiter.checkBurst(key);
      if (!burstAllowed) {
        logger.warn('Burst limit exceeded', {
          service: 'notification-service',
          tenantId,
          type: serviceType,
        });

        res.status(429).json({
          success: false,
          error: 'Too many requests. Please slow down.',
          retryAfter: 1,
        });
        return;
      }

      // Check per-minute limit
      const minuteLimit = RATE_LIMITS[serviceType].PER_MINUTE;
      const minuteCheck = await rateLimiter.checkLimit(
        `${key}:minute`,
        minuteLimit,
        RATE_LIMIT_WINDOW.MINUTE
      );

      if (!minuteCheck.allowed) {
        logger.warn('Per-minute rate limit exceeded', {
          service: 'notification-service',
          tenantId,
          type: serviceType,
          limit: minuteLimit,
        });

        res.set('X-RateLimit-Limit', minuteLimit.toString());
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-Reset', minuteCheck.resetAt.toISOString());

        res.status(429).json({
          success: false,
          error: `Rate limit exceeded. Maximum ${minuteLimit} requests per minute.`,
          limit: minuteLimit,
          window: 'minute',
          resetAt: minuteCheck.resetAt.toISOString(),
        });
        return;
      }

      // Check per-hour limit
      const hourLimit = RATE_LIMITS[serviceType].PER_HOUR;
      const hourCheck = await rateLimiter.checkLimit(
        `${key}:hour`,
        hourLimit,
        RATE_LIMIT_WINDOW.HOUR
      );

      if (!hourCheck.allowed) {
        logger.warn('Per-hour rate limit exceeded', {
          service: 'notification-service',
          tenantId,
          type: serviceType,
          limit: hourLimit,
        });

        res.set('X-RateLimit-Limit', hourLimit.toString());
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-Reset', hourCheck.resetAt.toISOString());

        res.status(429).json({
          success: false,
          error: `Rate limit exceeded. Maximum ${hourLimit} requests per hour.`,
          limit: hourLimit,
          window: 'hour',
          resetAt: hourCheck.resetAt.toISOString(),
        });
        return;
      }

      // Check per-day limit (if applicable)
      if (checkDaily && RATE_LIMITS[serviceType].PER_DAY) {
        const dayLimit = RATE_LIMITS[serviceType].PER_DAY;
        const dayCheck = await rateLimiter.checkLimit(
          `${key}:day`,
          dayLimit,
          RATE_LIMIT_WINDOW.DAY
        );

        if (!dayCheck.allowed) {
          logger.warn('Per-day rate limit exceeded', {
            service: 'notification-service',
            tenantId,
            type: serviceType,
            limit: dayLimit,
          });

          res.set('X-RateLimit-Limit', dayLimit.toString());
          res.set('X-RateLimit-Remaining', '0');
          res.set('X-RateLimit-Reset', dayCheck.resetAt.toISOString());

          res.status(429).json({
            success: false,
            error: `Daily rate limit exceeded. Maximum ${dayLimit} requests per day.`,
            limit: dayLimit,
            window: 'day',
            resetAt: dayCheck.resetAt.toISOString(),
          });
          return;
        }
      }

      // Add rate limit headers
      res.set('X-RateLimit-Limit-Minute', minuteLimit.toString());
      res.set('X-RateLimit-Remaining-Minute', minuteCheck.remaining.toString());
      res.set('X-RateLimit-Limit-Hour', hourLimit.toString());
      res.set('X-RateLimit-Remaining-Hour', hourCheck.remaining.toString());

      next();
    } catch (error) {
      logger.error('Rate limiter middleware error', {
        service: 'notification-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // On error, allow request through (fail open)
      next();
    }
  };
}

// ============================================================================
// Exported Middleware
// ============================================================================

/**
 * Rate limit for email endpoints
 */
export const emailRateLimit = createRateLimitMiddleware('EMAIL', true);

/**
 * Rate limit for SMS endpoints
 */
export const smsRateLimit = createRateLimitMiddleware('SMS', true);

/**
 * Rate limit for webhook endpoints
 */
export const webhookRateLimit = createRateLimitMiddleware('WEBHOOK', true);

/**
 * General API rate limit
 */
export const apiRateLimit = createRateLimitMiddleware('API_REQUEST', false);

/**
 * Custom rate limit for specific operations
 */
export function customRateLimit(
  limit: number,
  windowSeconds: number,
  keyPrefix: string = 'custom'
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return next();
      }

      const key = `${tenantId}:${keyPrefix}`;
      const check = await rateLimiter.checkLimit(key, limit, windowSeconds);

      if (!check.allowed) {
        logger.warn('Custom rate limit exceeded', {
          service: 'notification-service',
          tenantId,
          keyPrefix,
          limit,
          window: windowSeconds,
        });

        res.set('X-RateLimit-Limit', limit.toString());
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-Reset', check.resetAt.toISOString());

        res.status(429).json({
          success: false,
          error: `Rate limit exceeded. Maximum ${limit} requests per ${windowSeconds} seconds.`,
          limit,
          window: `${windowSeconds}s`,
          resetAt: check.resetAt.toISOString(),
        });
        return;
      }

      res.set('X-RateLimit-Limit', limit.toString());
      res.set('X-RateLimit-Remaining', check.remaining.toString());
      res.set('X-RateLimit-Reset', check.resetAt.toISOString());

      next();
    } catch (error) {
      logger.error('Custom rate limiter error', {
        service: 'notification-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next();
    }
  };
}

/**
 * Get usage statistics for a tenant
 */
export async function getUsageStats(tenantId: string): Promise<{
  email: { minute: number; hour: number; day: number };
  sms: { minute: number; hour: number; day: number };
  webhook: { minute: number; hour: number; day: number };
}> {
  const emailMinute = await rateLimiter.getUsageStats(
    `${tenantId}:email:minute`,
    RATE_LIMIT_WINDOW.MINUTE
  );
  const emailHour = await rateLimiter.getUsageStats(
    `${tenantId}:email:hour`,
    RATE_LIMIT_WINDOW.HOUR
  );
  const emailDay = await rateLimiter.getUsageStats(
    `${tenantId}:email:day`,
    RATE_LIMIT_WINDOW.DAY
  );

  const smsMinute = await rateLimiter.getUsageStats(
    `${tenantId}:sms:minute`,
    RATE_LIMIT_WINDOW.MINUTE
  );
  const smsHour = await rateLimiter.getUsageStats(
    `${tenantId}:sms:hour`,
    RATE_LIMIT_WINDOW.HOUR
  );
  const smsDay = await rateLimiter.getUsageStats(
    `${tenantId}:sms:day`,
    RATE_LIMIT_WINDOW.DAY
  );

  const webhookMinute = await rateLimiter.getUsageStats(
    `${tenantId}:webhook:minute`,
    RATE_LIMIT_WINDOW.MINUTE
  );
  const webhookHour = await rateLimiter.getUsageStats(
    `${tenantId}:webhook:hour`,
    RATE_LIMIT_WINDOW.HOUR
  );
  const webhookDay = await rateLimiter.getUsageStats(
    `${tenantId}:webhook:day`,
    RATE_LIMIT_WINDOW.DAY
  );

  return {
    email: {
      minute: emailMinute.count,
      hour: emailHour.count,
      day: emailDay.count,
    },
    sms: {
      minute: smsMinute.count,
      hour: smsHour.count,
      day: smsDay.count,
    },
    webhook: {
      minute: webhookMinute.count,
      hour: webhookHour.count,
      day: webhookDay.count,
    },
  };
}

// Export rate limiter instance for testing
export { rateLimiter };
