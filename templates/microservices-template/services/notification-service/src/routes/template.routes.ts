import { Router } from 'express';
import { TemplateController } from '../controllers/template.controller';
import {
  requireAuth,
  validateTemplateCreation,
  validateTemplateUpdate,
  validateTemplateRender,
  validateUUIDParam,
  validateQueryParams,
  apiRateLimit,
  addTenantContext,
  addRequestMetadata,
} from '../middleware';

/**
 * Template Routes
 * Defines all notification template endpoints
 */

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(addTenantContext);
router.use(addRequestMetadata);
router.use(apiRateLimit);

/**
 * @route   POST /api/templates
 * @desc    Create a new template
 * @access  Private
 */
router.post('/', validateTemplateCreation, TemplateController.createTemplate);

/**
 * @route   POST /api/templates/render
 * @desc    Render a template with variables
 * @access  Private
 */
router.post('/render', validateTemplateRender, TemplateController.renderTemplate);

/**
 * @route   GET /api/templates/stats/count-by-type
 * @desc    Get template count by type
 * @access  Private
 */
router.get('/stats/count-by-type', TemplateController.getTemplateCountByType);

/**
 * @route   GET /api/templates/slug/:slug
 * @desc    Get template by slug
 * @access  Private
 */
router.get('/slug/:slug', TemplateController.getTemplateBySlug);

/**
 * @route   GET /api/templates/:id
 * @desc    Get template by ID
 * @access  Private
 */
router.get('/:id', validateUUIDParam('id'), TemplateController.getTemplateById);

/**
 * @route   GET /api/templates/:id/preview
 * @desc    Preview a template with sample data
 * @access  Private
 */
router.get('/:id/preview', validateUUIDParam('id'), TemplateController.previewTemplate);

/**
 * @route   GET /api/templates
 * @desc    Get all templates for tenant
 * @access  Private
 */
router.get('/', validateQueryParams, TemplateController.getTemplates);

/**
 * @route   PUT /api/templates/:id
 * @desc    Update a template
 * @access  Private
 */
router.put('/:id', validateUUIDParam('id'), validateTemplateUpdate, TemplateController.updateTemplate);

/**
 * @route   PATCH /api/templates/:id/toggle
 * @desc    Toggle template active status
 * @access  Private
 */
router.patch('/:id/toggle', validateUUIDParam('id'), TemplateController.toggleTemplateActive);

/**
 * @route   DELETE /api/templates/:id
 * @desc    Delete a template
 * @access  Private
 */
router.delete('/:id', validateUUIDParam('id'), TemplateController.deleteTemplate);

export default router;
