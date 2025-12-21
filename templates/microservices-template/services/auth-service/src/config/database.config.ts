import { Pool } from 'pg';
import { logger } from '@shared/utils/logger';
import * as DatabaseConnection from '@shared/database/connection';

/**
 * Database Configuration for Auth Service
 * Wraps shared database connection with auth-specific features
 */

class AuthDatabaseConfig {
  private static instance: AuthDatabaseConfig;
  private initialized = false;

  private constructor() {}

  /**
   * Singleton pattern to ensure single database configuration instance
   */
  public static getInstance(): AuthDatabaseConfig {
    if (!AuthDatabaseConfig.instance) {
      AuthDatabaseConfig.instance = new AuthDatabaseConfig();
    }
    return AuthDatabaseConfig.instance;
  }

  /**
   * Initialize database connection for auth service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Auth Service database already initialized', {
        service: 'auth-service',
      });
      return;
    }

    try {
      logger.info('Initializing Auth Service database connection...', {
        service: 'auth-service',
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
      });

      // Use shared database connection initialization
      await DatabaseConnection.initializeDatabase();

      // Set search path for auth service schema
      const schema = process.env.DB_SCHEMA || 'public';
      const pool = DatabaseConnection.getPool();
      await pool.query(`SET search_path TO ${schema}, public`);

      // Verify connection
      const result = await pool.query('SELECT NOW() as current_time, current_database() as database');
      
      this.initialized = true;

      logger.info('Auth Service database connection established', {
        service: 'auth-service',
        database: result.rows[0].database,
        timestamp: result.rows[0].current_time,
        poolSize: pool.totalCount,
      });

    } catch (error) {
      logger.error('Failed to initialize Auth Service database connection', {
        service: 'auth-service',
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
        service: 'auth-service',
        duration,
        rows: result.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.error('Database query failed', {
        service: 'auth-service',
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
        service: 'auth-service',
        duration,
        found: result !== null,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Database query failed', {
        service: 'auth-service',
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
      logger.debug('Database transaction started', { service: 'auth-service' });

      const result = await callback(client);

      await client.query('COMMIT');
      logger.debug('Database transaction committed', { service: 'auth-service' });

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Database transaction rolled back', {
        service: 'auth-service',
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
        service: 'auth-service',
        tenantId,
      });
    } catch (error) {
      logger.error('Failed to set tenant context', {
        service: 'auth-service',
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
        service: 'auth-service',
      });
    } catch (error) {
      logger.error('Failed to clear tenant context', {
        service: 'auth-service',
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
        service: 'auth-service',
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
   * Gracefully close database connection pool
   */
  public async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await DatabaseConnection.closeDatabase();
      this.initialized = false;

      logger.info('Auth Service database connection closed', {
        service: 'auth-service',
      });
    } catch (error) {
      logger.error('Error closing Auth Service database connection', {
        service: 'auth-service',
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
export const authDatabase = AuthDatabaseConfig.getInstance();

// Export class for testing purposes
export { AuthDatabaseConfig };