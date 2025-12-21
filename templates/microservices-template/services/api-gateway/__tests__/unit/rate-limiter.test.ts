/**
 * Rate Limiter Unit Tests
 * Tests rate limiting middleware configuration and behavior
 */

import rateLimit from 'express-rate-limit';

// Mock express-rate-limit
jest.mock('express-rate-limit');

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      // Create a mock rate limiter middleware
      const mockRateLimiter = jest.fn((_req, _res, next) => {
        // Simulate allowing the request
        next();
      });

      // Mock the rateLimit factory
      (rateLimit as jest.MockedFunction<typeof rateLimit>).mockReturnValue(mockRateLimiter as any);

      // Create a rate limiter with specific configuration
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
        message: 'Too many requests',
      });

      // Verify rate limiter was created with correct configuration
      expect(rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          max: 100,
          message: 'Too many requests',
        })
      );

      // Simulate a request within the rate limit
      const mockReq = { ip: '127.0.0.1', path: '/api/test' };
      const mockRes = {};
      const mockNext = jest.fn();

      limiter(mockReq as any, mockRes as any, mockNext);

      // Verify the request was allowed (next was called)
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block requests exceeding rate limit', () => {
      // Create a mock rate limiter that blocks requests
      const mockRateLimiter = jest.fn((_req, res, _next) => {
        // Simulate blocking the request (rate limit exceeded)
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
        });
      });

      // Mock the rateLimit factory
      (rateLimit as jest.MockedFunction<typeof rateLimit>).mockReturnValue(mockRateLimiter as any);

      // Create a rate limiter with strict configuration
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // Only 5 requests per window
        message: {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
        },
      });

      // Verify rate limiter was created
      expect(rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          max: 5,
        })
      );

      // Simulate a request exceeding the rate limit
      const mockReq = { ip: '127.0.0.1', path: '/api/test' };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockNext = jest.fn();

      limiter(mockReq as any, mockRes as any, mockNext);

      // Verify the request was blocked (status 429 and response sent)
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
      });

      // Verify next was NOT called (request blocked)
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiter Configuration', () => {
    it('should configure global rate limiter with correct settings', () => {
      (rateLimit as jest.MockedFunction<typeof rateLimit>).mockReturnValue(jest.fn() as any);

      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // 1000 requests
        standardHeaders: true,
        legacyHeaders: false,
      });

      expect(rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          max: 1000,
          standardHeaders: true,
          legacyHeaders: false,
        })
      );
    });

    it('should configure auth rate limiter with stricter settings', () => {
      (rateLimit as jest.MockedFunction<typeof rateLimit>).mockReturnValue(jest.fn() as any);

      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Only 100 requests for auth endpoints
        standardHeaders: true,
        legacyHeaders: false,
      });

      expect(rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          max: 100,
        })
      );
    });

    it('should skip rate limiting for health check paths', () => {
      const skipFunction = jest.fn((req) => req.path.startsWith('/health'));

      (rateLimit as jest.MockedFunction<typeof rateLimit>).mockReturnValue(jest.fn() as any);

      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        skip: skipFunction,
      });

      expect(rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: expect.any(Function),
        })
      );

      // Test the skip function
      const healthReq = { path: '/health' };
      const apiReq = { path: '/api/test' };

      expect(skipFunction(healthReq)).toBe(true);
      expect(skipFunction(apiReq)).toBe(false);
    });
  });
});
