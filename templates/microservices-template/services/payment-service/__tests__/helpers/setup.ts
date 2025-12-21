/**
 * Test Setup for Payment Service
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.test') });

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'cloudbill_test';

let testPool: Pool | null = null;

export async function setupTestDatabase(): Promise<Pool> {
  if (testPool) return testPool;

  testPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    database: process.env.DB_NAME || 'cloudbill_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: false,
  });

  const client = await testPool.connect();
  await client.query('SELECT NOW()');
  client.release();
  console.log('Test database connected successfully');

  return testPool;
}

export async function cleanTestDatabase(): Promise<void> {
  if (!testPool) return;

  try {
    // Disable RLS for all payment tables
    await testPool.query('ALTER TABLE IF EXISTS transactions DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS refunds DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS payment_methods DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY');
    await testPool.query('ALTER TABLE IF EXISTS tenants DISABLE ROW LEVEL SECURITY');

    // Clean tables in reverse order of dependencies
    await testPool.query('DELETE FROM transactions');
    await testPool.query('DELETE FROM refunds');
    await testPool.query('DELETE FROM payments');
    await testPool.query('DELETE FROM payment_methods');
    await testPool.query('DELETE FROM invoices');
    await testPool.query('DELETE FROM users');
    await testPool.query('DELETE FROM tenants');

    console.log('Test database cleaned successfully');
  } catch (error) {
    console.error('Failed to clean test database:', error);
    // Don't throw error if database is not available (for unit tests)
  }
}

export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

export function getTestPool(): Pool {
  if (!testPool) {
    throw new Error('Test database not initialized');
  }
  return testPool;
}

beforeAll(async () => {
  // Only setup database for integration tests (unit tests use mocks)
  const testPath = expect.getState().testPath || '';
  if (testPath.includes('/integration/')) {
    await setupTestDatabase();
  }
});

afterAll(async () => {
  const testPath = expect.getState().testPath || '';
  if (testPath.includes('/integration/')) {
    await cleanTestDatabase();
    await teardownTestDatabase();
  }
});

beforeEach(async () => {
  const testPath = expect.getState().testPath || '';
  if (testPath.includes('/integration/')) {
    await cleanTestDatabase();
  }
});

export { testPool };
