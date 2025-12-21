/**
 * Express type augmentation for Auth Service
 */

import { Tenant, AuthenticatedUser } from '../../../shared/types';

declare global {
  namespace Express {
    interface Request {
      // User authentication context
      user?: AuthenticatedUser;

      // Tenant context (must match shared/middleware/tenant.middleware.ts)
      tenant?: Tenant;
      tenantId?: string;
    }
  }
}

export {};
