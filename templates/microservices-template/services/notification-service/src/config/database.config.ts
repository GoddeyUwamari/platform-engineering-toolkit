import { Pool } from 'pg';
import { logger } from '@shared/utils/logger';
import * as DatabaseConnection from '@shared/database/connection';

/**
 * Database Configuration for Notification Service
 * Wraps shared database connection with notification-specific features
 */

class NotificationDatabaseConfig {
  private static instance: NotificationDatabaseConfig;
  private initialized = false;

  private constructor() {}

  /**
   * Singleton pattern to ensure single database configuration instance
   */
  public static getInstance(): NotificationDatabaseConfig {
    if (!NotificationDatabaseConfig.instance) {
      NotificationDatabaseConfig.instance = new NotificationDatabaseConfig();
    }
    return NotificationDatabaseConfig.instance;
  }

  /**
   * Initialize database connection for notification service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Notification Service database already initialized', {
        service: 'notification-service',
      });
      return;
    }

    try {
      logger.info('Initializing Notification Service database connection...', {
        service: 'notification-service',
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
      });

      // Use shared database connection initialization
      await DatabaseConnection.initializeDatabase();

      // Set search path for notification service schema
      const schema = process.env.DB_SCHEMA || 'public';
      const pool = DatabaseConnection.getPool();
      await pool.query(`SET search_path TO ${schema}, public`);

      // Verify connection
      const result = await pool.query('SELECT NOW() as current_time, current_database() as database');

      // Verify notification tables exist
      const tablesCheck = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name IN ('notifications', 'notification_templates')
        ORDER BY table_name
      `, [schema]);

      const existingTables = tablesCheck.rows.map((row: any) => row.table_name);
      const requiredTables = ['notifications', 'notification_templates'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        logger.warn('Some notification tables are missing', {
          service: 'notification-service',
          missingTables,
          existingTables,
        });
      }

      this.initialized = true;

      logger.info('Notification Service database connection established', {
        service: 'notification-service',
        database: result.rows[0].database,
        timestamp: result.rows[0].current_time,
        poolSize: pool.totalCount,
        tables: existingTables,
      });

    } catch (error) {
      logger.error('Failed to initialize Notification Service database connection', {
        service: 'notification-service',
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
        service: 'notification-service',
        duration,
        rows: result.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Database query failed', {
        service: 'notification-service',
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
        service: 'notification-service',
        duration,
        found: result !== null,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Database query failed', {
        service: 'notification-service',
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
      logger.debug('Database transaction started', { service: 'notification-service' });

      const result = await callback(client);

      await client.query('COMMIT');
      logger.debug('Database transaction committed', { service: 'notification-service' });

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Database transaction rolled back', {
        service: 'notification-service',
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
        service: 'notification-service',
        tenantId,
      });
    } catch (error) {
      logger.error('Failed to set tenant context', {
        service: 'notification-service',
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
        service: 'notification-service',
      });
    } catch (error) {
      logger.error('Failed to clear tenant context', {
        service: 'notification-service',
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
        service: 'notification-service',
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
   * Get notification-specific database statistics
   */
  public async getNotificationStats(): Promise<{
    notifications: { total: number; sent: number; pending: number; failed: number };
    templates: { total: number; active: number };
    recentActivity: { lastSentAt: string | null; sentLast24h: number };
  }> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      const pool = this.getPool();

      // Get notification stats
      const notificationStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'sent') as sent,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM notifications
        WHERE deleted_at IS NULL
      `);

      // Get template stats
      const templateStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active
        FROM notification_templates
        WHERE deleted_at IS NULL
      `);

      // Get recent activity
      const recentActivity = await pool.query(`
        SELECT
          MAX(sent_at) as last_sent_at,
          COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '24 hours') as sent_last_24h
        FROM notifications
        WHERE status = 'sent'
      `);

      return {
        notifications: {
          total: parseInt(notificationStats.rows[0].total, 10),
          sent: parseInt(notificationStats.rows[0].sent, 10),
          pending: parseInt(notificationStats.rows[0].pending, 10),
          failed: parseInt(notificationStats.rows[0].failed, 10),
        },
        templates: {
          total: parseInt(templateStats.rows[0].total, 10),
          active: parseInt(templateStats.rows[0].active, 10),
        },
        recentActivity: {
          lastSentAt: recentActivity.rows[0].last_sent_at,
          sentLast24h: parseInt(recentActivity.rows[0].sent_last_24h, 10),
        },
      };
    } catch (error) {
      logger.error('Failed to get notification stats', {
        service: 'notification-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        notifications: { total: 0, sent: 0, pending: 0, failed: 0 },
        templates: { total: 0, active: 0 },
        recentActivity: { lastSentAt: null, sentLast24h: 0 },
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

      logger.info('Notification Service database connection closed', {
        service: 'notification-service',
      });
    } catch (error) {
      logger.error('Error closing Notification Service database connection', {
        service: 'notification-service',
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
export const notificationDatabase = NotificationDatabaseConfig.getInstance();

// Export class for testing purposes
export { NotificationDatabaseConfig };
