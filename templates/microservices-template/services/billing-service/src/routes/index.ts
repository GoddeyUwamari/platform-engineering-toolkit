import { Router } from 'express';
import invoiceRoutes from './invoice.routes';
import subscriptionRoutes from './subscription.routes';
import usageRoutes from './usage.routes';
import statsRoutes from './stats.routes';

const router = Router();

// Mount route modules with their respective prefixes
router.use('/invoices', invoiceRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/usage', usageRoutes);
router.use('/stats', statsRoutes);

export default router;
