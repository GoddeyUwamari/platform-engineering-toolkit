/**
 * Express Type Augmentation
 * Extends Express Request type with custom properties
 */

import { UserRole, Tenant } from '@shared/types';

declare global {
  namespace Express {
    interface User {
      userId: string;
      tenantId: string;
      email: string;
      role: UserRole;
      iat?: number;
      exp?: number;
    }

    interface Request {
      user?: User;
      tenant?: Tenant;
      tenantId?: string;
      requestMetadata?: {
        requestId: string;
        timestamp: string;
        userAgent?: string;
        ip?: string;
        method: string;
        path: string;
      };
      idempotencyKey?: string;
      rawBody?: string | Buffer;
    }
  }
}

export {};
