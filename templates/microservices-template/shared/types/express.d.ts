/**
 * Express type augmentation for shared middleware
 */

import { Tenant, AuthenticatedUser } from './index';

declare global {
  namespace Express {
    interface Request {
      // User authentication context
      user?: AuthenticatedUser;

      // Tenant context
      tenant?: Tenant;
      tenantId?: string;
    }
  }
}

export {};
