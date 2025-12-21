"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.clearTenantContext = exports.setTenantContext = exports.queryOne = exports.query = exports.getClient = exports.getPool = exports.initializeDatabase = void 0;
const pg_1 = require("pg");
const logger_1 = require("../utils/logger");
const poolConfig = {
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
    ssl: false,
};
let pool = null;
const initializeDatabase = async () => {
    try {
        console.log('=== DATABASE CONFIG ===');
        console.log('Host:', poolConfig.host);
        console.log('Port:', poolConfig.port);
        console.log('Database:', poolConfig.database);
        console.log('User:', poolConfig.user);
        console.log('SSL:', poolConfig.ssl);
        console.log('======================');
        pool = new pg_1.Pool(poolConfig);
        console.log('Connecting to database...');
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        console.log('Database connected successfully!');
        logger_1.logger.info('Database connection pool initialized successfully', {
            host: poolConfig.host,
            database: poolConfig.database,
            poolSize: `${poolConfig.min}-${poolConfig.max}`,
            serverTime: result.rows[0].now,
        });
        pool.on('error', (err) => {
            logger_1.logger.error('Unexpected database pool error', {
                error: err.message,
                stack: err.stack,
            });
        });
    }
    catch (error) {
        console.error('=== DATABASE ERROR ===');
        console.error('Full error:', error);
        console.error('======================');
        logger_1.logger.error('Failed to initialize database connection pool', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
};
exports.initializeDatabase = initializeDatabase;
const getPool = () => {
    if (!pool) {
        throw new Error('Database pool not initialized. Call initializeDatabase() first.');
    }
    return pool;
};
exports.getPool = getPool;
const getClient = async () => {
    if (!pool) {
        throw new Error('Database pool not initialized. Call initializeDatabase() first.');
    }
    return await pool.connect();
};
exports.getClient = getClient;
const query = async (text, params) => {
    if (!pool) {
        throw new Error('Database pool not initialized. Call initializeDatabase() first.');
    }
    try {
        const result = await pool.query(text, params);
        return result.rows;
    }
    catch (error) {
        logger_1.logger.error('Query execution failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            query: text.substring(0, 100),
        });
        throw error;
    }
};
exports.query = query;
const queryOne = async (text, params) => {
    const results = await (0, exports.query)(text, params);
    return results.length > 0 && results[0] !== undefined ? results[0] : null;
};
exports.queryOne = queryOne;
const setTenantContext = async (tenantId, client) => {
    const executor = client || pool;
    if (!executor) {
        throw new Error('Database pool not initialized');
    }
    await executor.query('SELECT set_config($1, $2, false)', [
        'app.current_tenant_id',
        tenantId,
    ]);
};
exports.setTenantContext = setTenantContext;
const clearTenantContext = async (client) => {
    const executor = client || pool;
    if (!executor) {
        throw new Error('Database pool not initialized');
    }
    await executor.query('SELECT set_config($1, $2, false)', [
        'app.current_tenant_id',
        '',
    ]);
};
exports.clearTenantContext = clearTenantContext;
const closeDatabase = async () => {
    if (pool) {
        await pool.end();
        pool = null;
        logger_1.logger.info('Database connection pool closed');
    }
};
exports.closeDatabase = closeDatabase;
//# sourceMappingURL=connection.js.map