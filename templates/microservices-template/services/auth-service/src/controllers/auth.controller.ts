import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ApiResponse } from '@shared/types';
import {
  ValidationError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import { AuthService } from '../services/auth.service';
import { getRedisClient } from '@shared/cache/redis-connection';
import { randomBytes } from 'crypto';
import { authDatabase } from '../config/database.config';

/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  public static register = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, password, firstName, lastName, tenantName } = req.body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName || !tenantName) {
        throw new ValidationError('Missing required fields', {
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined,
          firstName: !firstName ? 'First name is required' : undefined,
          lastName: !lastName ? 'Last name is required' : undefined,
          tenantName: !tenantName ? 'Tenant name is required' : undefined,
        });
      }

      // Register user
      const result = await AuthService.register({
        email,
        password,
        firstName,
        lastName,
        tenantName,
      });

      // Generate session ID
      const sessionId = randomBytes(32).toString('hex');

      // Store session in Redis (30 days TTL)
      const sessionData = {
        userId: result.user.id,
        tenantId: result.user.tenantId,
        email: result.user.email,
        role: result.user.role,
        createdAt: new Date().toISOString(),
      };

      await getRedisClient().setex(
        `session:${sessionId}`,
        30 * 24 * 60 * 60, // 30 days in seconds
        JSON.stringify(sessionData)
      );

      logger.info('Session created in Redis', {
        sessionId,
        userId: result.user.id,
        tenantId: result.user.tenantId,
      });

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Set session ID cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      const response: ApiResponse = {
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
          sessionId, // Include session ID in response
        },
        message: 'User registered successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('User registration endpoint called', {
        email,
        userId: result.user.id,
      });

      res.status(201).json(response);
    }
  );

  /**
   * Login user
   * POST /api/auth/login
   */
  public static login = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        throw new ValidationError('Missing required fields', {
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined,
        });
      }

      // Get tenant ID from request (set by tenant middleware or header)
      const tenantId = req.tenantId || req.get('X-Tenant-ID');
      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      // Login user
      const result = await AuthService.login({ email, password }, tenantId);

      // Generate session ID
      const sessionId = randomBytes(32).toString('hex');

      // Store session in Redis (30 days TTL)
      const sessionData = {
        userId: result.user.id,
        tenantId: result.user.tenantId,
        email: result.user.email,
        role: result.user.role,
        loginAt: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };

      await getRedisClient().setex(
        `session:${sessionId}`,
        30 * 24 * 60 * 60, // 30 days in seconds
        JSON.stringify(sessionData)
      );

      logger.info('Session created in Redis on login', {
        sessionId,
        userId: result.user.id,
        tenantId: result.user.tenantId,
        ipAddress: req.ip,
      });

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Set session ID cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      const response: ApiResponse = {
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
          sessionId, // Include session ID in response
        },
        message: 'Login successful',
        timestamp: new Date().toISOString(),
      };

      logger.info('User login endpoint called', {
        email,
        userId: result.user.id,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  public static refreshToken = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      // Get refresh token from cookie or body
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        throw new ValidationError('Refresh token is required');
      }

      // Refresh tokens
      const tokens = await AuthService.refreshToken({ refreshToken });

      // Update refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      const response: ApiResponse = {
        success: true,
        data: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        },
        message: 'Token refreshed successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Token refresh endpoint called');

      res.status(200).json(response);
    }
  );

  /**
   * Logout user
   * POST /api/auth/logout
   */
  public static logout = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      // Get user from auth middleware
      const userId = req.user?.userId;
      const tenantId = req.user?.tenantId;

      // Get session ID from cookie
      const sessionId = req.cookies?.sessionId;

      if (userId && tenantId) {
        await AuthService.logout(userId, tenantId);
      }

      // Delete session from Redis
      if (sessionId) {
        const deleted = await getRedisClient().del(`session:${sessionId}`);
        logger.info('Session deleted from Redis on logout', {
          sessionId,
          userId,
          tenantId,
          deleted: deleted > 0,
        });
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      // Clear session ID cookie
      res.clearCookie('sessionId', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      const response: ApiResponse = {
        success: true,
        message: 'Logout successful',
        timestamp: new Date().toISOString(),
      };

      logger.info('User logout endpoint called', {
        userId,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Verify email
   * POST /api/auth/verify-email
   */
  public static verifyEmail = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { userId, verificationToken } = req.body;
      const tenantId = req.tenantId || req.get('X-Tenant-ID');

      if (!userId || !verificationToken || !tenantId) {
        throw new ValidationError('Missing required fields', {
          userId: !userId ? 'User ID is required' : undefined,
          verificationToken: !verificationToken ? 'Verification token is required' : undefined,
          tenantId: !tenantId ? 'Tenant ID is required' : undefined,
        });
      }

      const user = await AuthService.verifyEmail({
        userId,
        tenantId,
        verificationToken,
      });

      const response: ApiResponse = {
        success: true,
        data: { user },
        message: 'Email verified successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Email verification endpoint called', {
        userId,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Request password reset
   * POST /api/auth/forgot-password
   */
  public static forgotPassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email } = req.body;
      const tenantId = req.tenantId || req.get('X-Tenant-ID');

      if (!email || !tenantId) {
        throw new ValidationError('Missing required fields', {
          email: !email ? 'Email is required' : undefined,
          tenantId: !tenantId ? 'Tenant ID is required' : undefined,
        });
      }

      await AuthService.requestPasswordReset(email, tenantId);

      // Always return success to prevent email enumeration
      const response: ApiResponse = {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent',
        timestamp: new Date().toISOString(),
      };

      logger.info('Password reset request endpoint called', {
        email,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Reset password
   * POST /api/auth/reset-password
   */
  public static resetPassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, resetToken, newPassword } = req.body;
      const tenantId = req.tenantId || req.get('X-Tenant-ID');

      if (!email || !resetToken || !newPassword || !tenantId) {
        throw new ValidationError('Missing required fields', {
          email: !email ? 'Email is required' : undefined,
          resetToken: !resetToken ? 'Reset token is required' : undefined,
          newPassword: !newPassword ? 'New password is required' : undefined,
          tenantId: !tenantId ? 'Tenant ID is required' : undefined,
        });
      }

      await AuthService.resetPassword({
        email,
        tenantId,
        resetToken,
        newPassword,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Password reset successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Password reset endpoint called', {
        email,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Change password (authenticated)
   * POST /api/auth/change-password
   */
  public static changePassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.userId;
      const tenantId = req.user?.tenantId;

      if (!currentPassword || !newPassword) {
        throw new ValidationError('Missing required fields', {
          currentPassword: !currentPassword ? 'Current password is required' : undefined,
          newPassword: !newPassword ? 'New password is required' : undefined,
        });
      }

      if (!userId || !tenantId) {
        throw new ValidationError('User not authenticated');
      }

      await AuthService.changePassword({
        userId,
        tenantId,
        currentPassword,
        newPassword,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Password change endpoint called', {
        userId,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  public static getProfile = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.userId;
      const tenantId = req.user?.tenantId;

      if (!userId || !tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const user = await AuthService.getProfile(userId, tenantId);

      const response: ApiResponse = {
        success: true,
        data: { user },
        timestamp: new Date().toISOString(),
      };

      logger.info('Get profile endpoint called', {
        userId,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Update user profile
   * PATCH /api/auth/profile
   */
  public static updateProfile = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { firstName, lastName } = req.body;
      const userId = req.user?.userId;
      const tenantId = req.user?.tenantId;

      if (!userId || !tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!firstName && !lastName) {
        throw new ValidationError('At least one field is required to update');
      }

      const user = await AuthService.updateProfile(userId, tenantId, {
        firstName,
        lastName,
      });

      const response: ApiResponse = {
        success: true,
        data: { user },
        message: 'Profile updated successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Update profile endpoint called', {
        userId,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Health check endpoint
   * GET /api/auth/health
   */
  public static healthCheck = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const response: ApiResponse = {
        success: true,
        data: {
          service: 'auth-service',
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get session info (for debugging)
   * GET /api/auth/session
   */
  public static getSession = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const sessionId = req.cookies?.sessionId;

      if (!sessionId) {
        throw new ValidationError('No active session');
      }

      const sessionData = await getRedisClient().get(`session:${sessionId}`);

      if (!sessionData) {
        throw new ValidationError('Session not found or expired');
      }

      const response: ApiResponse = {
        success: true,
        data: {
          sessionId,
          session: JSON.parse(sessionData),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get tenants list with optional search
   * GET /api/auth/tenants?search=keyword
   */
  public static getTenants = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const searchQuery = req.query.search as string | undefined;

      // Build SQL query
      let queryText = `
        SELECT
          id,
          name,
          billing_email as email,
          status,
          created_at as "createdAt"
        FROM tenants
        WHERE deleted_at IS NULL
      `;

      const params: any[] = [];

      // Add search filter if provided
      if (searchQuery) {
        queryText += ` AND (name ILIKE $1 OR billing_email ILIKE $1)`;
        params.push(`%${searchQuery}%`);
      }

      queryText += ` ORDER BY created_at DESC`;

      const tenants = await authDatabase.query<{
        id: string;
        name: string;
        email: string;
        status: string;
        createdAt: string;
      }>(queryText, params);

      const response: ApiResponse = {
        success: true,
        data: tenants,
        timestamp: new Date().toISOString(),
      };

      logger.info('Tenants list retrieved', {
        count: tenants.length,
        searchQuery,
      });

      res.status(200).json(response);
    }
  );
}