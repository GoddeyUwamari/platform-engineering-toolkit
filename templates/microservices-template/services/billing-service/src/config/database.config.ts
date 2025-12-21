import { Pool } from 'pg';
import { logger } from '@shared/utils/logger';
import * as DatabaseConnection from '@shared/database/connection';

/**
 * Database Configuration for Billing Service
 * Wraps shared database connection with billing-specific features
 */

class BillingDatabaseConfig {
  private static instance: BillingDatabaseConfig;
  private initialized = false;

  private constructor() {}

  /**
   * Singleton pattern to ensure single database configuration instance
   */
  public static getInstance(): BillingDatabaseConfig {
    if (!BillingDatabaseConfig.instance) {
      BillingDatabaseConfig.instance = new BillingDatabaseConfig();
    }
    return BillingDatabaseConfig.instance;
  }

  /**
   * Initialize database connection for billing service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Billing Service database already initialized', {
        service: 'billing-service',
      });
      return;
    }

    try {
      logger.info('Initializing Billing Service database connection...', {
        service: 'billing-service',
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
      });

      // Use shared database connection initialization
      await DatabaseConnection.initializeDatabase();

      // Set search path for billing service schema
      const schema = process.env.DB_SCHEMA || 'public';
      const pool = DatabaseConnection.getPool();
      await pool.query(`SET search_path TO ${schema}, public`);

      // Verify connection and check billing tables
      const result = await pool.query('SELECT NOW() as current_time, current_database() as database');

      // Verify billing tables exist
      const tablesCheck = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name IN ('invoices', 'invoice_items', 'tenant_subscriptions', 'subscription_plans', 'usage_records')
        ORDER BY table_name
      `, [schema]);

      const existingTables = tablesCheck.rows.map((row: any) => row.table_name);
      const requiredTables = ['invoices', 'invoice_items', 'subscription_plans', 'tenant_subscriptions', 'usage_records'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        logger.warn('Some billing tables are missing', {
          service: 'billing-service',
          missingTables,
          existingTables,
        });
      }

      this.initialized = true;

      logger.info('Billing Service database connection established', {
        service: 'billing-service',
        database: result.rows[0].database,
        timestamp: result.rows[0].current_time,
        poolSize: pool.totalCount,
        tables: existingTables,
      });

    } catch (error) {
      logger.error('Failed to initialize Billing Service database connection', {
        service: 'billing-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get the database connection pool
   */
  public getPool(): Pool {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return DatabaseConnection.getPool();
  }

  /**
   * Execute a query with automatic error handling and logging
   */
  public async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const start = Date.now();

    try {
      const result = await DatabaseConnection.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Database query executed', {
        service: 'billing-service',
        duration,
        rows: result.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Database query failed', {
        service: 'billing-service',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        query: text.substring(0, 100), // Log first 100 chars of query
      });

      throw error;
    }
  }

  /**
   * Execute a query and return single result
   */
  public async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const start = Date.now();

    try {
      const result = await DatabaseConnection.queryOne<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Database query executed', {
        service: 'billing-service',
        duration,
        found: result !== null,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Database query failed', {
        service: 'billing-service',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        query: text.substring(0, 100),
      });

      throw error;
    }
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  public async transaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      logger.debug('Database transaction started', { service: 'billing-service' });

      const result = await callback(client);

      await client.query('COMMIT');
      logger.debug('Database transaction committed', { service: 'billing-service' });

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Database transaction rolled back', {
        service: 'billing-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Set tenant context for Row-Level Security
   */
  public async setTenantContext(tenantId: string, queryClient?: any): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const executor = queryClient || this.getPool();

    try {
      await executor.query('SELECT set_config($1, $2, false)', [
        'app.current_tenant_id',
        tenantId,
      ]);

      logger.debug('Tenant context set', {
        service: 'billing-service',
        tenantId,
      });
    } catch (error) {
      logger.error('Failed to set tenant context', {
        service: 'billing-service',
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clear tenant context
   */
  public async clearTenantContext(queryClient?: any): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const executor = queryClient || this.getPool();

    try {
      await executor.query('SELECT set_config($1, $2, false)', [
        'app.current_tenant_id',
        '',
      ]);

      logger.debug('Tenant context cleared', {
        service: 'billing-service',
      });
    } catch (error) {
      logger.error('Failed to clear tenant context', {
        service: 'billing-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Health check for database connection
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    if (!this.initialized) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: 'Database not initialized',
        },
      };
    }

    try {
      const pool = this.getPool();
      const start = Date.now();
      await pool.query('SELECT 1 as health_check');
      const duration = Date.now() - start;

      return {
        status: 'healthy',
        details: {
          connected: true,
          responseTime: `${duration}ms`,
          poolSize: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingRequests: pool.waitingCount,
        },
      };
    } catch (error) {
      logger.error('Database health check failed', {
        service: 'billing-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Get billing-specific database statistics
   */
  public async getBillingStats(): Promise<{
    invoices: { total: number; draft: number; open: number; paid: number };
    subscriptions: { total: number; active: number; cancelled: number };
    usageRecords: { total: number; lastRecordedAt: string | null };
  }> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      const pool = this.getPool();

      // Get invoice stats
      const invoiceStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'draft') as draft,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'paid') as paid
        FROM invoices
      `);

      // Get subscription stats
      const subscriptionStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
        FROM tenant_subscriptions
        WHERE deleted_at IS NULL
      `);

      // Get usage stats
      const usageStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          MAX(recorded_at) as last_recorded_at
        FROM usage_records
      `);

      return {
        invoices: {
          total: parseInt(invoiceStats.rows[0].total, 10),
          draft: parseInt(invoiceStats.rows[0].draft, 10),
          open: parseInt(invoiceStats.rows[0].open, 10),
          paid: parseInt(invoiceStats.rows[0].paid, 10),
        },
        subscriptions: {
          total: parseInt(subscriptionStats.rows[0].total, 10),
          active: parseInt(subscriptionStats.rows[0].active, 10),
          cancelled: parseInt(subscriptionStats.rows[0].cancelled, 10),
        },
        usageRecords: {
          total: parseInt(usageStats.rows[0].total, 10),
          lastRecordedAt: usageStats.rows[0].last_recorded_at,
        },
      };
    } catch (error) {
      logger.error('Failed to get billing stats', {
        service: 'billing-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        invoices: { total: 0, draft: 0, open: 0, paid: 0 },
        subscriptions: { total: 0, active: 0, cancelled: 0 },
        usageRecords: { total: 0, lastRecordedAt: null },
      };
    }
  }

  /**
   * Gracefully close database connection pool
   */
  public async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await DatabaseConnection.closeDatabase();
      this.initialized = false;

      logger.info('Billing Service database connection closed', {
        service: 'billing-service',
      });
    } catch (error) {
      logger.error('Error closing Billing Service database connection', {
        service: 'billing-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get connection pool statistics
   */
  public getPoolStats(): {
    total: number;
    idle: number;
    waiting: number;
  } {
    if (!this.initialized) {
      return { total: 0, idle: 0, waiting: 0 };
    }

    const pool = this.getPool();
    return {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
  }

  /**
   * Check if database is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const billingDatabase = BillingDatabaseConfig.getInstance();

// Export class for testing purposes
export { BillingDatabaseConfig };
