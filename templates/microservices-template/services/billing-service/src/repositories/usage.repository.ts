import { query, queryOne, setTenantContext } from '@shared/database/connection';
import { logger } from '@shared/utils/logger';
import { PaginationQuery, PaginatedResponse, PaginationMeta } from '@shared/types';
import {
  UsageRecord,
  CreateUsageRecordDTO,
  UpdateUsageRecordDTO,
  UsageRecordFilters,
  USAGE_RECORD_COLUMNS,
} from '../models/usage-record.model';

/**
 * Usage Repository
 * Handles database operations for usage records
 */

export class UsageRepository {
  /**
   * Create a new usage record
   */
  public static async create(data: CreateUsageRecordDTO): Promise<UsageRecord> {
    try {
      // Set tenant context for Row-Level Security
      await setTenantContext(data.tenantId);

      const sql = `
        INSERT INTO usage_records (
          tenant_id,
          subscription_id,
          usage_type,
          quantity,
          unit,
          period_start,
          period_end,
          recorded_at,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING ${USAGE_RECORD_COLUMNS}
      `;

      const values = [
        data.tenantId,
        data.subscriptionId || null,
        data.usageType,
        data.quantity,
        data.unit,
        data.periodStart,
        data.periodEnd,
        data.recordedAt || new Date().toISOString(),
        data.metadata ? JSON.stringify(data.metadata) : null,
      ];

      const result = await queryOne<UsageRecord>(sql, values);

      if (!result) {
        throw new Error('Failed to create usage record');
      }

      logger.debug('Usage record created in database', {
        usageRecordId: result.id,
        tenantId: data.tenantId,
      });

      return result;
    } catch (error) {
      logger.error('Error creating usage record in database', {
        error,
        tenantId: data.tenantId,
      });
      throw error;
    }
  }

  /**
   * Create multiple usage records in batch
   */
  public static async createBatch(records: CreateUsageRecordDTO[]): Promise<UsageRecord[]> {
    if (records.length === 0) {
      return [];
    }

    try {
      const tenantId = records[0]?.tenantId;
      if (!tenantId) {
        throw new Error('No tenant ID found in records');
      }
      await setTenantContext(tenantId);

      // Build bulk insert query
      const valuesClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const record of records) {
        valuesClauses.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`
        );
        values.push(
          record.tenantId,
          record.subscriptionId || null,
          record.usageType,
          record.quantity,
          record.unit,
          record.periodStart,
          record.periodEnd,
          record.recordedAt || new Date().toISOString(),
          record.metadata ? JSON.stringify(record.metadata) : null
        );
        paramIndex += 9;
      }

      const sql = `
        INSERT INTO usage_records (
          tenant_id,
          subscription_id,
          usage_type,
          quantity,
          unit,
          period_start,
          period_end,
          recorded_at,
          metadata
        ) VALUES ${valuesClauses.join(', ')}
        RETURNING ${USAGE_RECORD_COLUMNS}
      `;

      const result = await query<UsageRecord>(sql, values);

      logger.debug('Batch usage records created in database', {
        count: result.length,
        tenantId,
      });

      return result;
    } catch (error) {
      logger.error('Error creating batch usage records in database', {
        error,
        count: records.length,
      });
      throw error;
    }
  }

  /**
   * Find usage records with pagination
   */
  public static async findWithPagination(
    filters: UsageRecordFilters,
    pagination: PaginationQuery
  ): Promise<PaginatedResponse<UsageRecord>> {
    try {
      if (!filters.tenantId) {
        throw new Error('Tenant ID is required');
      }

      await setTenantContext(filters.tenantId);

      const { page = 1, limit = 20, sortBy = 'recordedAt', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const { whereClause, values } = this.buildWhereClause(filters);

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM usage_records
        ${whereClause}
      `;
      const countResult = await queryOne<{ total: string }>(countSql, values);
      const total = countResult ? parseInt(countResult.total, 10) : 0;

      // Get paginated data
      const dataSql = `
        SELECT ${USAGE_RECORD_COLUMNS}
        FROM usage_records
        ${whereClause}
        ORDER BY ${this.getSortColumn(sortBy)} ${sortOrder.toUpperCase()}
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `;
      const dataValues = [...values, limit, offset];
      const data = await query<UsageRecord>(dataSql, dataValues);

      // Build pagination metadata
      const totalPages = Math.ceil(total / limit);
      const paginationMeta: PaginationMeta = {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      };

      logger.debug('Usage records fetched with pagination', {
        tenantId: filters.tenantId,
        page,
        limit,
        total,
      });

      return {
        data,
        pagination: paginationMeta,
      };
    } catch (error) {
      logger.error('Error fetching usage records with pagination', {
        error,
        tenantId: filters.tenantId,
      });
      throw error;
    }
  }

  /**
   * Find all usage records matching filters (no pagination)
   */
  public static async findAll(filters: UsageRecordFilters): Promise<UsageRecord[]> {
    try {
      if (!filters.tenantId) {
        throw new Error('Tenant ID is required');
      }

      await setTenantContext(filters.tenantId);

      const { whereClause, values } = this.buildWhereClause(filters);

      const sql = `
        SELECT ${USAGE_RECORD_COLUMNS}
        FROM usage_records
        ${whereClause}
        ORDER BY recorded_at DESC
      `;

      const result = await query<UsageRecord>(sql, values);

      logger.debug('All usage records fetched', {
        tenantId: filters.tenantId,
        count: result.length,
      });

      return result;
    } catch (error) {
      logger.error('Error fetching all usage records', {
        error,
        tenantId: filters.tenantId,
      });
      throw error;
    }
  }

  /**
   * Find usage record by ID
   */
  public static async findById(id: string, tenantId: string): Promise<UsageRecord | null> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT ${USAGE_RECORD_COLUMNS}
        FROM usage_records
        WHERE id = $1 AND tenant_id = $2
      `;

      const result = await queryOne<UsageRecord>(sql, [id, tenantId]);

      logger.debug('Usage record fetched by ID', {
        usageRecordId: id,
        tenantId,
      });

      return result;
    } catch (error) {
      // Return null if not found
      if (error instanceof Error && error.message.includes('No rows returned')) {
        return null;
      }
      logger.error('Error fetching usage record by ID', {
        error,
        usageRecordId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Update usage record
   */
  public static async update(
    id: string,
    tenantId: string,
    data: UpdateUsageRecordDTO
  ): Promise<UsageRecord | null> {
    try {
      await setTenantContext(tenantId);

      // Build SET clause dynamically
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.quantity !== undefined) {
        setClauses.push(`quantity = $${paramIndex}`);
        values.push(data.quantity);
        paramIndex++;
      }

      if (data.metadata !== undefined) {
        setClauses.push(`metadata = $${paramIndex}`);
        values.push(JSON.stringify(data.metadata));
        paramIndex++;
      }

      if (setClauses.length === 0) {
        throw new Error('No fields to update');
      }

      // Add id and tenantId to values
      values.push(id, tenantId);

      const sql = `
        UPDATE usage_records
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
        RETURNING ${USAGE_RECORD_COLUMNS}
      `;

      const result = await queryOne<UsageRecord>(sql, values);

      logger.debug('Usage record updated', {
        usageRecordId: id,
        tenantId,
      });

      return result;
    } catch (error) {
      // Return null if not found
      if (error instanceof Error && error.message.includes('No rows returned')) {
        return null;
      }
      logger.error('Error updating usage record', {
        error,
        usageRecordId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Delete usage record
   */
  public static async delete(id: string, tenantId: string): Promise<boolean> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        DELETE FROM usage_records
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
      `;

      const result = await queryOne<{ id: string }>(sql, [id, tenantId]);

      logger.debug('Usage record deleted', {
        usageRecordId: id,
        tenantId,
      });

      return !!result;
    } catch (error) {
      // Return false if not found
      if (error instanceof Error && error.message.includes('No rows returned')) {
        return false;
      }
      logger.error('Error deleting usage record', {
        error,
        usageRecordId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get distinct usage types for a tenant
   */
  public static async getDistinctUsageTypes(tenantId: string): Promise<string[]> {
    try {
      await setTenantContext(tenantId);

      const sql = `
        SELECT DISTINCT usage_type
        FROM usage_records
        WHERE tenant_id = $1
        ORDER BY usage_type ASC
      `;

      const result = await query<{ usage_type: string }>(sql, [tenantId]);

      logger.debug('Distinct usage types fetched', {
        tenantId,
        count: result.length,
      });

      return result.map(row => row.usage_type);
    } catch (error) {
      logger.error('Error fetching distinct usage types', {
        error,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get grouped usage data (by day/week/month)
   */
  public static async getGroupedUsage(
    filters: UsageRecordFilters,
    groupBy: 'day' | 'week' | 'month'
  ): Promise<Record<string, any>> {
    try {
      if (!filters.tenantId) {
        throw new Error('Tenant ID is required');
      }

      await setTenantContext(filters.tenantId);

      const { whereClause, values } = this.buildWhereClause(filters);

      // Determine date truncation based on groupBy
      let dateTrunc: string;
      switch (groupBy) {
        case 'day':
          dateTrunc = "DATE_TRUNC('day', period_start)";
          break;
        case 'week':
          dateTrunc = "DATE_TRUNC('week', period_start)";
          break;
        case 'month':
          dateTrunc = "DATE_TRUNC('month', period_start)";
          break;
        default:
          dateTrunc = "DATE_TRUNC('day', period_start)";
      }

      const sql = `
        SELECT
          ${dateTrunc} as period,
          usage_type,
          SUM(quantity) as total_quantity,
          COUNT(*) as record_count,
          unit
        FROM usage_records
        ${whereClause}
        GROUP BY ${dateTrunc}, usage_type, unit
        ORDER BY period DESC, usage_type ASC
      `;

      const result = await query<{
        period: string;
        usage_type: string;
        total_quantity: string;
        record_count: string;
        unit: string;
      }>(sql, values);

      // Convert to grouped structure
      const grouped: Record<string, any> = {};
      for (const row of result) {
        const periodKey = new Date(row.period).toISOString();
        if (!grouped[periodKey]) {
          grouped[periodKey] = {};
        }
        grouped[periodKey][row.usage_type] = {
          quantity: parseFloat(row.total_quantity),
          unit: row.unit,
          recordCount: parseInt(row.record_count, 10),
        };
      }

      logger.debug('Grouped usage data fetched', {
        tenantId: filters.tenantId,
        groupBy,
        periods: Object.keys(grouped).length,
      });

      return grouped;
    } catch (error) {
      logger.error('Error fetching grouped usage data', {
        error,
        tenantId: filters.tenantId,
        groupBy,
      });
      throw error;
    }
  }

  /**
   * Build WHERE clause from filters
   */
  private static buildWhereClause(filters: UsageRecordFilters): {
    whereClause: string;
    values: any[];
  } {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [filters.tenantId];
    let paramIndex = 2;

    if (filters.subscriptionId) {
      conditions.push(`subscription_id = $${paramIndex}`);
      values.push(filters.subscriptionId);
      paramIndex++;
    }

    if (filters.usageType) {
      conditions.push(`usage_type = $${paramIndex}`);
      values.push(filters.usageType);
      paramIndex++;
    }

    if (filters.periodStart) {
      conditions.push(`period_start >= $${paramIndex}`);
      values.push(filters.periodStart);
      paramIndex++;
    }

    if (filters.periodEnd) {
      conditions.push(`period_end <= $${paramIndex}`);
      values.push(filters.periodEnd);
      paramIndex++;
    }

    if (filters.recordedAfter) {
      conditions.push(`recorded_at >= $${paramIndex}`);
      values.push(filters.recordedAfter);
      paramIndex++;
    }

    if (filters.recordedBefore) {
      conditions.push(`recorded_at <= $${paramIndex}`);
      values.push(filters.recordedBefore);
      paramIndex++;
    }

    if (filters.minQuantity !== undefined) {
      conditions.push(`quantity >= $${paramIndex}`);
      values.push(filters.minQuantity);
      paramIndex++;
    }

    if (filters.maxQuantity !== undefined) {
      conditions.push(`quantity <= $${paramIndex}`);
      values.push(filters.maxQuantity);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, values };
  }

  /**
   * Get sort column name (convert camelCase to snake_case)
   */
  private static getSortColumn(sortBy: string): string {
    const columnMap: Record<string, string> = {
      id: 'id',
      tenantId: 'tenant_id',
      subscriptionId: 'subscription_id',
      usageType: 'usage_type',
      quantity: 'quantity',
      unit: 'unit',
      periodStart: 'period_start',
      periodEnd: 'period_end',
      recordedAt: 'recorded_at',
      createdAt: 'created_at',
    };

    return columnMap[sortBy] || 'recorded_at';
  }
}
