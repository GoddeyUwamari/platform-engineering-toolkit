import { logger } from '@shared/utils/logger';
import { PaginationQuery } from '@shared/types';
import { UsageRepository } from '../repositories/usage.repository';
import {
  UsageRecord,
  CreateUsageRecordDTO,
  UpdateUsageRecordDTO,
  UsageRecordFilters,
  calculateUsageSummary,
  groupByUsageType,
} from '../models/usage-record.model';

/**
 * Usage Tracking Service
 * Business logic for usage tracking and aggregation
 */

export class UsageTrackingService {
  /**
   * Record a single usage event
   */
  public static async recordUsage(data: CreateUsageRecordDTO): Promise<UsageRecord> {
    try {
      logger.debug('Recording usage event', {
        tenantId: data.tenantId,
        usageType: data.usageType,
        quantity: data.quantity,
      });

      // Create usage record via repository
      const usageRecord = await UsageRepository.create(data);

      logger.info('Usage event recorded successfully', {
        usageRecordId: usageRecord.id,
        tenantId: data.tenantId,
        usageType: data.usageType,
      });

      // TODO: Emit event for usage recorded (for analytics/notifications)
      // EventBus.emit('USAGE_RECORDED', usageRecord);

      return usageRecord;
    } catch (error) {
      logger.error('Error recording usage event', {
        error,
        tenantId: data.tenantId,
        usageType: data.usageType,
      });
      throw error;
    }
  }

  /**
   * Record multiple usage events in batch
   */
  public static async recordBatchUsage(records: CreateUsageRecordDTO[]): Promise<UsageRecord[]> {
    try {
      logger.debug('Recording batch usage events', {
        count: records.length,
        tenantId: records[0]?.tenantId,
      });

      // Create all usage records
      const usageRecords = await UsageRepository.createBatch(records);

      logger.info('Batch usage events recorded successfully', {
        count: usageRecords.length,
        tenantId: records[0]?.tenantId,
      });

      return usageRecords;
    } catch (error) {
      logger.error('Error recording batch usage events', {
        error,
        count: records.length,
      });
      throw error;
    }
  }

  /**
   * Get usage records with pagination
   */
  public static async getUsageRecords(
    filters: UsageRecordFilters,
    pagination: PaginationQuery
  ) {
    try {
      logger.debug('Fetching usage records', {
        tenantId: filters.tenantId,
        filters,
        pagination,
      });

      // Get paginated usage records
      const result = await UsageRepository.findWithPagination(filters, pagination);

      logger.info('Usage records fetched successfully', {
        tenantId: filters.tenantId,
        count: result.data.length,
        page: result.pagination.page,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching usage records', {
        error,
        tenantId: filters.tenantId,
      });
      throw error;
    }
  }

  /**
   * Get a specific usage record by ID
   */
  public static async getUsageRecordById(
    id: string,
    tenantId: string
  ): Promise<UsageRecord | null> {
    try {
      logger.debug('Fetching usage record by ID', {
        usageRecordId: id,
        tenantId,
      });

      // Get usage record
      const usageRecord = await UsageRepository.findById(id, tenantId);

      if (!usageRecord) {
        logger.warn('Usage record not found', {
          usageRecordId: id,
          tenantId,
        });
        return null;
      }

      logger.info('Usage record fetched successfully', {
        usageRecordId: id,
        tenantId,
      });

      return usageRecord;
    } catch (error) {
      logger.error('Error fetching usage record', {
        error,
        usageRecordId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Update a usage record
   */
  public static async updateUsageRecord(
    id: string,
    tenantId: string,
    data: UpdateUsageRecordDTO
  ): Promise<UsageRecord | null> {
    try {
      logger.debug('Updating usage record', {
        usageRecordId: id,
        tenantId,
        updates: data,
      });

      // Update usage record
      const usageRecord = await UsageRepository.update(id, tenantId, data);

      if (!usageRecord) {
        logger.warn('Usage record not found for update', {
          usageRecordId: id,
          tenantId,
        });
        return null;
      }

      logger.info('Usage record updated successfully', {
        usageRecordId: id,
        tenantId,
      });

      return usageRecord;
    } catch (error) {
      logger.error('Error updating usage record', {
        error,
        usageRecordId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Delete a usage record
   */
  public static async deleteUsageRecord(id: string, tenantId: string): Promise<boolean> {
    try {
      logger.debug('Deleting usage record', {
        usageRecordId: id,
        tenantId,
      });

      // Delete usage record
      const deleted = await UsageRepository.delete(id, tenantId);

      if (!deleted) {
        logger.warn('Usage record not found for deletion', {
          usageRecordId: id,
          tenantId,
        });
        return false;
      }

      logger.info('Usage record deleted successfully', {
        usageRecordId: id,
        tenantId,
      });

      return true;
    } catch (error) {
      logger.error('Error deleting usage record', {
        error,
        usageRecordId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get aggregated usage summary
   */
  public static async getUsageSummary(
    filters: UsageRecordFilters,
    groupBy?: 'day' | 'week' | 'month'
  ): Promise<Record<string, any>> {
    try {
      logger.debug('Calculating usage summary', {
        tenantId: filters.tenantId,
        filters,
        groupBy,
      });

      // Get all usage records matching filters
      const records = await UsageRepository.findAll(filters);

      // Calculate summary using helper functions
      const summary = calculateUsageSummary(records);

      // If grouping is requested, get grouped data from repository
      let groupedData: Record<string, any> = {};
      if (groupBy) {
        groupedData = await UsageRepository.getGroupedUsage(filters, groupBy);
      }

      // Combine summary with grouped data
      const result = {
        totalRecords: records.length,
        usageByType: summary,
        ...(groupBy && { groupedData }),
        periodStart: filters.periodStart,
        periodEnd: filters.periodEnd,
      };

      logger.info('Usage summary calculated successfully', {
        tenantId: filters.tenantId,
        usageTypes: Object.keys(summary),
        totalRecords: records.length,
      });

      return result;
    } catch (error) {
      logger.error('Error calculating usage summary', {
        error,
        tenantId: filters.tenantId,
      });
      throw error;
    }
  }

  /**
   * Get list of usage types for a tenant
   */
  public static async getUsageTypes(tenantId: string): Promise<string[]> {
    try {
      logger.debug('Fetching usage types', {
        tenantId,
      });

      // Get distinct usage types
      const usageTypes = await UsageRepository.getDistinctUsageTypes(tenantId);

      logger.info('Usage types fetched successfully', {
        tenantId,
        count: usageTypes.length,
      });

      return usageTypes;
    } catch (error) {
      logger.error('Error fetching usage types', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Export usage data in specified format
   */
  public static async exportUsage(
    filters: UsageRecordFilters,
    format: 'csv' | 'json'
  ): Promise<string> {
    try {
      logger.debug('Exporting usage data', {
        tenantId: filters.tenantId,
        format,
      });

      // Get all usage records matching filters
      const records = await UsageRepository.findAll(filters);

      let exportData: string;

      if (format === 'csv') {
        // Convert to CSV
        exportData = this.convertToCSV(records);
      } else {
        // Convert to JSON
        exportData = JSON.stringify(records, null, 2);
      }

      logger.info('Usage data exported successfully', {
        tenantId: filters.tenantId,
        format,
        recordCount: records.length,
      });

      return exportData;
    } catch (error) {
      logger.error('Error exporting usage data', {
        error,
        tenantId: filters.tenantId,
      });
      throw error;
    }
  }

  /**
   * Convert usage records to CSV format
   */
  private static convertToCSV(records: UsageRecord[]): string {
    if (records.length === 0) {
      return 'No data available';
    }

    // CSV headers
    const headers = [
      'ID',
      'Tenant ID',
      'Subscription ID',
      'Usage Type',
      'Quantity',
      'Unit',
      'Period Start',
      'Period End',
      'Recorded At',
      'Created At',
    ];

    // CSV rows
    const rows = records.map(record => [
      record.id,
      record.tenantId,
      record.subscriptionId || '',
      record.usageType,
      record.quantity,
      record.unit,
      record.periodStart,
      record.periodEnd,
      record.recordedAt,
      record.createdAt,
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Get usage statistics for a tenant
   */
  public static async getUsageStatistics(
    tenantId: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<{
    totalUsage: number;
    usageByType: Record<string, number>;
    recordCount: number;
    averagePerDay: number;
  }> {
    try {
      logger.debug('Calculating usage statistics', {
        tenantId,
        periodStart,
        periodEnd,
      });

      const filters: UsageRecordFilters = {
        tenantId,
        periodStart,
        periodEnd,
      };

      const records = await UsageRepository.findAll(filters);
      const grouped = groupByUsageType(records);

      // Calculate statistics
      const usageByType: Record<string, number> = {};
      let totalUsage = 0;

      for (const [usageType, typeRecords] of Object.entries(grouped)) {
        const typeTotal = typeRecords.reduce((sum, r) => sum + r.quantity, 0);
        usageByType[usageType] = typeTotal;
        totalUsage += typeTotal;
      }

      // Calculate average per day
      let averagePerDay = 0;
      if (periodStart && periodEnd) {
        const start = new Date(periodStart);
        const end = new Date(periodEnd);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        averagePerDay = days > 0 ? totalUsage / days : 0;
      }

      const stats = {
        totalUsage,
        usageByType,
        recordCount: records.length,
        averagePerDay: Math.round(averagePerDay * 100) / 100,
      };

      logger.info('Usage statistics calculated successfully', {
        tenantId,
        totalUsage,
        recordCount: records.length,
      });

      return stats;
    } catch (error) {
      logger.error('Error calculating usage statistics', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Check if usage exceeds threshold
   */
  public static async checkUsageThreshold(
    tenantId: string,
    usageType: string,
    threshold: number,
    periodStart: string,
    periodEnd: string
  ): Promise<{
    exceeded: boolean;
    current: number;
    threshold: number;
    percentage: number;
  }> {
    try {
      logger.debug('Checking usage threshold', {
        tenantId,
        usageType,
        threshold,
      });

      const filters: UsageRecordFilters = {
        tenantId,
        usageType,
        periodStart,
        periodEnd,
      };

      const records = await UsageRepository.findAll(filters);
      const current = records.reduce((sum, r) => sum + r.quantity, 0);
      const percentage = threshold > 0 ? (current / threshold) * 100 : 0;

      const result = {
        exceeded: current > threshold,
        current,
        threshold,
        percentage: Math.round(percentage * 100) / 100,
      };

      logger.info('Usage threshold checked', {
        tenantId,
        usageType,
        exceeded: result.exceeded,
        current,
        threshold,
      });

      return result;
    } catch (error) {
      logger.error('Error checking usage threshold', {
        error,
        tenantId,
        usageType,
      });
      throw error;
    }
  }
}
