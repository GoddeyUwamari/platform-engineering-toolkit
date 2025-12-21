import { Router } from 'express';
import { requireAuth } from '@shared/middleware/auth.middleware';
import { resolveTenant } from '@shared/middleware/tenant.middleware';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();

// Apply authentication and tenant middleware to all routes
router.use(requireAuth);
router.use(resolveTenant());

/**
 * Payment Intent Routes
 */

// Create a new payment intent
router.post('/intents', PaymentController.createPaymentIntent);

// Confirm a payment intent
router.post('/intents/:id/confirm', PaymentController.confirmPayment);

// Cancel a payment intent
router.post('/intents/:id/cancel', PaymentController.cancelPayment);

/**
 * Payment Routes
 */

// Get payment statistics
router.get('/stats', PaymentController.getPaymentStats);

// List payments with filters
router.get('/', PaymentController.listPayments);

// Get payment by ID
router.get('/:id', PaymentController.getPayment);

export default router;
