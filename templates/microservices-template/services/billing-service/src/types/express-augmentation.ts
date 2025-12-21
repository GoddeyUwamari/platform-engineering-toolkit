/**
 * Express type augmentation for Billing Service
 */

import { Tenant, AuthenticatedUser } from '@shared/types';

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
