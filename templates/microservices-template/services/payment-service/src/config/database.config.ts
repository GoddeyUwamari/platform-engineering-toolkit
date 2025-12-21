import { Pool } from 'pg';
import { logger } from '@shared/utils/logger';
import * as DatabaseConnection from '@shared/database/connection';

/**
 * Database Configuration for Payment Service
 * Wraps shared database connection with payment-specific features
 */

class PaymentDatabaseConfig {
  private static instance: PaymentDatabaseConfig;
  private initialized = false;

  private constructor() {}

  /**
   * Singleton pattern to ensure single database configuration instance
   */
  public static getInstance(): PaymentDatabaseConfig {
    if (!PaymentDatabaseConfig.instance) {
      PaymentDatabaseConfig.instance = new PaymentDatabaseConfig();
    }
    return PaymentDatabaseConfig.instance;
  }

  /**
   * Initialize database connection for payment service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Payment Service database already initialized', {
        service: 'payment-service',
      });
      return;
    }

    try {
      logger.info('Initializing Payment Service database connection...', {
        service: 'payment-service',
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
      });

      // Use shared database connection initialization
      await DatabaseConnection.initializeDatabase();

      // Set search path for payment service schema
      const schema = process.env.DB_SCHEMA || 'public';
      const pool = DatabaseConnection.getPool();
      await pool.query(`SET search_path TO ${schema}, public`);

      // Verify connection and check payment tables
      const result = await pool.query('SELECT NOW() as current_time, current_database() as database');

      // Verify payment tables exist
      const tablesCheck = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name IN ('payments', 'payment_methods', 'refunds', 'stripe_customers', 'payment_intents')
        ORDER BY table_name
      `, [schema]);

      const existingTables = tablesCheck.rows.map((row: any) => row.table_name);
      const requiredTables = ['payments', 'payment_methods', 'refunds'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        logger.warn('Some payment tables are missing', {
          service: 'payment-service',
          missingTables,
          existingTables,
        });
      }

      this.initialized = true;

      logger.info('Payment Service database connection established', {
        service: 'payment-service',
        database: result.rows[0].database,
        timestamp: result.rows[0].current_time,
        poolSize: pool.totalCount,
        tables: existingTables,
      });

    } catch (error) {
      logger.error('Failed to initialize Payment Service database connection', {
        service: 'payment-service',
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
        service: 'payment-service',
        duration,
        rows: result.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Database query failed', {
        service: 'payment-service',
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
        service: 'payment-service',
        duration,
        found: result !== null,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Database query failed', {
        service: 'payment-service',
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
      logger.debug('Database transaction started', { service: 'payment-service' });

      const result = await callback(client);

      await client.query('COMMIT');
      logger.debug('Database transaction committed', { service: 'payment-service' });

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Database transaction rolled back', {
        service: 'payment-service',
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
        service: 'payment-service',
        tenantId,
      });
    } catch (error) {
      logger.error('Failed to set tenant context', {
        service: 'payment-service',
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
        service: 'payment-service',
      });
    } catch (error) {
      logger.error('Failed to clear tenant context', {
        service: 'payment-service',
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
        service: 'payment-service',
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
   * Get payment-specific database statistics
   */
  public async getPaymentStats(): Promise<{
    payments: { total: number; succeeded: number; failed: number; pending: number };
    paymentMethods: { total: number; active: number };
    refunds: { total: number; succeeded: number; pending: number };
  }> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      const pool = this.getPool();

      // Get payment stats
      const paymentStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE status = 'pending') as pending
        FROM payments
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments')
      `);

      // Get payment method stats
      const paymentMethodStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_default = true) as active
        FROM payment_methods
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_methods')
      `);

      // Get refund stats
      const refundStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
          COUNT(*) FILTER (WHERE status = 'pending') as pending
        FROM refunds
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refunds')
      `);

      return {
        payments: {
          total: parseInt(paymentStats.rows[0]?.total || '0', 10),
          succeeded: parseInt(paymentStats.rows[0]?.succeeded || '0', 10),
          failed: parseInt(paymentStats.rows[0]?.failed || '0', 10),
          pending: parseInt(paymentStats.rows[0]?.pending || '0', 10),
        },
        paymentMethods: {
          total: parseInt(paymentMethodStats.rows[0]?.total || '0', 10),
          active: parseInt(paymentMethodStats.rows[0]?.active || '0', 10),
        },
        refunds: {
          total: parseInt(refundStats.rows[0]?.total || '0', 10),
          succeeded: parseInt(refundStats.rows[0]?.succeeded || '0', 10),
          pending: parseInt(refundStats.rows[0]?.pending || '0', 10),
        },
      };
    } catch (error) {
      logger.error('Failed to get payment stats', {
        service: 'payment-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        payments: { total: 0, succeeded: 0, failed: 0, pending: 0 },
        paymentMethods: { total: 0, active: 0 },
        refunds: { total: 0, succeeded: 0, pending: 0 },
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

      logger.info('Payment Service database connection closed', {
        service: 'payment-service',
      });
    } catch (error) {
      logger.error('Error closing Payment Service database connection', {
        service: 'payment-service',
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
export const paymentDatabase = PaymentDatabaseConfig.getInstance();

// Export class for testing purposes
export { PaymentDatabaseConfig };
