import { Router } from 'express';
import { UsageController } from '../controllers/usage.controller';
import { requireAuth } from '@shared/middleware/auth.middleware';

/**
 * Usage Tracking Routes
 * Handles recording and querying usage for billing purposes
 */

const router = Router();

// ============================================================================
// Health Check (Public)
// ============================================================================

/**
 * @route   GET /api/billing/usage/health
 * @desc    Health check for usage tracking endpoints
 * @access  Public
 */
router.get('/health', UsageController.healthCheck);

// ============================================================================
// Protected Routes (Authentication Required)
// ============================================================================

/**
 * @route   POST /api/billing/usage
 * @desc    Record a new usage event
 * @access  Private (Authenticated users)
 * @body    {
 *   usageType: string,
 *   quantity: number,
 *   unit: string,
 *   periodStart: Date,
 *   periodEnd: Date,
 *   subscriptionId?: string,
 *   metadata?: Record<string, unknown>
 * }
 */
router.post('/', requireAuth, UsageController.recordUsage);

/**
 * @route   GET /api/billing/usage
 * @desc    Get usage records for the authenticated tenant
 * @access  Private (Authenticated users)
 * @query   {
 *   page?: number,
 *   limit?: number,
 *   usageType?: string,
 *   subscriptionId?: string,
 *   periodStart?: Date,
 *   periodEnd?: Date,
 *   sortBy?: string,
 *   sortOrder?: 'asc' | 'desc'
 * }
 */
router.get('/', requireAuth, UsageController.getUsageRecords);

/**
 * @route   GET /api/billing/usage/summary
 * @desc    Get aggregated usage summary for the authenticated tenant
 * @access  Private (Authenticated users)
 * @query   {
 *   periodStart?: Date,
 *   periodEnd?: Date,
 *   usageType?: string,
 *   subscriptionId?: string,
 *   groupBy?: 'day' | 'week' | 'month'
 * }
 */
router.get('/summary', requireAuth, UsageController.getUsageSummary);

/**
 * @route   GET /api/billing/usage/export
 * @desc    Export usage records to CSV
 * @access  Private (Authenticated users)
 * @query   {
 *   periodStart?: Date,
 *   periodEnd?: Date,
 *   usageType?: string,
 *   subscriptionId?: string,
 *   format?: 'csv' | 'json'
 * }
 */
router.get('/export', requireAuth, UsageController.exportUsage);

/**
 * @route   GET /api/billing/usage/types/list
 * @desc    Get list of all usage types for the tenant
 * @access  Private (Authenticated users)
 */
router.get('/types/list', requireAuth, UsageController.getUsageTypes);

/**
 * @route   POST /api/billing/usage/batch
 * @desc    Record multiple usage events in a single request
 * @access  Private (Authenticated users)
 * @body    {
 *   records: Array<{
 *     usageType: string,
 *     quantity: number,
 *     unit: string,
 *     periodStart: Date,
 *     periodEnd: Date,
 *     subscriptionId?: string,
 *     metadata?: Record<string, unknown>
 *   }>
 * }
 */
router.post('/batch', requireAuth, UsageController.recordBatchUsage);

/**
 * @route   GET /api/billing/usage/:id
 * @desc    Get a specific usage record by ID
 * @access  Private (Authenticated users)
 * @param   id - Usage record UUID
 */
router.get('/:id', requireAuth, UsageController.getUsageRecordById);

/**
 * @route   PATCH /api/billing/usage/:id
 * @desc    Update a usage record (limited fields)
 * @access  Private (Authenticated users)
 * @param   id - Usage record UUID
 * @body    {
 *   quantity?: number,
 *   metadata?: Record<string, unknown>
 * }
 */
router.patch('/:id', requireAuth, UsageController.updateUsageRecord);

/**
 * @route   DELETE /api/billing/usage/:id
 * @desc    Delete a usage record
 * @access  Private (Authenticated users)
 * @param   id - Usage record UUID
 */
router.delete('/:id', requireAuth, UsageController.deleteUsageRecord);

// ============================================================================
// Export Router
// ============================================================================

export default router;
