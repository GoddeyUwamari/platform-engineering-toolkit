/**
 * Multi-Tenancy Middleware
 * Handles tenant identification, validation, and context setting
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { queryOne, setTenantContext, getClient } from '../database/connection';
import { Tenant, TenantStatus, UserRole } from '../types';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  asyncHandler,
} from './error-handler';

// ============================================================================
// Configuration
// ============================================================================

enum TenantResolutionStrategy {
  SUBDOMAIN = 'subdomain',      // Extract from subdomain (tenant.cloudbill.com)
  HEADER = 'header',             // Extract from X-Tenant-ID header
  TOKEN = 'token',               // Extract from JWT token (req.user.tenantId)
  PARAM = 'param',               // Extract from URL parameter (:tenantId)
  AUTO = 'auto',                 // Try all strategies in order
}

const DEFAULT_STRATEGY = process.env.TENANT_RESOLUTION_STRATEGY as TenantResolutionStrategy || TenantResolutionStrategy.AUTO;

// ============================================================================
// Tenant Resolution Functions
// ============================================================================

/**
 * Extract tenant ID from subdomain
 * Example: tenant.cloudbill.com -> "tenant"
 */
const resolveTenantFromSubdomain = (req: Request): string | null => {
  const host = req.get('host') || '';
  const parts = host.split('.');

  // Need at least 3 parts for subdomain (tenant.cloudbill.com)
  if (parts.length < 3) {
    return null;
  }

  // Ignore 'www' subdomain
  const subdomain = parts[0];
  if (subdomain === 'www' || subdomain === 'api') {
    return null;
  }

  logger.debug('Tenant resolved from subdomain', { subdomain });
  return subdomain || null;
};

/**
 * Extract tenant ID from X-Tenant-ID header
 */
const resolveTenantFromHeader = (req: Request): string | null => {
  const tenantId = req.get('X-Tenant-ID') || req.get('x-tenant-id');
  
  if (tenantId) {
    logger.debug('Tenant resolved from header', { tenantId });
    return tenantId;
  }

  return null;
};

/**
 * Extract tenant ID from JWT token (req.user.tenantId)
 */
const resolveTenantFromToken = (req: Request): string | null => {
  const tenantId = req.user?.tenantId;
  
  if (tenantId) {
    logger.debug('Tenant resolved from JWT token', { tenantId });
    return tenantId;
  }

  return null;
};

/**
 * Extract tenant ID from URL parameter
 */
const resolveTenantFromParam = (req: Request): string | null => {
  const tenantId = req.params.tenantId || req.query.tenantId as string;
  
  if (tenantId) {
    logger.debug('Tenant resolved from URL parameter', { tenantId });
    return tenantId;
  }

  return null;
};

/**
 * Try all resolution strategies in order
 */
const resolveTenantAuto = (req: Request): string | null => {
  // Priority order: Token > Header > Subdomain > Param
  return (
    resolveTenantFromToken(req) ||
    resolveTenantFromHeader(req) ||
    resolveTenantFromSubdomain(req) ||
    resolveTenantFromParam(req)
  );
};

/**
 * Resolve tenant ID using specified strategy
 */
const resolveTenantId = (req: Request, strategy: TenantResolutionStrategy = DEFAULT_STRATEGY): string | null => {
  switch (strategy) {
    case TenantResolutionStrategy.SUBDOMAIN:
      return resolveTenantFromSubdomain(req);
    case TenantResolutionStrategy.HEADER:
      return resolveTenantFromHeader(req);
    case TenantResolutionStrategy.TOKEN:
      return resolveTenantFromToken(req);
    case TenantResolutionStrategy.PARAM:
      return resolveTenantFromParam(req);
    case TenantResolutionStrategy.AUTO:
      return resolveTenantAuto(req);
    default:
      return resolveTenantAuto(req);
  }
};

// ============================================================================
// Database Queries
// ============================================================================

/**
 * Fetch tenant by ID
 */
const getTenantById = async (tenantId: string): Promise<Tenant | null> => {
  const result = await queryOne<Tenant>(
    `SELECT 
      id, name, slug, plan, status, billing_email as "billingEmail",
      max_users as "maxUsers", settings, trial_ends_at as "trialEndsAt",
      created_at as "createdAt", updated_at as "updatedAt"
    FROM tenants 
    WHERE id = $1 AND deleted_at IS NULL`,
    [tenantId]
  );

  return result;
};

/**
 * Fetch tenant by slug (subdomain)
 */
const getTenantBySlug = async (slug: string): Promise<Tenant | null> => {
  const result = await queryOne<Tenant>(
    `SELECT 
      id, name, slug, plan, status, billing_email as "billingEmail",
      max_users as "maxUsers", settings, trial_ends_at as "trialEndsAt",
      created_at as "createdAt", updated_at as "updatedAt"
    FROM tenants 
    WHERE slug = $1 AND deleted_at IS NULL`,
    [slug]
  );

  return result;
};

/**
 * Validate tenant status
 */
const validateTenantStatus = (tenant: Tenant): void => {
  if (tenant.status === TenantStatus.SUSPENDED) {
    throw new AuthorizationError('Tenant account is suspended. Please contact support.');
  }

  if (tenant.status === TenantStatus.CANCELLED) {
    throw new AuthorizationError('Tenant account is cancelled.');
  }

  // Check trial expiry
  if (tenant.status === TenantStatus.TRIAL && tenant.trialEndsAt) {
    const trialEnd = new Date(tenant.trialEndsAt);
    const now = new Date();

    if (now > trialEnd) {
      throw new AuthorizationError('Trial period has expired. Please upgrade your plan.');
    }
  }
};

// ============================================================================
// Tenant Middleware
// ============================================================================

/**
 * Resolve and attach tenant to request (required)
 * Throws error if tenant cannot be resolved
 */
export const resolveTenant = (strategy: TenantResolutionStrategy = DEFAULT_STRATEGY) => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      // Resolve tenant ID
      const tenantId = resolveTenantId(req, strategy);

      if (!tenantId) {
        throw new AuthenticationError('Tenant identification required');
      }

      // Fetch tenant from database (try by ID first, then by slug)
      let tenant = await getTenantById(tenantId);

      if (!tenant) {
        // Maybe it's a slug (subdomain)
        tenant = await getTenantBySlug(tenantId);
      }

      if (!tenant) {
        throw new NotFoundError('Tenant');
      }

      // Validate tenant status
      validateTenantStatus(tenant);

      // Attach tenant to request
      req.tenant = tenant;
      req.tenantId = tenant.id;

      logger.info('Tenant resolved successfully', {
        tenantId: tenant.id,
        tenantName: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
      });

      next();
    }
  );
};

/**
 * Resolve tenant but don't fail if not found (optional)
 */
export const resolveOptionalTenant = (strategy: TenantResolutionStrategy = DEFAULT_STRATEGY) => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      const tenantId = resolveTenantId(req, strategy);

      if (!tenantId) {
        logger.debug('No tenant ID found, continuing without tenant context');
        next();
        return;
      }

      try {
        let tenant = await getTenantById(tenantId);

        if (!tenant) {
          tenant = await getTenantBySlug(tenantId);
        }

        if (tenant) {
          validateTenantStatus(tenant);
          req.tenant = tenant;
          req.tenantId = tenant.id;

          logger.debug('Optional tenant resolved', { tenantId: tenant.id });
        }
      } catch (error) {
        logger.warn('Failed to resolve optional tenant, continuing without tenant', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      next();
    }
  );
};

/**
 * Set database tenant context for Row-Level Security (RLS)
 * Use this AFTER resolveTenant middleware
 */
export const setDatabaseTenantContext = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.tenantId) {
      throw new AuthenticationError('Tenant context not set');
    }

    // Get database client
    const client = await getClient();

    try {
      // Set tenant context for this connection
      await setTenantContext(req.tenantId, client);

      logger.debug('Database tenant context set', { tenantId: req.tenantId });

      // Attach client to request for use in route handlers
      (req as any).dbClient = client;

      // Ensure client is released after response
      const response = _res as Response;
      response.on('finish', () => {
        client.release();
        logger.debug('Database client released');
      });

      next();
    } catch (error) {
      client.release();
      throw error;
    }
  }
);

/**
 * Validate user belongs to the resolved tenant
 * Use this AFTER requireAuth and resolveTenant
 */
export const validateUserTenant = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new AuthenticationError('User authentication required');
    }

    if (!req.tenantId) {
      throw new AuthenticationError('Tenant context not set');
    }

    // Super admins can access any tenant
    if (req.user.role === UserRole.SUPER_ADMIN) {
      logger.debug('Super admin accessing tenant', {
        userId: req.user.userId,
        tenantId: req.tenantId,
      });
      next();
      return;
    }

    // Validate user belongs to tenant
    if (req.user.tenantId !== req.tenantId) {
      logger.warn('User attempted to access different tenant', {
        userId: req.user.userId,
        userTenantId: req.user.tenantId,
        requestedTenantId: req.tenantId,
      });

      throw new AuthorizationError('Access denied to this tenant');
    }

    logger.debug('User tenant validation successful', {
      userId: req.user.userId,
      tenantId: req.tenantId,
    });

    next();
  }
);

/**
 * Check tenant plan limits
 * Example: Limit features based on plan (FREE, STARTER, PROFESSIONAL, ENTERPRISE)
 */
export const checkPlanLimit = (requiredPlan: string) => {
  const planHierarchy = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      if (!req.tenant) {
        throw new AuthenticationError('Tenant context required');
      }

      const userPlanIndex = planHierarchy.indexOf(req.tenant.plan);
      const requiredPlanIndex = planHierarchy.indexOf(requiredPlan);

      if (userPlanIndex < requiredPlanIndex) {
        logger.warn('Plan limit exceeded', {
          tenantId: req.tenant.id,
          currentPlan: req.tenant.plan,
          requiredPlan,
        });

        throw new AuthorizationError(
          `This feature requires ${requiredPlan} plan or higher. Please upgrade.`
        );
      }

      next();
    }
  );
};

/**
 * Check if tenant has reached user limit
 */
export const checkUserLimit = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.tenant) {
      throw new AuthenticationError('Tenant context required');
    }

    // Count active users in tenant
    const result = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND status = $2',
      [req.tenant.id, 'ACTIVE']
    );

    const currentUsers = parseInt(result?.count || '0', 10);

    if (currentUsers >= req.tenant.maxUsers) {
      logger.warn('Tenant user limit reached', {
        tenantId: req.tenant.id,
        currentUsers,
        maxUsers: req.tenant.maxUsers,
      });

      throw new AuthorizationError(
        `User limit reached (${req.tenant.maxUsers} users). Please upgrade your plan.`
      );
    }

    logger.debug('User limit check passed', {
      tenantId: req.tenant.id,
      currentUsers,
      maxUsers: req.tenant.maxUsers,
    });

    next();
  }
);

// ============================================================================
// Export
// ============================================================================

export default {
  // Resolution strategies
  TenantResolutionStrategy,

  // Middleware
  resolveTenant,
  resolveOptionalTenant,
  setDatabaseTenantContext,
  validateUserTenant,

  // Validation
  checkPlanLimit,
  checkUserLimit,

  // Utilities (for manual use)
  resolveTenantId,
  getTenantById,
  getTenantBySlug,
};