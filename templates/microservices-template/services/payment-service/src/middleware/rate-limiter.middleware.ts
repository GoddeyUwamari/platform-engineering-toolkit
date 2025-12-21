/**
 * Rate Limiting Middleware
 * Prevents abuse and ensures fair usage of payment services
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
  PAYMENT_INTENT: {
    PER_MINUTE: 30,
    PER_HOUR: 500,
    PER_DAY: 2000,
  },
  PAYMENT_METHOD: {
    PER_MINUTE: 20,
    PER_HOUR: 200,
    PER_DAY: 1000,
  },
  REFUND: {
    PER_MINUTE: 10,
    PER_HOUR: 100,
    PER_DAY: 500,
  },
  WEBHOOK: {
    PER_MINUTE: 100,
    PER_HOUR: 2000,
    PER_DAY: 10000,
  },
  API_REQUEST: {
    PER_MINUTE: 60,
    PER_HOUR: 1000,
    PER_DAY: 5000,
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
        service: 'payment-service',
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
        service: 'payment-service',
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
 * Create rate limit middleware for a specific operation type
 */
function createRateLimitMiddleware(
  operationType: 'PAYMENT_INTENT' | 'PAYMENT_METHOD' | 'REFUND' | 'WEBHOOK' | 'API_REQUEST',
  checkDaily: boolean = true
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        // If no tenant, skip rate limiting (shouldn't happen with auth middleware)
        return next();
      }

      const key = `${tenantId}:${operationType.toLowerCase()}`;

      // Check burst protection
      const burstAllowed = await rateLimiter.checkBurst(key);
      if (!burstAllowed) {
        logger.warn('Burst limit exceeded', {
          service: 'payment-service',
          tenantId,
          type: operationType,
        });

        res.status(429).json({
          success: false,
          error: 'Too many requests. Please slow down.',
          retryAfter: 1,
        });
        return;
      }

      // Check per-minute limit
      const minuteLimit = RATE_LIMITS[operationType].PER_MINUTE;
      const minuteCheck = await rateLimiter.checkLimit(
        `${key}:minute`,
        minuteLimit,
        RATE_LIMIT_WINDOW.MINUTE
      );

      if (!minuteCheck.allowed) {
        logger.warn('Per-minute rate limit exceeded', {
          service: 'payment-service',
          tenantId,
          type: operationType,
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
      const hourLimit = RATE_LIMITS[operationType].PER_HOUR;
      const hourCheck = await rateLimiter.checkLimit(
        `${key}:hour`,
        hourLimit,
        RATE_LIMIT_WINDOW.HOUR
      );

      if (!hourCheck.allowed) {
        logger.warn('Per-hour rate limit exceeded', {
          service: 'payment-service',
          tenantId,
          type: operationType,
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
      if (checkDaily && RATE_LIMITS[operationType].PER_DAY) {
        const dayLimit = RATE_LIMITS[operationType].PER_DAY;
        const dayCheck = await rateLimiter.checkLimit(
          `${key}:day`,
          dayLimit,
          RATE_LIMIT_WINDOW.DAY
        );

        if (!dayCheck.allowed) {
          logger.warn('Per-day rate limit exceeded', {
            service: 'payment-service',
            tenantId,
            type: operationType,
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
        service: 'payment-service',
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
 * Rate limit for payment intent endpoints
 */
export const paymentIntentRateLimit = createRateLimitMiddleware('PAYMENT_INTENT', true);

/**
 * Rate limit for payment method endpoints
 */
export const paymentMethodRateLimit = createRateLimitMiddleware('PAYMENT_METHOD', true);

/**
 * Rate limit for refund endpoints
 */
export const refundRateLimit = createRateLimitMiddleware('REFUND', true);

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
          service: 'payment-service',
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
        service: 'payment-service',
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
  paymentIntent: { minute: number; hour: number; day: number };
  paymentMethod: { minute: number; hour: number; day: number };
  refund: { minute: number; hour: number; day: number };
}> {
  const paymentIntentMinute = await rateLimiter.getUsageStats(
    `${tenantId}:payment_intent:minute`,
    RATE_LIMIT_WINDOW.MINUTE
  );
  const paymentIntentHour = await rateLimiter.getUsageStats(
    `${tenantId}:payment_intent:hour`,
    RATE_LIMIT_WINDOW.HOUR
  );
  const paymentIntentDay = await rateLimiter.getUsageStats(
    `${tenantId}:payment_intent:day`,
    RATE_LIMIT_WINDOW.DAY
  );

  const paymentMethodMinute = await rateLimiter.getUsageStats(
    `${tenantId}:payment_method:minute`,
    RATE_LIMIT_WINDOW.MINUTE
  );
  const paymentMethodHour = await rateLimiter.getUsageStats(
    `${tenantId}:payment_method:hour`,
    RATE_LIMIT_WINDOW.HOUR
  );
  const paymentMethodDay = await rateLimiter.getUsageStats(
    `${tenantId}:payment_method:day`,
    RATE_LIMIT_WINDOW.DAY
  );

  const refundMinute = await rateLimiter.getUsageStats(
    `${tenantId}:refund:minute`,
    RATE_LIMIT_WINDOW.MINUTE
  );
  const refundHour = await rateLimiter.getUsageStats(
    `${tenantId}:refund:hour`,
    RATE_LIMIT_WINDOW.HOUR
  );
  const refundDay = await rateLimiter.getUsageStats(
    `${tenantId}:refund:day`,
    RATE_LIMIT_WINDOW.DAY
  );

  return {
    paymentIntent: {
      minute: paymentIntentMinute.count,
      hour: paymentIntentHour.count,
      day: paymentIntentDay.count,
    },
    paymentMethod: {
      minute: paymentMethodMinute.count,
      hour: paymentMethodHour.count,
      day: paymentMethodDay.count,
    },
    refund: {
      minute: refundMinute.count,
      hour: refundHour.count,
      day: refundDay.count,
    },
  };
}

// Export rate limiter instance for testing
export { rateLimiter };
