import { UUID, NotificationType } from '@shared/types';
import { logger } from '@shared/utils/logger';
import { NotFoundError, ConflictError } from '@shared/middleware/error-handler';
import { notificationDatabase } from '../config/database.config';
import {
  NotificationTemplateModel,
  NotificationTemplate,
  CreateTemplateDTO,
  UpdateTemplateDTO,
  TemplateFilters,
  mapTemplateFromDB,
  mapTemplatesFromDB,
} from '../models/template.model';

/**
 * Notification Template Repository
 * Handles database operations for notification templates
 */

class TemplateRepository {
  /**
   * Create a new template
   */
  async create(templateData: CreateTemplateDTO): Promise<NotificationTemplate> {
    const {
      tenantId,
      name,
      slug,
      type,
      subject,
      body,
      description,
      variables,
      language = 'en',
      metadata,
      createdBy,
    } = templateData;

    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      // Check if slug already exists
      const existingTemplate = await this.findBySlug(slug, tenantId).catch(() => null);
      if (existingTemplate) {
        throw new ConflictError('Template with this slug already exists');
      }

      const query = `
        INSERT INTO notification_templates (
          tenant_id, name, slug, type, subject, body, description,
          variables, language, metadata, created_by, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const values = [
        tenantId,
        name,
        slug,
        type,
        subject || null,
        body,
        description || null,
        variables ? JSON.stringify(variables) : null,
        language,
        metadata ? JSON.stringify(metadata) : null,
        createdBy || null,
        true, // is_active
      ];

      const result = await notificationDatabase.queryOne<NotificationTemplateModel>(query, values);

      if (!result) {
        throw new Error('Failed to create template');
      }

      logger.info('Template created', {
        templateId: result.id,
        tenantId,
        slug,
        type,
      });

      return mapTemplateFromDB(result);
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }

      logger.error('Error creating template', {
        tenantId,
        slug,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find template by ID
   */
  async findById(id: UUID, tenantId: UUID): Promise<NotificationTemplate> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        SELECT * FROM notification_templates
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await notificationDatabase.queryOne<NotificationTemplateModel>(query, [id]);

      if (!result) {
        throw new NotFoundError('Template');
      }

      return mapTemplateFromDB(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Error finding template by ID', {
        templateId: id,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find template by slug
   */
  async findBySlug(slug: string, tenantId: UUID): Promise<NotificationTemplate> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        SELECT * FROM notification_templates
        WHERE slug = $1 AND deleted_at IS NULL
      `;

      const result = await notificationDatabase.queryOne<NotificationTemplateModel>(query, [slug]);

      if (!result) {
        throw new NotFoundError('Template');
      }

      return mapTemplateFromDB(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Error finding template by slug', {
        slug,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find templates by tenant with filters
   */
  async findByTenant(tenantId: UUID, filters: TemplateFilters = {}): Promise<NotificationTemplate[]> {
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

      if (filters.isActive !== undefined) {
        paramCount++;
        conditions.push(`is_active = $${paramCount}`);
        values.push(filters.isActive);
      }

      if (filters.language) {
        paramCount++;
        conditions.push(`language = $${paramCount}`);
        values.push(filters.language);
      }

      if (filters.search) {
        paramCount++;
        conditions.push(`(name ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
        values.push(`%${filters.search}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;

      const query = `
        SELECT * FROM notification_templates
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      values.push(limit, offset);

      const results = await notificationDatabase.query<NotificationTemplateModel>(query, values);

      return mapTemplatesFromDB(results);
    } catch (error) {
      logger.error('Error finding templates by tenant', {
        tenantId,
        filters,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update template
   */
  async update(id: UUID, tenantId: UUID, updates: UpdateTemplateDTO): Promise<NotificationTemplate> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (updates.name !== undefined) {
        paramCount++;
        fields.push(`name = $${paramCount}`);
        values.push(updates.name);
      }

      if (updates.subject !== undefined) {
        paramCount++;
        fields.push(`subject = $${paramCount}`);
        values.push(updates.subject);
      }

      if (updates.body !== undefined) {
        paramCount++;
        fields.push(`body = $${paramCount}`);
        values.push(updates.body);
      }

      if (updates.description !== undefined) {
        paramCount++;
        fields.push(`description = $${paramCount}`);
        values.push(updates.description);
      }

      if (updates.variables !== undefined) {
        paramCount++;
        fields.push(`variables = $${paramCount}`);
        values.push(JSON.stringify(updates.variables));
      }

      if (updates.isActive !== undefined) {
        paramCount++;
        fields.push(`is_active = $${paramCount}`);
        values.push(updates.isActive);
      }

      if (updates.language !== undefined) {
        paramCount++;
        fields.push(`language = $${paramCount}`);
        values.push(updates.language);
      }

      if (updates.metadata !== undefined) {
        paramCount++;
        fields.push(`metadata = $${paramCount}`);
        values.push(JSON.stringify(updates.metadata));
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
        UPDATE notification_templates
        SET ${fields.join(', ')}
        WHERE id = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await notificationDatabase.queryOne<NotificationTemplateModel>(query, values);

      if (!result) {
        throw new NotFoundError('Template');
      }

      logger.info('Template updated', {
        templateId: id,
        tenantId,
        updates,
      });

      return mapTemplateFromDB(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Error updating template', {
        templateId: id,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Toggle template active status
   */
  async toggleActive(id: UUID, tenantId: UUID): Promise<NotificationTemplate> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        UPDATE notification_templates
        SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await notificationDatabase.queryOne<NotificationTemplateModel>(query, [id]);

      if (!result) {
        throw new NotFoundError('Template');
      }

      logger.info('Template active status toggled', {
        templateId: id,
        tenantId,
        isActive: result.is_active,
      });

      return mapTemplateFromDB(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Error toggling template active status', {
        templateId: id,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get template count by type
   */
  async getCountByType(tenantId: UUID): Promise<Record<NotificationType, number>> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        SELECT type, COUNT(*) as count
        FROM notification_templates
        WHERE deleted_at IS NULL
        GROUP BY type
      `;

      const results = await notificationDatabase.query<{ type: NotificationType; count: string }>(query);

      const counts: Record<string, number> = {};
      for (const row of results) {
        counts[row.type] = parseInt(row.count, 10);
      }

      return counts as Record<NotificationType, number>;
    } catch (error) {
      logger.error('Error getting template count by type', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Soft delete template
   */
  async delete(id: UUID, tenantId: UUID): Promise<void> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        UPDATE notification_templates
        SET deleted_at = NOW(), updated_at = NOW(), is_active = false
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id
      `;

      const result = await notificationDatabase.queryOne<{ id: UUID }>(query, [id]);

      if (!result) {
        throw new NotFoundError('Template');
      }

      logger.info('Template deleted', {
        templateId: id,
        tenantId,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Error deleting template', {
        templateId: id,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get all active templates by type
   */
  async getActiveByType(tenantId: UUID, type: NotificationType): Promise<NotificationTemplate[]> {
    try {
      // Set tenant context
      await notificationDatabase.setTenantContext(tenantId);

      const query = `
        SELECT * FROM notification_templates
        WHERE type = $1 AND is_active = true AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;

      const results = await notificationDatabase.query<NotificationTemplateModel>(query, [type]);

      return mapTemplatesFromDB(results);
    } catch (error) {
      logger.error('Error getting active templates by type', {
        tenantId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Export singleton instance
export const templateRepository = new TemplateRepository();

// Export class for testing
export { TemplateRepository };
