import { UUID, NotificationStatus } from '@shared/types';
import { logger } from '@shared/utils/logger';
import { NotFoundError } from '@shared/middleware/error-handler';
import { notificationDatabase } from '../config/database.config';
import {
  NotificationModel,
  Notification,
  CreateNotificationDTO,
  UpdateNotificationDTO,
  NotificationFilters,
  mapNotificationFromDB,
  mapNotificationsFromDB,
  DEFAULT_MAX_RETRIES,
} from '../models/notification.model';

/**
 * Notification Repository
 * Handles database operations for notifications
 */

class NotificationRepository {
  /**
   * Create a new notification
   */
  async create(notificationData: CreateNotificationDTO): Promise<Notification> {
    const {
      tenantId,
      userId,
      type,
      subject,
      body,
      recipient,
      templateId,
      metadata,
      maxRetries = DEFAULT_MAX_RETRIES,
    } = notificationData;

    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        INSERT INTO notifications (
          tenant_id, user_id, type, subject, body, recipient,
          template_id, metadata, status, retry_count, max_retries
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        tenantId,
        userId || null,
        type,
        subject || null,
        body,
        recipient,
        templateId || null,
        metadata ? JSON.stringify(metadata) : null,
        NotificationStatus.PENDING,
        0, // retry_count
        maxRetries,
      ];

      const result = await notificationDatabase.queryOne<NotificationModel>(query, values);

      if (!result) {
        throw new Error('Failed to create notification');
      }

      logger.info('Notification created', {
        notificationId: result.id,
        tenantId,
        type,
      });

      return mapNotificationFromDB(result);
    } catch (error) {
      logger.error('Error creating notification', {
        tenantId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find notification by ID
   */
  async findById(id: UUID, tenantId: UUID): Promise<Notification> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        SELECT * FROM notifications
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await notificationDatabase.queryOne<NotificationModel>(query, [id]);

      if (!result) {
        throw new NotFoundError('Notification');
      }

      return mapNotificationFromDB(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Error finding notification by ID', {
        notificationId: id,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find notifications by tenant with filters
   */
  async findByTenant(tenantId: UUID, filters: NotificationFilters = {}): Promise<Notification[]> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const conditions: string[] = ['deleted_at IS NULL'];
      const values: any[] = [];
      let paramCount = 0;

      // Apply filters
      if (filters.type) {
        paramCount++;
        conditions.push(`type = $${paramCount}`);
        values.push(filters.type);
      }

      if (filters.status) {
        paramCount++;
        conditions.push(`status = $${paramCount}`);
        values.push(filters.status);
      }

      if (filters.userId) {
        paramCount++;
        conditions.push(`user_id = $${paramCount}`);
        values.push(filters.userId);
      }

      if (filters.templateId) {
        paramCount++;
        conditions.push(`template_id = $${paramCount}`);
        values.push(filters.templateId);
      }

      if (filters.recipient) {
        paramCount++;
        conditions.push(`recipient ILIKE $${paramCount}`);
        values.push(`%${filters.recipient}%`);
      }

      if (filters.startDate) {
        paramCount++;
        conditions.push(`created_at >= $${paramCount}`);
        values.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        conditions.push(`created_at <= $${paramCount}`);
        values.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;

      const query = `
        SELECT * FROM notifications
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      values.push(limit, offset);

      const results = await notificationDatabase.query<NotificationModel>(query, values);

      return mapNotificationsFromDB(results);
    } catch (error) {
      logger.error('Error finding notifications by tenant', {
        tenantId,
        filters,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update notification
   */
  async update(id: UUID, tenantId: UUID, updates: UpdateNotificationDTO): Promise<Notification> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (updates.status !== undefined) {
        paramCount++;
        fields.push(`status = $${paramCount}`);
        values.push(updates.status);
      }

      if (updates.sentAt !== undefined) {
        paramCount++;
        fields.push(`sent_at = $${paramCount}`);
        values.push(updates.sentAt);
      }

      if (updates.deliveredAt !== undefined) {
        paramCount++;
        fields.push(`delivered_at = $${paramCount}`);
        values.push(updates.deliveredAt);
      }

      if (updates.failureReason !== undefined) {
        paramCount++;
        fields.push(`failure_reason = $${paramCount}`);
        values.push(updates.failureReason);
      }

      if (updates.retryCount !== undefined) {
        paramCount++;
        fields.push(`retry_count = $${paramCount}`);
        values.push(updates.retryCount);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      // Add updated_at
      paramCount++;
      fields.push(`updated_at = $${paramCount}`);
      values.push(new Date());

      // Add id parameter
      paramCount++;
      values.push(id);

      const query = `
        UPDATE notifications
        SET ${fields.join(', ')}
        WHERE id = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await notificationDatabase.queryOne<NotificationModel>(query, values);

      if (!result) {
        throw new NotFoundError('Notification');
      }

      logger.info('Notification updated', {
        notificationId: id,
        tenantId,
        updates,
      });

      return mapNotificationFromDB(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Error updating notification', {
        notificationId: id,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(id: UUID, tenantId: UUID): Promise<Notification> {
    return this.update(id, tenantId, {
      status: NotificationStatus.SENT,
      sentAt: new Date(),
    });
  }

  /**
   * Mark notification as delivered
   */
  async markAsDelivered(id: UUID, tenantId: UUID): Promise<Notification> {
    return this.update(id, tenantId, {
      status: NotificationStatus.DELIVERED,
      deliveredAt: new Date(),
    });
  }

  /**
   * Mark notification as failed
   */
  async markAsFailed(id: UUID, tenantId: UUID, failureReason: string): Promise<Notification> {
    return this.update(id, tenantId, {
      status: NotificationStatus.FAILED,
      failureReason,
    });
  }

  /**
   * Increment retry count
   */
  async incrementRetryCount(id: UUID, tenantId: UUID): Promise<Notification> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        UPDATE notifications
        SET retry_count = retry_count + 1, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await notificationDatabase.queryOne<NotificationModel>(query, [id]);

      if (!result) {
        throw new NotFoundError('Notification');
      }

      return mapNotificationFromDB(result);
    } catch (error) {
      logger.error('Error incrementing retry count', {
        notificationId: id,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get pending notifications for retry
   */
  async getPendingForRetry(tenantId: UUID, limit: number = 100): Promise<Notification[]> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        SELECT * FROM notifications
        WHERE status IN ($1, $2)
          AND retry_count < max_retries
          AND deleted_at IS NULL
        ORDER BY created_at ASC
        LIMIT $3
      `;

      const results = await notificationDatabase.query<NotificationModel>(
        query,
        [NotificationStatus.PENDING, NotificationStatus.FAILED, limit]
      );

      return mapNotificationsFromDB(results);
    } catch (error) {
      logger.error('Error getting pending notifications for retry', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getStats(tenantId: UUID): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        SELECT
          COUNT(*) as total,
          type,
          status,
          COUNT(*) OVER (PARTITION BY type) as type_count,
          COUNT(*) OVER (PARTITION BY status) as status_count
        FROM notifications
        WHERE deleted_at IS NULL
        GROUP BY type, status
      `;

      const results = await notificationDatabase.query<any>(query);

      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      let total = 0;

      for (const row of results) {
        byType[row.type] = parseInt(row.type_count, 10);
        byStatus[row.status] = parseInt(row.status_count, 10);
        total = Math.max(total, parseInt(row.total, 10));
      }

      return { total, byType, byStatus };
    } catch (error) {
      logger.error('Error getting notification stats', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Soft delete notification
   */
  async delete(id: UUID, tenantId: UUID): Promise<void> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        UPDATE notifications
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id
      `;

      const result = await notificationDatabase.queryOne<{ id: UUID }>(query, [id]);

      if (!result) {
        throw new NotFoundError('Notification');
      }

      logger.info('Notification deleted', {
        notificationId: id,
        tenantId,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Error deleting notification', {
        notificationId: id,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get count of notifications matching filters
   */
  async getCount(tenantId: UUID, filters: NotificationFilters = {}): Promise<number> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const conditions: string[] = ['deleted_at IS NULL'];
      const values: any[] = [];
      let paramCount = 0;

      // Apply filters (same logic as findByTenant)
      if (filters.type) {
        paramCount++;
        conditions.push(`type = $${paramCount}`);
        values.push(filters.type);
      }

      if (filters.status) {
        paramCount++;
        conditions.push(`status = $${paramCount}`);
        values.push(filters.status);
      }

      if (filters.userId) {
        paramCount++;
        conditions.push(`user_id = $${paramCount}`);
        values.push(filters.userId);
      }

      if (filters.templateId) {
        paramCount++;
        conditions.push(`template_id = $${paramCount}`);
        values.push(filters.templateId);
      }

      if (filters.recipient) {
        paramCount++;
        conditions.push(`recipient ILIKE $${paramCount}`);
        values.push(`%${filters.recipient}%`);
      }

      if (filters.startDate) {
        paramCount++;
        conditions.push(`created_at >= $${paramCount}`);
        values.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        conditions.push(`created_at <= $${paramCount}`);
        values.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT COUNT(*) as count FROM notifications
        ${whereClause}
      `;

      const result = await notificationDatabase.queryOne<{ count: string }>(query, values);

      return parseInt(result?.count || '0', 10);
    } catch (error) {
      logger.error('Error getting notification count', {
        tenantId,
        filters,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Reset a failed notification for retry
   */
  async resetForRetry(id: UUID, tenantId: UUID): Promise<Notification> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        UPDATE notifications
        SET
          status = $1,
          failure_reason = NULL,
          retry_count = retry_count + 1,
          updated_at = NOW()
        WHERE id = $2 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await notificationDatabase.queryOne<NotificationModel>(
        query,
        [NotificationStatus.PENDING, id]
      );

      if (!result) {
        throw new NotFoundError('Notification');
      }

      logger.info('Notification reset for retry', {
        notificationId: id,
        tenantId,
        retryCount: result.retry_count,
      });

      return mapNotificationFromDB(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Error resetting notification for retry', {
        notificationId: id,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clean up old notifications (hard delete)
   */
  async cleanupOld(tenantId: UUID, olderThanDays: number): Promise<number> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        DELETE FROM notifications
        WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
          AND deleted_at IS NOT NULL
        RETURNING id
      `;

      const results = await notificationDatabase.query<{ id: UUID }>(query);

      logger.info('Old notifications cleaned up', {
        tenantId,
        olderThanDays,
        count: results.length,
      });

      return results.length;
    } catch (error) {
      logger.error('Error cleaning up old notifications', {
        tenantId,
        olderThanDays,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Export singleton instance
export const notificationRepository = new NotificationRepository();

// Export class for testing
export { NotificationRepository };
