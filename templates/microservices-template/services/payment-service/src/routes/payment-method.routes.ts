import { Router } from 'express';
import { requireAuth } from '@shared/middleware/auth.middleware';
import { resolveTenant } from '@shared/middleware/tenant.middleware';
import { PaymentMethodController } from '../controllers/payment-method.controller';

const router = Router();

// Apply authentication and tenant middleware to all routes
router.use(requireAuth);
router.use(resolveTenant());

/**
 * Payment Method Routes
 */

// Get default payment method
router.get('/default', PaymentMethodController.getDefaultPaymentMethod);

// Create a new payment method
router.post('/', PaymentMethodController.createPaymentMethod);

// List payment methods
router.get('/', PaymentMethodController.listPaymentMethods);

// Get payment method by ID
router.get('/:id', PaymentMethodController.getPaymentMethod);

// Update payment method
router.patch('/:id', PaymentMethodController.updatePaymentMethod);

// Delete payment method
router.delete('/:id', PaymentMethodController.deletePaymentMethod);

// Set payment method as default
router.post('/:id/default', PaymentMethodController.setDefaultPaymentMethod);

export default router;
