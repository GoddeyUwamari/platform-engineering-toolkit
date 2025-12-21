import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ApiResponse } from '@shared/types';
import {
  ValidationError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import { templateService } from '../services/template.service';
import { CreateTemplateDTO, UpdateTemplateDTO, TemplateFilters } from '../models/template.model';

/**
 * Template Controller
 * Handles HTTP requests for notification template management
 */

export class TemplateController {
  /**
   * Create a new template
   * POST /api/templates
   */
  public static createTemplate = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { name, slug, type, subject, body, description, variables } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!name || !type || !body) {
        throw new ValidationError('Missing required fields', {
          name: !name ? 'Name is required' : undefined,
          type: !type ? 'Type is required' : undefined,
          body: !body ? 'Body is required' : undefined,
        });
      }

      const templateData: CreateTemplateDTO = {
        tenantId,
        name,
        slug,
        type,
        subject,
        body,
        description,
        variables,
      };

      const template = await templateService.createTemplate(templateData);

      const response: ApiResponse = {
        success: true,
        data: { template },
        message: 'Template created successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Template created via API', {
        templateId: template.id,
        tenantId,
        slug: template.slug,
      });

      res.status(201).json(response);
    }
  );

  /**
   * Get template by ID
   * GET /api/templates/:id
   */
  public static getTemplateById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!id) {
        throw new ValidationError('Template ID is required');
      }

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const template = await templateService.getTemplateById(id, tenantId!);

      const response: ApiResponse = {
        success: true,
        data: { template },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get template by slug
   * GET /api/templates/slug/:slug
   */
  public static getTemplateBySlug = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { slug } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const template = await templateService.getTemplateBySlug(slug!, tenantId);

      const response: ApiResponse = {
        success: true,
        data: { template },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get all templates for tenant
   * GET /api/templates
   */
  public static getTemplates = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const filters: TemplateFilters = {
        type: req.query.type as any,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        search: req.query.search as string,
      };

      const templates = await templateService.getTemplatesByTenant(tenantId, filters);

      const response: ApiResponse = {
        success: true,
        data: {
          templates,
          total: templates.length,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );

  /**
   * Update a template
   * PUT /api/templates/:id
   */
  public static updateTemplate = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { name, subject, body, description, isActive } = req.body;
      const tenantId = req.user?.tenantId;

      if (!id) {
        throw new ValidationError('Template ID is required');
      }

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const updates: UpdateTemplateDTO = {
        name,
        subject,
        body,
        description,
        isActive,
      };

      const template = await templateService.updateTemplate(id, tenantId!, updates);

      const response: ApiResponse = {
        success: true,
        data: { template },
        message: 'Template updated successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Template updated via API', {
        templateId: id,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Toggle template active status
   * PATCH /api/templates/:id/toggle
   */
  public static toggleTemplateActive = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!id) {
        throw new ValidationError('Template ID is required');
      }

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const template = await templateService.toggleTemplateActive(id, tenantId!);

      const response: ApiResponse = {
        success: true,
        data: { template },
        message: `Template ${template.isActive ? 'activated' : 'deactivated'} successfully`,
        timestamp: new Date().toISOString(),
      };

      logger.info('Template toggled', {
        templateId: id,
        tenantId,
        isActive: template.isActive,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Delete a template
   * DELETE /api/templates/:id
   */
  public static deleteTemplate = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!id) {
        throw new ValidationError('Template ID is required');
      }

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      await templateService.deleteTemplate(id, tenantId!);

      const response: ApiResponse = {
        success: true,
        message: 'Template deleted successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Template deleted via API', {
        templateId: id,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Render a template with variables
   * POST /api/templates/render
   */
  public static renderTemplate = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { templateId, templateSlug, variables } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      if (!templateId && !templateSlug) {
        throw new ValidationError('Either templateId or templateSlug is required');
      }

      if (!variables || typeof variables !== 'object') {
        throw new ValidationError('Variables must be a valid object');
      }

      const rendered = await templateService.renderTemplate(
        { templateId, templateSlug, variables },
        tenantId
      );

      const response: ApiResponse = {
        success: true,
        data: { rendered },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );

  /**
   * Preview a template with sample data
   * GET /api/templates/:id/preview
   */
  public static previewTemplate = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const sampleData = req.body.sampleData;
      const tenantId = req.user?.tenantId;

      if (!id) {
        throw new ValidationError('Template ID is required');
      }

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const preview = await templateService.previewTemplate(id, tenantId!, sampleData);

      const response: ApiResponse = {
        success: true,
        data: { preview },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );

  /**
   * Get template count by type
   * GET /api/templates/stats/count-by-type
   */
  public static getTemplateCountByType = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID is required');
      }

      const countByType = await templateService.getTemplateCountByType(tenantId);

      const response: ApiResponse = {
        success: true,
        data: { countByType },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );
}
