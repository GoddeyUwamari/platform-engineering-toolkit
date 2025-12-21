/**
 * PostgreSQL Database Connection Manager
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'cloudbill',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
  // FIXED: Explicitly set ssl to false for non-production environments
  ssl: false,
};

let pool: Pool | null = null;

export const initializeDatabase = async (): Promise<void> => {
  try {
    console.log('=== DATABASE CONFIG ===');
    console.log('Host:', poolConfig.host);
    console.log('Port:', poolConfig.port);
    console.log('Database:', poolConfig.database);
    console.log('User:', poolConfig.user);
    console.log('SSL:', poolConfig.ssl);
    console.log('======================');

    pool = new Pool(poolConfig);
    
    console.log('Connecting to database...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Database connected successfully!');

    logger.info('Database connection pool initialized successfully', {
      host: poolConfig.host,
      database: poolConfig.database,
      poolSize: `${poolConfig.min}-${poolConfig.max}`,
      serverTime: result.rows[0].now,
    });

    pool.on('error', (err: Error) => {
      logger.error('Unexpected database pool error', {
        error: err.message,
        stack: err.stack,
      });
    });
  } catch (error) {
    console.error('=== DATABASE ERROR ===');
    console.error('Full error:', error);
    console.error('======================');
    
    logger.error('Failed to initialize database connection pool', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
};

export const getClient = async (): Promise<PoolClient> => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return await pool.connect();
};

export const query = async <T = any>(text: string, params?: any[]): Promise<T[]> => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }

  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (error) {
    logger.error('Query execution failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: text.substring(0, 100),
    });
    throw error;
  }
};

export const queryOne = async <T = any>(text: string, params?: any[]): Promise<T | null> => {
  const results = await query<T>(text, params);
  return results.length > 0 && results[0] !== undefined ? results[0] : null;
};

export const setTenantContext = async (tenantId: string, client?: PoolClient): Promise<void> => {
  const executor = client || pool;
  if (!executor) {
    throw new Error('Database pool not initialized');
  }

  await executor.query('SELECT set_config($1, $2, false)', [
    'app.current_tenant_id',
    tenantId,
  ]);
};

export const clearTenantContext = async (client?: PoolClient): Promise<void> => {
  const executor = client || pool;
  if (!executor) {
    throw new Error('Database pool not initialized');
  }

  await executor.query('SELECT set_config($1, $2, false)', [
    'app.current_tenant_id',
    '',
  ]);
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
};
