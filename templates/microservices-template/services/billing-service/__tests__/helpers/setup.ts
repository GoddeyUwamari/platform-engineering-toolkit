/**
 * Test Setup and Teardown for Billing Service
 * Configures test environment, database, and mocks
 *
 * Note: Environment variables are loaded in env-setup.ts which runs first
 */

import { Pool } from 'pg';
import { billingDatabase } from '../../src/config/database.config';

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
    // Disable RLS for testing
    await testPool.query('ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS invoice_items DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS tenant_subscriptions DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS subscription_plans DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS usage_records DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS tenants DISABLE ROW LEVEL SECURITY');

    // Clean tables in reverse order of dependencies
    await testPool.query('DELETE FROM invoice_items');
    await testPool.query('DELETE FROM invoices');
    await testPool.query('DELETE FROM usage_records');
    await testPool.query('DELETE FROM tenant_subscriptions');
    await testPool.query('DELETE FROM users');
    await testPool.query("DELETE FROM tenants WHERE id != '00000000-0000-0000-0000-000000000001'");
    // Don't delete subscription_plans as they are seed data

    // Re-create default tenant for validation tests
    await testPool.query(`
      INSERT INTO tenants (id, name, slug, billing_email, plan, status, created_at, updated_at)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Demo Company',
        'demo',
        'admin@democompany.com',
        'PROFESSIONAL',
        'ACTIVE',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        billing_email = EXCLUDED.billing_email,
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        updated_at = NOW()
    `);

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
  // Initialize billing database for app usage
  try {
    await billingDatabase.initialize();
  } catch (error) {
    console.error('Failed to initialize billing database:', error);
  }
});

afterAll(async () => {
  await cleanTestDatabase();
  await billingDatabase.close();
  await teardownTestDatabase();
});

// Clean database before each test
beforeEach(async () => {
  await cleanTestDatabase();
});

// Export for direct use in tests
export { testPool };
