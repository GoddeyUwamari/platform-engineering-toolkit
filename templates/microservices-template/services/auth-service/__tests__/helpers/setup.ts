/**
 * Test Setup and Teardown
 * Configures test environment, database, and mocks
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { authDatabase } from '../../src/config/database.config';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'cloudbill_test';
process.env.DB_PORT = process.env.DB_PORT || '5433';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key';

// Test database pool
let testPool: Pool | null = null;

/**
 * Initialize test database connection
 */
export async function setupTestDatabase(): Promise<Pool> {
  if (testPool) {
    return testPool;
  }

  testPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    database: process.env.DB_NAME || 'cloudbill_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: false,
  });

  try {
    // Test connection
    const client = await testPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Test database connected successfully');

    // Initialize auth database (this sets the initialized flag to true)
    // The shared database connection mock in the test file will use testPool
    if (!authDatabase.isInitialized()) {
      await authDatabase.initialize();
      console.log('Auth database initialized for tests');
    }
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }

  return testPool;
}

/**
 * Clean test database - removes all test data
 */
export async function cleanTestDatabase(): Promise<void> {
  if (!testPool) {
    return;
  }

  try {
    // Disable RLS for testing (keep it disabled for test duration)
    await testPool.query('ALTER TABLE users DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE tenants DISABLE ROW LEVEL SECURITY');

    // Clean tables in reverse order of dependencies
    await testPool.query('DELETE FROM users');
    await testPool.query('DELETE FROM tenants');

    // Keep RLS disabled for tests to avoid connection pool context issues
    console.log('Test database cleaned');
  } catch (error) {
    console.error('Failed to clean test database:', error);
    throw error;
  }
}

/**
 * Close test database connection
 */
export async function teardownTestDatabase(): Promise<void> {
  // Close auth database connection first
  if (authDatabase.isInitialized()) {
    await authDatabase.close();
    console.log('Auth database connection closed');
  }

  if (testPool) {
    await testPool.end();
    testPool = null;
    console.log('Test database connection closed');
  }
}

/**
 * Get test database pool
 */
export function getTestPool(): Pool {
  if (!testPool) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testPool;
}

// Jest global setup and teardown
beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await cleanTestDatabase();
  await teardownTestDatabase();
});

// Clean database before each test
beforeEach(async () => {
  await cleanTestDatabase();
});

// Export for direct use in tests
export { testPool };
