/**
 * Jest Global Setup
 * Runs once before all test suites
 * Sets up environment variables before any modules are loaded
 */

// Set test environment variables BEFORE any TypeScript code runs
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'cloudbill_test';
process.env.DB_PORT = '5433';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
