import { Router } from 'express';
import paymentRoutes from './payment.routes';
import paymentMethodRoutes from './payment-method.routes';
import refundRoutes from './refund.routes';
import webhookRoutes from './webhook.routes';

const router = Router();

// Mount route modules
// Note: Main index.ts mounts this router at /api/payments
// IMPORTANT: Mount specific routes BEFORE generic routes to avoid conflicts
// Order matters: more specific routes must come before catch-all routes like /:id

// Mount specific sub-routes first
router.use('/payment-methods', paymentMethodRoutes);
router.use('/refunds', refundRoutes);
router.use('/webhooks', webhookRoutes);

// Mount payment routes last (includes /:id catch-all)
router.use('/', paymentRoutes);

export default router;
