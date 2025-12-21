import { Router } from 'express';
import {
  getDashboardStats,
  getSubscriptionsList,
  getInvoicesList,
  getRevenueTimeline,
} from '../controllers/stats.controller';

const router = Router();

// Dashboard stats endpoint
router.get('/dashboard', getDashboardStats);

// Subscriptions list endpoint (with tenant names joined)
router.get('/subscriptions', getSubscriptionsList);

// Invoices list endpoint (with tenant names joined)
router.get('/invoices', getInvoicesList);

// Revenue timeline endpoint (for chart visualization)
router.get('/revenue-timeline', getRevenueTimeline);

export default router;
