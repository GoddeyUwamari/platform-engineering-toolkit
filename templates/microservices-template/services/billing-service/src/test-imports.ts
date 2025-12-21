/**
 * Quick test to verify @shared imports work correctly
 * Run with: npm run dev
 */

import { logger } from '@shared/utils/logger';
import { NotFoundError } from '@shared/middleware/error-handler';
import type { BaseEntity } from '@shared/types';

// Test logger
logger.info('✅ Logger import works!');

// Test types
const testEntity: BaseEntity = {
  id: '123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

logger.info('✅ Types import works!', { entity: testEntity });

// Test error classes
const testError = new NotFoundError('Test entity');
logger.info('✅ Error handler import works!', { errorName: testError.name });

logger.info('🎉 All @shared imports working correctly!');

export {};