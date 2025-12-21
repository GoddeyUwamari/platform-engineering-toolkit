import { Router } from 'express';
import notificationRoutes from './notifications.routes';
import emailRoutes from './email.routes';
import smsRoutes from './sms.routes';
import webhookRoutes from './webhook.routes';
import templateRoutes from './template.routes';

/**
 * API Routes Index
 * Combines all route modules
 */

const router = Router();

// Mount route modules
router.use('/notifications', notificationRoutes);
router.use('/email', emailRoutes);
router.use('/sms', smsRoutes);
router.use('/webhook', webhookRoutes);
router.use('/templates', templateRoutes);

// Health check endpoint (no auth required)
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'notification-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
