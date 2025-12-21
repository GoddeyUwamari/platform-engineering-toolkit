import { UUID } from '@shared/types';
import { logger } from '@shared/utils/logger';
import { ValidationError } from '@shared/middleware/error-handler';
import { templateRepository } from '../repositories/template.repository';
import {
  NotificationTemplate,
  CreateTemplateDTO,
  UpdateTemplateDTO,
  TemplateFilters,
  RenderTemplateDTO,
  RenderedTemplate,
  extractTemplateVariables,
  validateTemplateVariables,
  renderTemplate,
  validateTemplateContent,
  generateTemplateSlug,
} from '../models/template.model';

/**
 * Template Service
 * Business logic for notification templates
 */

class TemplateService {
  /**
   * Create a new notification template
   */
  async createTemplate(templateData: CreateTemplateDTO): Promise<NotificationTemplate> {
    try {
      // Auto-generate slug if not provided
      if (!templateData.slug) {
        templateData.slug = generateTemplateSlug(templateData.name);
      }

      // Extract variables from template content
      const extractedVariables = extractTemplateVariables(templateData.body);
      if (templateData.subject) {
        const subjectVariables = extractTemplateVariables(templateData.subject);
        extractedVariables.push(...subjectVariables);
      }

      // Use provided variables or extracted ones
      const variables = templateData.variables || Array.from(new Set(extractedVariables));

      // Validate template content
      const validation = validateTemplateContent(
        templateData.type,
        templateData.subject || null,
        templateData.body
      );

      if (!validation.isValid) {
        throw new ValidationError('Template validation failed', {
          errors: validation.errors,
        });
      }

      // Create template
      const template = await templateRepository.create({
        ...templateData,
        variables,
      });

      logger.info('Template created', {
        templateId: template.id,
        tenantId: template.tenantId,
        slug: template.slug,
      });

      return template;
    } catch (error) {
      logger.error('Error creating template', {
        tenantId: templateData.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: UUID, tenantId: UUID): Promise<NotificationTemplate> {
    return await templateRepository.findById(id, tenantId);
  }

  /**
   * Get template by slug
   */
  async getTemplateBySlug(slug: string, tenantId: UUID): Promise<NotificationTemplate> {
    return await templateRepository.findBySlug(slug, tenantId);
  }

  /**
   * Get all templates for a tenant
   */
  async getTemplatesByTenant(
    tenantId: UUID,
    filters?: TemplateFilters
  ): Promise<NotificationTemplate[]> {
    return await templateRepository.findByTenant(tenantId, filters);
  }

  /**
   * Update a template
   */
  async updateTemplate(
    id: UUID,
    tenantId: UUID,
    updates: UpdateTemplateDTO
  ): Promise<NotificationTemplate> {
    try {
      // If updating body or subject, re-extract variables
      if (updates.body || updates.subject) {
        const template = await templateRepository.findById(id, tenantId);
        const currentBody = updates.body || template.body;
        const currentSubject = updates.subject !== undefined ? updates.subject : template.subject;

        const extractedVariables = extractTemplateVariables(currentBody);
        if (currentSubject) {
          const subjectVariables = extractTemplateVariables(currentSubject);
          extractedVariables.push(...subjectVariables);
        }

        updates.variables = Array.from(new Set(extractedVariables));
      }

      // Update template
      const template = await templateRepository.update(id, tenantId, updates);

      logger.info('Template updated', {
        templateId: id,
        tenantId,
      });

      return template;
    } catch (error) {
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
  async toggleTemplateActive(id: UUID, tenantId: UUID): Promise<NotificationTemplate> {
    return await templateRepository.toggleActive(id, tenantId);
  }

  /**
   * Delete a template (soft delete)
   */
  async deleteTemplate(id: UUID, tenantId: UUID): Promise<void> {
    await templateRepository.delete(id, tenantId);

    logger.info('Template deleted', {
      templateId: id,
      tenantId,
    });
  }

  /**
   * Render a template with variables
   */
  async renderTemplate(renderData: RenderTemplateDTO, tenantId: UUID): Promise<RenderedTemplate> {
    try {
      let template: NotificationTemplate;

      // Get template by ID or slug
      if (renderData.templateId) {
        template = await templateRepository.findById(renderData.templateId, tenantId);
      } else if (renderData.templateSlug) {
        template = await templateRepository.findBySlug(renderData.templateSlug, tenantId);
      } else {
        throw new ValidationError('Either templateId or templateSlug is required');
      }

      // Check if template is active
      if (!template.isActive) {
        throw new ValidationError('Template is not active');
      }

      // Validate that all required variables are provided
      const validation = validateTemplateVariables(template, renderData.variables);
      if (!validation.isValid) {
        logger.warn('Missing template variables', {
          templateId: template.id,
          tenantId,
          missingVariables: validation.missingVariables,
        });
      }

      // Render template content
      const renderedBody = renderTemplate(template.body, renderData.variables, {
        escapeHtml: false, // Don't escape HTML in notification templates
        defaultValue: '', // Use empty string for missing variables
      });

      let renderedSubject: string | null = null;
      if (template.subject) {
        renderedSubject = renderTemplate(template.subject, renderData.variables, {
          escapeHtml: false,
          defaultValue: '',
        });
      }

      const rendered: RenderedTemplate = {
        subject: renderedSubject,
        body: renderedBody,
        variables: renderData.variables,
        missingVariables: validation.missingVariables,
      };

      logger.info('Template rendered', {
        templateId: template.id,
        tenantId,
        missingVariables: validation.missingVariables.length,
      });

      return rendered;
    } catch (error) {
      logger.error('Error rendering template', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get template count by type
   */
  async getTemplateCountByType(tenantId: UUID): Promise<Record<string, number>> {
    return await templateRepository.getCountByType(tenantId);
  }

  /**
   * Validate template variables
   */
  validateTemplateVariables(
    template: NotificationTemplate,
    providedVariables: Record<string, any>
  ): { isValid: boolean; missingVariables: string[] } {
    return validateTemplateVariables(template, providedVariables);
  }

  /**
   * Preview template (render with sample data)
   */
  async previewTemplate(
    id: UUID,
    tenantId: UUID,
    sampleData?: Record<string, any>
  ): Promise<RenderedTemplate> {
    const template = await templateRepository.findById(id, tenantId);

    // Create sample data for all variables if not provided
    const variables = sampleData || {};
    for (const varName of template.variables) {
      if (!variables[varName]) {
        variables[varName] = `[${varName}]`; // Placeholder value
      }
    }

    return this.renderTemplate(
      {
        templateId: id,
        variables,
      },
      tenantId
    );
  }
}

// Export singleton instance
export const templateService = new TemplateService();

// Export class for testing
export { TemplateService };
