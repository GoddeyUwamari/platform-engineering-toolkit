import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ApiResponse } from '@shared/types';
import {
  ValidationError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import { notificationRepository } from '../repositories/notification.repository';
import { CreateNotificationDTO, NotificationFilters } from '../models/notification.model';

/**
 * Notification Controller
 * Handles HTTP requests for notification management
 */

export class NotificationController {
  /**
   * Create a new notification
   * POST /api/notifications
   */
  public static createNotification = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { type, subject, body, recipient, userId, templateId, metadata, maxRetries } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!type || !body || !recipient) {
        throw new ValidationError('Missing required fields', {
          type: !type ? 'Type is required' : undefined,
          body: !body ? 'Body is required' : undefined,
          recipient: !recipient ? 'Recipient is required' : undefined,
        });
      }

      const notificationData: CreateNotificationDTO = {
        tenantId,
        userId,
        type,
        subject,
        body,
        recipient,
        templateId,
        metadata,
        maxRetries,
      };

      const notification = await notificationRepository.create(notificationData);

      const response: ApiResponse = {
        success: true,
        data: { notification },
        message: 'Notification created successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Notification created via API', {
        notificationId: notification.id,
        tenantId,
        type,
      });

      res.status(201).json(response);
    }
  );

  /**
   * Get notification by ID
   * GET /api/notifications/:id
   */
  public static getNotificationById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!id) {
        throw new ValidationError('Notification ID is required');
      }

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const notification = await notificationRepository.findById(id, tenantId!);

      const response: ApiResponse = {
        success: true,
        data: { notification },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get all notifications for tenant
   * GET /api/notifications
   */
  public static getNotifications = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const filters: NotificationFilters = {
        type: req.query.type as any,
        status: req.query.status as any,
        userId: req.query.userId as string,
        templateId: req.query.templateId as string,
        recipient: req.query.recipient as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const notifications = await notificationRepository.findByTenant(tenantId, filters);
      const total = await notificationRepository.getCount(tenantId, filters);

      const response: ApiResponse = {
        success: true,
        data: {
          notifications,
          total,
          limit: filters.limit,
          offset: filters.offset,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get notification statistics
   * GET /api/notifications/stats
   */
  public static getNotificationStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const stats = await notificationRepository.getStats(tenantId);

      const response: ApiResponse = {
        success: true,
        data: { stats },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );

  /**
   * Retry failed notification
   * POST /api/notifications/:id/retry
   */
  public static retryNotification = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!id) {
        throw new ValidationError('Notification ID is required');
      }

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const notification = await notificationRepository.resetForRetry(id, tenantId!);

      const response: ApiResponse = {
        success: true,
        data: { notification },
        message: 'Notification queued for retry',
        timestamp: new Date().toISOString(),
      };

      logger.info('Notification retry requested', {
        notificationId: id,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  public static deleteNotification = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!id) {
        throw new ValidationError('Notification ID is required');
      }

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      await notificationRepository.delete(id, tenantId!);

      const response: ApiResponse = {
        success: true,
        message: 'Notification deleted successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Notification deleted', {
        notificationId: id,
        tenantId,
      });

      res.status(200).json(response);
    }
  );
}
