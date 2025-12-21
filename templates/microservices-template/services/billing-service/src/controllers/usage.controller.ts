import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ApiResponse } from '@shared/types';
import {
  ValidationError,
  NotFoundError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import { UsageTrackingService } from '../services/usage-tracking.service';
import {
  CreateUsageRecordDTO,
  UpdateUsageRecordDTO,
  UsageRecordFilters,
  isValidQuantity,
  isValidUsageType,
  isValidUnit,
  isValidPeriod
} from '../models/usage-record.model';
// Import express type augmentation
import '../types/express-augmentation';

/**
 * Usage Tracking Controller
 * Handles HTTP requests for usage tracking endpoints
 */

export class UsageController {
  /**
   * Record a new usage event
   * POST /api/billing/usage
   */
  public static recordUsage = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { usageType, quantity, unit, periodStart, periodEnd, subscriptionId, metadata } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      // Validate authentication
      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      // Validate required fields
      if (!usageType || quantity === undefined || !unit || !periodStart || !periodEnd) {
        throw new ValidationError('Missing required fields', {
          usageType: !usageType ? 'Usage type is required' : undefined,
          quantity: quantity === undefined ? 'Quantity is required' : undefined,
          unit: !unit ? 'Unit is required' : undefined,
          periodStart: !periodStart ? 'Period start is required' : undefined,
          periodEnd: !periodEnd ? 'Period end is required' : undefined,
        });
      }

      // Validate field values
      if (!isValidQuantity(quantity)) {
        throw new ValidationError('Quantity must be a non-negative number');
      }

      if (!isValidUsageType(usageType)) {
        throw new ValidationError('Usage type cannot be empty');
      }

      if (!isValidUnit(unit)) {
        throw new ValidationError('Unit cannot be empty');
      }

      if (!isValidPeriod(periodStart, periodEnd)) {
        throw new ValidationError('Period end must be after period start');
      }

      // Create usage record DTO
      const usageData: CreateUsageRecordDTO = {
        tenantId,
        subscriptionId,
        usageType,
        quantity,
        unit,
        periodStart,
        periodEnd,
        metadata,
      };

      // Record usage
      const usageRecord = await UsageTrackingService.recordUsage(usageData);

      const response: ApiResponse = {
        success: true,
        data: { usageRecord },
        message: 'Usage recorded successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Usage record created', {
        usageRecordId: usageRecord.id,
        tenantId,
        userId,
        usageType,
        quantity,
      });

      res.status(201).json(response);
    }
  );

  /**
   * Get usage records for the tenant
   * GET /api/billing/usage
   */
  public static getUsageRecords = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      // Parse pagination and filters from query
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = (req.query.sortBy as string) || 'recordedAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      const filters: UsageRecordFilters = {
        tenantId,
        usageType: req.query.usageType as string,
        subscriptionId: req.query.subscriptionId as string,
        periodStart: req.query.periodStart as string,
        periodEnd: req.query.periodEnd as string,
        recordedAfter: req.query.recordedAfter as string,
        recordedBefore: req.query.recordedBefore as string,
      };

      // Get usage records
      const result = await UsageTrackingService.getUsageRecords(
        filters,
        { page, limit, sortBy, sortOrder }
      );

      // Flatten the response structure - put data and pagination at top level
      const response = {
        success: true,
        data: result.data,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      };

      logger.info('Usage records retrieved', {
        tenantId,
        count: result.data.length,
        page,
        limit,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get usage summary
   * GET /api/billing/usage/summary
   */
  public static getUsageSummary = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const filters: UsageRecordFilters = {
        tenantId,
        usageType: req.query.usageType as string,
        subscriptionId: req.query.subscriptionId as string,
        periodStart: req.query.periodStart as string,
        periodEnd: req.query.periodEnd as string,
      };

      const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || undefined;

      // Get usage summary
      const summary = await UsageTrackingService.getUsageSummary(filters, groupBy);

      const response: ApiResponse = {
        success: true,
        data: { summary },
        timestamp: new Date().toISOString(),
      };

      logger.info('Usage summary retrieved', {
        tenantId,
        usageTypes: Object.keys(summary),
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get a specific usage record by ID
   * GET /api/billing/usage/:id
   */
  public static getUsageRecordById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Usage record ID is required');
      }

      // Get usage record
      const usageRecord = await UsageTrackingService.getUsageRecordById(id, tenantId);

      if (!usageRecord) {
        throw new NotFoundError('Usage record not found');
      }

      const response: ApiResponse = {
        success: true,
        data: { usageRecord },
        timestamp: new Date().toISOString(),
      };

      logger.info('Usage record retrieved', {
        usageRecordId: id,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Update a usage record
   * PATCH /api/billing/usage/:id
   */
  public static updateUsageRecord = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { quantity, metadata } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Usage record ID is required');
      }

      // Validate at least one field to update
      if (quantity === undefined && !metadata) {
        throw new ValidationError('At least one field is required to update');
      }

      // Validate quantity if provided
      if (quantity !== undefined && !isValidQuantity(quantity)) {
        throw new ValidationError('Quantity must be a non-negative number');
      }

      const updateData: UpdateUsageRecordDTO = {
        quantity,
        metadata,
      };

      // Update usage record
      const usageRecord = await UsageTrackingService.updateUsageRecord(id, tenantId, updateData);

      if (!usageRecord) {
        throw new NotFoundError('Usage record not found');
      }

      const response: ApiResponse = {
        success: true,
        data: { usageRecord },
        message: 'Usage record updated successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Usage record updated', {
        usageRecordId: id,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Delete a usage record
   * DELETE /api/billing/usage/:id
   */
  public static deleteUsageRecord = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Usage record ID is required');
      }

      // Delete usage record
      const deleted = await UsageTrackingService.deleteUsageRecord(id, tenantId);

      if (!deleted) {
        throw new NotFoundError('Usage record not found');
      }

      const response: ApiResponse = {
        success: true,
        message: 'Usage record deleted successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Usage record deleted', {
        usageRecordId: id,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get list of usage types for the tenant
   * GET /api/billing/usage/types/list
   */
  public static getUsageTypes = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      // Get usage types
      const usageTypes = await UsageTrackingService.getUsageTypes(tenantId);

      const response: ApiResponse = {
        success: true,
        data: { usageTypes },
        timestamp: new Date().toISOString(),
      };

      logger.info('Usage types retrieved', {
        tenantId,
        count: usageTypes.length,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Record multiple usage events in batch
   * POST /api/billing/usage/batch
   */
  public static recordBatchUsage = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { records } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      // Validate records array
      if (!records || !Array.isArray(records) || records.length === 0) {
        throw new ValidationError('Records array is required and must not be empty');
      }

      if (records.length > 100) {
        throw new ValidationError('Cannot process more than 100 records at once');
      }

      // Validate each record
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        if (!record.usageType || record.quantity === undefined || !record.unit ||
            !record.periodStart || !record.periodEnd) {
          throw new ValidationError(`Record at index ${i} is missing required fields`);
        }

        if (!isValidQuantity(record.quantity)) {
          throw new ValidationError(`Record at index ${i} has invalid quantity`);
        }

        if (!isValidPeriod(record.periodStart, record.periodEnd)) {
          throw new ValidationError(`Record at index ${i} has invalid period`);
        }
      }

      // Add tenantId to each record
      const usageRecords: CreateUsageRecordDTO[] = records.map(record => ({
        tenantId,
        subscriptionId: record.subscriptionId,
        usageType: record.usageType,
        quantity: record.quantity,
        unit: record.unit,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        metadata: record.metadata,
      }));

      // Record batch usage
      const result = await UsageTrackingService.recordBatchUsage(usageRecords);

      const response: ApiResponse = {
        success: true,
        data: {
          usageRecords: result,
          count: result.length,
        },
        message: `${result.length} usage records created successfully`,
        timestamp: new Date().toISOString(),
      };

      logger.info('Batch usage records created', {
        tenantId,
        userId,
        count: result.length,
      });

      res.status(201).json(response);
    }
  );

  /**
   * Export usage records
   * GET /api/billing/usage/export
   */
  public static exportUsage = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const filters: UsageRecordFilters = {
        tenantId,
        usageType: req.query.usageType as string,
        subscriptionId: req.query.subscriptionId as string,
        periodStart: req.query.periodStart as string,
        periodEnd: req.query.periodEnd as string,
      };

      const format = ((req.query.format as string) || 'csv') as 'csv' | 'json';

      // Export usage data
      const exportData = await UsageTrackingService.exportUsage(filters, format);

      // Set appropriate headers
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=usage-export-${Date.now()}.csv`);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=usage-export-${Date.now()}.json`);
      }

      logger.info('Usage data exported', {
        tenantId,
        format,
      });

      res.status(200).send(exportData);
    }
  );

  /**
   * Health check endpoint
   * GET /api/billing/usage/health
   */
  public static healthCheck = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const response: ApiResponse = {
        success: true,
        data: {
          service: 'billing-service',
          endpoint: 'usage-tracking',
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );
}
