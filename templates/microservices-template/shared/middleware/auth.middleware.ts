/**
 * JWT Authentication Middleware
 * Validates JWT tokens and attaches user info to request
 */

import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { JwtPayload, UserRole, AuthenticatedUser } from '../types';
import {
  AuthenticationError,
  AuthorizationError,
  asyncHandler,
} from './error-handler';

// ============================================================================
// Configuration
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-key-change-this';

// ============================================================================
// Token Verification
// ============================================================================

/**
 * Verify and decode JWT token
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Access token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid access token');
    }
    throw new AuthenticationError('Token verification failed');
  }
};

/**
 * Verify and decode refresh token
 */
export const verifyRefreshToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid refresh token');
    }
    throw new AuthenticationError('Token verification failed');
  }
};

/**
 * Generate access token
 */
export const generateAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: 'cloudbill',
    audience: 'cloudbill-api',
  } as SignOptions);
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
  
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn,
    issuer: 'cloudbill',
    audience: 'cloudbill-api',
  } as SignOptions);
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokens = (payload: Omit<JwtPayload, 'iat' | 'exp'>) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Calculate expiry times
  const accessTokenExpiry = jwt.decode(accessToken) as JwtPayload;
  const refreshTokenExpiry = jwt.decode(refreshToken) as JwtPayload;

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: accessTokenExpiry.exp - accessTokenExpiry.iat,
    refreshTokenExpiresIn: refreshTokenExpiry.exp - refreshTokenExpiry.iat,
  };
};

// ============================================================================
// Token Extraction
// ============================================================================

/**
 * Extract token from Authorization header or cookies
 */
const extractToken = (req: Request): string | null => {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  // Check cookies (fallback)
  const cookieToken = req.cookies?.accessToken;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
};

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Require authentication - throws error if no valid token
 */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Extract token
    const token = extractToken(req);
    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Attach user context to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId,
      userAgent: req.get('user-agent'),
    } as AuthenticatedUser;

    logger.debug('User authenticated', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId,
    });

    next();
  }
);

/**
 * Optional authentication - attaches user if token exists, but doesn't fail if missing
 */
export const optionalAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = extractToken(req);

    if (token) {
      try {
        const decoded = verifyAccessToken(token);

        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          tenantId: decoded.tenantId,
          userAgent: req.get('user-agent'),
        } as AuthenticatedUser;

        logger.debug('Optional auth: User authenticated', {
          userId: decoded.userId,
        });
      } catch (error) {
        // Token invalid, but we don't fail - just continue without user
        logger.debug('Optional auth: Invalid token, continuing without user');
      }
    }

    next();
  }
);

// ============================================================================
// Authorization Middleware (Role-Based Access Control)
// ============================================================================

/**
 * Require specific role(s)
 * Usage: router.get('/admin', requireAuth, requireRole('ADMIN'), handler)
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      // Check if user is authenticated
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Check if user has required role
      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Authorization failed - insufficient permissions', {
          userId: req.user.userId,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
        });

        throw new AuthorizationError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        );
      }

      logger.debug('Authorization successful', {
        userId: req.user.userId,
        userRole: req.user.role,
      });

      next();
    }
  );
};

/**
 * Require admin role (SUPER_ADMIN or ADMIN)
 */
export const requireAdmin = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN);

/**
 * Require billing admin role or higher
 */
export const requireBillingAdmin = requireRole(
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BILLING_ADMIN
);

/**
 * Require super admin only
 */
export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);

// ============================================================================
// Tenant Validation
// ============================================================================

/**
 * Ensure user belongs to the tenant specified in request params
 * Usage: router.get('/tenants/:tenantId/users', requireAuth, validateTenantAccess, handler)
 */
export const validateTenantAccess = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const requestedTenantId = req.params.tenantId || req.body.tenantId;

    // Super admins can access any tenant
    if (req.user.role === UserRole.SUPER_ADMIN) {
      next();
      return;
    }

    // Regular users can only access their own tenant
    if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
      logger.warn('Tenant access denied', {
        userId: req.user.userId,
        userTenantId: req.user.tenantId,
        requestedTenantId,
      });

      throw new AuthorizationError('Access denied to this tenant');
    }

    next();
  }
);

/**
 * Ensure user can only access their own resources
 * Usage: router.get('/users/:userId', requireAuth, validateResourceOwnership, handler)
 */
export const validateResourceOwnership = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const requestedUserId = req.params.userId || req.body.userId;

    // Admins can access any user's resources
    if (
      req.user.role === UserRole.SUPER_ADMIN ||
      req.user.role === UserRole.ADMIN
    ) {
      next();
      return;
    }

    // Regular users can only access their own resources
    if (requestedUserId && requestedUserId !== req.user.userId) {
      logger.warn('Resource ownership validation failed', {
        userId: req.user.userId,
        requestedUserId,
      });

      throw new AuthorizationError('Access denied to this resource');
    }

    next();
  }
);

// ============================================================================
// Rate Limiting Helper
// ============================================================================

/**
 * Get rate limit key for user
 */
export const getRateLimitKey = (req: Request): string => {
  if (req.user) {
    return `ratelimit:user:${req.user.userId}`;
  }
  return `ratelimit:ip:${req.ip}`;
};

// ============================================================================
// Export
// ============================================================================

export default {
  // Token functions
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  generateTokens,

  // Authentication middleware
  requireAuth,
  optionalAuth,

  // Authorization middleware
  requireRole,
  requireAdmin,
  requireBillingAdmin,
  requireSuperAdmin,

  // Validation middleware
  validateTenantAccess,
  validateResourceOwnership,

  // Utilities
  getRateLimitKey,
};