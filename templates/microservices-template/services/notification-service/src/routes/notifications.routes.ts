import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import {
  requireAuth,
  validateNotificationCreation,
  validateUUIDParam,
  validateQueryParams,
  apiRateLimit,
  addTenantContext,
  addRequestMetadata,
  logNotificationRequest,
} from '../middleware';

/**
 * Notification Routes
 * Defines all notification management endpoints
 */

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(addTenantContext);
router.use(addRequestMetadata);
router.use(apiRateLimit);

/**
 * @route   POST /api/notifications
 * @desc    Create a new notification
 * @access  Private
 */
router.post('/', validateNotificationCreation, logNotificationRequest, NotificationController.createNotification);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private
 */
router.get('/stats', NotificationController.getNotificationStats);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get notification by ID
 * @access  Private
 */
router.get('/:id', validateUUIDParam('id'), NotificationController.getNotificationById);

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for tenant
 * @access  Private
 */
router.get('/', validateQueryParams, NotificationController.getNotifications);

/**
 * @route   POST /api/notifications/:id/retry
 * @desc    Retry a failed notification
 * @access  Private
 */
router.post('/:id/retry', validateUUIDParam('id'), NotificationController.retryNotification);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', validateUUIDParam('id'), NotificationController.deleteNotification);

export default router;
