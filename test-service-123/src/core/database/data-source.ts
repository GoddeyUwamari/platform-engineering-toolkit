import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from '../../config/environment';
import { User } from '../../models/user.entity';
import { Task } from '../../models/task.entity';

/**
 * TypeORM DataSource Configuration
 *
 * This configuration follows production best practices:
 * - Connection pooling for performance
 * - Automatic synchronization disabled in production
 * - Migrations for schema management
 * - Query logging in development only
 * - SSL support for production databases
 */

const baseOptions: DataSourceOptions = {
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.user,
  password: config.database.password,
  database: config.database.name,

  // Entity configuration
  entities: [User, Task],

  // Migration configuration
  migrations: ['src/migrations/**/*.ts'],
  migrationsTableName: 'migrations',

  // Connection pool settings for production performance
  extra: {
    min: config.database.pool.min,
    max: config.database.pool.max,
    // Connection timeout: 30 seconds
    connectionTimeoutMillis: 30000,
    // Idle timeout: 10 seconds
    idleTimeoutMillis: 10000,
  },

  // Synchronize schema automatically (ONLY in development)
  // In production, always use migrations
  synchronize: config.node_env === 'development',

  // Log queries in development for debugging
  logging: config.node_env === 'development' ? ['query', 'error', 'warn'] : ['error'],

  // SSL configuration for production
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
};

// Create and export the DataSource
export const AppDataSource = new DataSource(baseOptions);

/**
 * Initialize database connection with retry logic
 * Implements exponential backoff for connection failures
 */
export const initializeDatabase = async (maxRetries = 3): Promise<DataSource> => {
  let retries = 0;
  let lastError: Error | null = null;

  while (retries < maxRetries) {
    try {
      console.info('🔌 Attempting to connect to database...');

      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      console.info('✅ Database connection established successfully');
      console.info(`📊 Database: ${config.database.name}`);
      console.info(`🏢 Host: ${config.database.host}:${config.database.port}`);
      console.info(`🔧 Connection pool: ${config.database.pool.min}-${config.database.pool.max}`);

      return AppDataSource;
    } catch (error) {
      lastError = error as Error;
      retries++;

      console.error(`❌ Database connection attempt ${retries}/${maxRetries} failed:`, error);

      if (retries < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const waitTime = Math.pow(2, retries) * 1000;
        console.info(`⏳ Retrying in ${waitTime / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error('❌ Failed to connect to database after maximum retries');
  throw new Error(`Database connection failed after ${maxRetries} attempts: ${lastError?.message}`);
};

/**
 * Close database connection gracefully
 */
export const closeDatabase = async (): Promise<void> => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.info('✅ Database connection closed gracefully');
    }
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    throw error;
  }
};

/**
 * Check database health status
 */
export const checkDatabaseHealth = async (): Promise<{
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
}> => {
  try {
    if (!AppDataSource.isInitialized) {
      return {
        healthy: false,
        message: 'Database not initialized',
      };
    }

    // Execute a simple query to verify connection
    await AppDataSource.query('SELECT 1');

    return {
      healthy: true,
      message: 'Database connection is healthy',
      details: {
        database: config.database.name,
        host: config.database.host,
        port: config.database.port,
        isConnected: AppDataSource.isInitialized,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      message: 'Database health check failed',
      details: {
        error: (error as Error).message,
      },
    };
  }
};
