/**
 * Environment Setup - Runs BEFORE test framework initialization
 * This ensures environment variables are loaded before any module imports
 */

import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables FIRST before any other imports
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

// Set critical environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'cloudbill_test';
process.env.DB_PORT = process.env.DB_PORT || '5433';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

console.log('🧪 Test environment configured:');
console.log(`   Database: ${process.env.DB_NAME}`);
console.log(`   Port: ${process.env.DB_PORT}`);
console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
