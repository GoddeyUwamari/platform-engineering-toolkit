import { Router } from 'express';
import { requireAuth } from '@shared/middleware/auth.middleware';
import { resolveTenant } from '@shared/middleware/tenant.middleware';
import { RefundController } from '../controllers/refund.controller';

const router = Router();

// Apply authentication and tenant middleware to all routes
router.use(requireAuth);
router.use(resolveTenant());

/**
 * Refund Routes
 */

// Get refund statistics
router.get('/stats', RefundController.getRefundStats);

// Create a new refund
router.post('/', RefundController.createRefund);

// List refunds with filters
router.get('/', RefundController.listRefunds);

// Get refund by ID
router.get('/:id', RefundController.getRefund);

export default router;
