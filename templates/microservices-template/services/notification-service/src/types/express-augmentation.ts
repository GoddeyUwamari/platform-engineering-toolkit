import { AuthenticatedUser } from '@shared/types';

/**
 * Express Request Type Augmentation
 * Extends Express Request interface to include user authentication data
 *
 * Note: This re-exports the shared type augmentation to ensure it's available
 * in this service's TypeScript context.
 */

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
