/**
 * Test Setup for Notification Service
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
    await testPool.query('DELETE FROM notifications');
    await testPool.query('DELETE FROM notification_templates');
  } catch (error) {
    console.error('Failed to clean test database:', error);
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
  await setupTestDatabase();
});

afterAll(async () => {
  await cleanTestDatabase();
  await teardownTestDatabase();
});

beforeEach(async () => {
  await cleanTestDatabase();
});

export { testPool };
