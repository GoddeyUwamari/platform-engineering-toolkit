"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisInfo = exports.checkRedisHealth = exports.isRedisConnected = exports.disconnectRedis = exports.getRedisClient = exports.connectRedis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
let redisClient = null;
const getRedisConfig = () => {
    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6380', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            logger_1.logger.info(`🔄 Redis retry attempt ${times}, waiting ${delay}ms`);
            return delay;
        },
    };
};
const connectRedis = async () => {
    if (redisClient) {
        logger_1.logger.info('♻️  Redis client already connected');
        return redisClient;
    }
    try {
        const config = getRedisConfig();
        logger_1.logger.info('🔌 Connecting to Redis...', {
            host: config.host,
            port: config.port,
            db: config.db,
        });
        redisClient = new ioredis_1.default(config);
        redisClient.on('connect', () => {
            logger_1.logger.info('📡 Redis connecting...');
        });
        redisClient.on('ready', () => {
            logger_1.logger.info('✅ Redis connected and ready!', {
                host: config.host,
                port: config.port,
                db: config.db,
            });
        });
        redisClient.on('error', (error) => {
            logger_1.logger.error('❌ Redis error:', {
                message: error.message,
            });
        });
        redisClient.on('close', () => {
            logger_1.logger.warn('⚠️  Redis connection closed');
        });
        redisClient.on('reconnecting', (delay) => {
            logger_1.logger.info(`🔄 Redis reconnecting in ${delay}ms...`);
        });
        redisClient.on('end', () => {
            logger_1.logger.warn('🛑 Redis connection ended');
            redisClient = null;
        });
        const pingResult = await redisClient.ping();
        if (pingResult === 'PONG') {
            logger_1.logger.info('🏓 Redis PING successful - Connection verified!');
        }
        else {
            throw new Error(`Redis PING failed: received "${pingResult}" instead of "PONG"`);
        }
        return redisClient;
    }
    catch (error) {
        logger_1.logger.error('💥 Failed to connect to Redis:', {
            error: error instanceof Error ? error.message : String(error),
        });
        if (redisClient) {
            await redisClient.quit();
            redisClient = null;
        }
        throw error;
    }
};
exports.connectRedis = connectRedis;
const getRedisClient = () => {
    if (!redisClient) {
        throw new Error('❌ Redis client not initialized! Call connectRedis() during app startup.');
    }
    if (redisClient.status !== 'ready') {
        logger_1.logger.warn(`⚠️  Redis status: ${redisClient.status}`);
    }
    return redisClient;
};
exports.getRedisClient = getRedisClient;
const disconnectRedis = async () => {
    if (redisClient) {
        try {
            logger_1.logger.info('👋 Closing Redis connection...');
            await redisClient.quit();
            redisClient = null;
            logger_1.logger.info('✅ Redis disconnected successfully');
        }
        catch (error) {
            logger_1.logger.error('❌ Error disconnecting Redis:', {
                error: error instanceof Error ? error.message : String(error),
            });
            if (redisClient) {
                redisClient.disconnect();
                redisClient = null;
            }
        }
    }
    else {
        logger_1.logger.info('ℹ️  Redis already disconnected');
    }
};
exports.disconnectRedis = disconnectRedis;
const isRedisConnected = () => {
    return redisClient !== null && redisClient.status === 'ready';
};
exports.isRedisConnected = isRedisConnected;
const checkRedisHealth = async () => {
    try {
        if (!redisClient) {
            logger_1.logger.warn('⚠️  Redis health check: Client not initialized');
            return false;
        }
        if (redisClient.status !== 'ready') {
            logger_1.logger.warn(`⚠️  Redis health check: Status is "${redisClient.status}"`);
            return false;
        }
        const result = await redisClient.ping();
        if (result === 'PONG') {
            logger_1.logger.debug('✅ Redis health check passed');
            return true;
        }
        else {
            logger_1.logger.warn(`⚠️  Redis health check: Unexpected response "${result}"`);
            return false;
        }
    }
    catch (error) {
        logger_1.logger.error('❌ Redis health check failed:', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
};
exports.checkRedisHealth = checkRedisHealth;
const getRedisInfo = () => {
    if (!redisClient) {
        return {
            connected: false,
            status: 'not_initialized',
        };
    }
    return {
        connected: redisClient.status === 'ready',
        status: redisClient.status,
        host: redisClient.options.host,
        port: redisClient.options.port,
        db: redisClient.options.db,
    };
};
exports.getRedisInfo = getRedisInfo;
//# sourceMappingURL=redis-connection.js.map