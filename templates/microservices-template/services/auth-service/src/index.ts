// ============================================================================
// Early console logging to debug startup issues
// ============================================================================
console.log('[AUTH-SERVICE] Starting initialization...');

// ============================================================================
// Load Environment Variables FIRST
// ============================================================================
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
console.log('[AUTH-SERVICE] Environment loaded');

// ============================================================================
// Application Imports
// ============================================================================
console.log('[AUTH-SERVICE] Loading Express...');
import express, { Application, Request, Response } from 'express';
console.log('[AUTH-SERVICE] Loading middleware...');
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
console.log('[AUTH-SERVICE] Loading shared utilities...');
import { logger, createServiceLogger } from '@shared/utils/logger';
import { errorHandler, notFoundHandler } from '@shared/middleware/error-handler';
import { createServiceRequestLogger } from '@shared/middleware/request-logger.middleware';
import { initializeMetrics, getMetrics, getMetricsContentType } from '@shared/utils/metrics';
import { createMetricsMiddleware } from '@shared/middleware/metrics.middleware';
console.log('[AUTH-SERVICE] Loading database config...');
import { authDatabase } from './config/database.config';
console.log('[AUTH-SERVICE] Loading Redis...');
import { connectRedis, disconnectRedis, checkRedisHealth } from '@shared/cache/redis-connection';
console.log('[AUTH-SERVICE] Loading auth routes...');
import authRoutes from './routes/auth.routes';
console.log('[AUTH-SERVICE] All imports loaded successfully');

// Create service-specific logger
const serviceLogger = createServiceLogger('auth-service');

// Initialize metrics
const metrics = initializeMetrics('auth-service');

// Handle uncaught exceptions with structured logging
process.on('uncaughtException', (error: Error) => {
  serviceLogger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  serviceLogger.error('Unhandled rejection', { error: reason });
  process.exit(1);
});

/**
 * Auth Service - Main Application

/**
 * Auth Service - Main Application
 * Handles authentication and user management
 */

// ============================================================================
// Environment Configuration
// ============================================================================

const PORT = process.env.AUTH_SERVICE_PORT || process.env.PORT || '3001';
const port = parseInt(PORT, 10) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SERVICE_NAME = 'auth-service';

// ============================================================================
// Express Application Setup
// ============================================================================

const app: Application = express();

// ============================================================================
// Security Middleware
// ============================================================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production',
  crossOriginEmbedderPolicy: NODE_ENV === 'production',
}));

// CORS - Cross-Origin Resource Sharing
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3005',
  'http://localhost:3010',
  'http://localhost:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
}));

// ============================================================================
// Body Parsing Middleware
// ============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================================================
// Compression Middleware
// ============================================================================

app.use(compression());

// ============================================================================
// Request Logging & Metrics Middleware
// ============================================================================

// Use the new structured request logger with correlation IDs
app.use(createServiceRequestLogger(SERVICE_NAME, {
  skipPaths: ['/health', '/health/live', '/health/ready', '/metrics'], // Don't log health checks and metrics
  successLogLevel: 'http',
}));

// Metrics collection middleware
app.use(createMetricsMiddleware(metrics, {
  excludePaths: ['/metrics', '/health', '/health/live', '/health/ready'],
  includeTenantId: true,
}));

// ============================================================================
// Metrics Endpoint
// ============================================================================

// Expose Prometheus metrics (no authentication required)
app.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', getMetricsContentType(metrics.register));
    const metricsOutput = await getMetrics(metrics.register);
    res.send(metricsOutput);
  } catch (error) {
    serviceLogger.error('Error generating metrics', { error });
    res.status(500).send('Error generating metrics');
  }
});

// ============================================================================
// Health Check Routes
// ============================================================================

app.get('/health', async (_req: Request, res: Response) => {
  const dbHealth = await authDatabase.healthCheck();
  const redisHealth = await checkRedisHealth();
  
  const healthStatus = {
    service: SERVICE_NAME,
    status: (dbHealth.status === 'healthy' && redisHealth) ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    dependencies: {
      database: dbHealth,
      redis: {
        status: redisHealth ? 'healthy' : 'unhealthy',
        connected: redisHealth,
      },
    },
  };

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

app.get('/health/live', (_req: Request, res: Response) => {
  res.status(200).json({
    service: SERVICE_NAME,
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const dbHealth = await authDatabase.healthCheck();
    const redisHealth = await checkRedisHealth();
    
    if (dbHealth.status === 'healthy' && redisHealth) {
      res.status(200).json({
        service: SERVICE_NAME,
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        service: SERVICE_NAME,
        status: 'not ready',
        reason: !dbHealth.status ? 'Database not healthy' : 'Redis not healthy',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      service: SERVICE_NAME,
      status: 'not ready',
      reason: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// API Routes
// ============================================================================

app.use('/api/auth', authRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: SERVICE_NAME,
    version: process.env.npm_package_version || '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      liveness: '/health/live',
      readiness: '/health/ready',
      api: '/api/auth',
    },
  });
});

// ============================================================================
// Error Handling Middleware
// ============================================================================

// 404 Handler - Must be before error handler
app.use(notFoundHandler);

// Global Error Handler - Must be last
app.use(errorHandler);

// ============================================================================
// Database Initialization
// ============================================================================

async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database connection...', { service: SERVICE_NAME });
    await authDatabase.initialize();
    logger.info('Database connection initialized successfully', { service: SERVICE_NAME });
  } catch (error) {
    logger.error('Failed to initialize database connection', {
      service: SERVICE_NAME,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// ============================================================================
// Redis Initialization
// ============================================================================

async function initializeRedis(): Promise<void> {
  try {
    logger.info('Initializing Redis connection...', { service: SERVICE_NAME });
    await connectRedis();
    logger.info('Redis connection initialized successfully', { service: SERVICE_NAME });
  } catch (error) {
    logger.error('Failed to initialize Redis connection', {
      service: SERVICE_NAME,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// ============================================================================
// Server Startup
// ============================================================================

async function startServer(): Promise<void> {
  try {
    // Setup process-level error handlers
    //  setupErrorHandlers();

    // Initialize database
    await initializeDatabase();

    // Initialize Redis
    await initializeRedis();

    // Start HTTP server
    const server = app.listen(port, '0.0.0.0', () => {
      logger.info(`${SERVICE_NAME} started successfully`, {
        service: SERVICE_NAME,
        port: port,
        environment: NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid,
      });
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`, {
        service: SERVICE_NAME,
      });

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed', { service: SERVICE_NAME });

        try {
          // Close database connections
          await authDatabase.close();
          logger.info('Database connections closed', { service: SERVICE_NAME });

          // Close Redis connection
          await disconnectRedis();
          logger.info('Redis connection closed', { service: SERVICE_NAME });

          logger.info('Graceful shutdown completed', { service: SERVICE_NAME });
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', {
            service: SERVICE_NAME,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout', { service: SERVICE_NAME });
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', {
      service: SERVICE_NAME,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// ============================================================================
// Start Application
// ============================================================================

// Start the server with proper error handling
console.log('[AUTH-SERVICE] Calling startServer()...');
startServer().catch((error) => {
  console.error('[AUTH-SERVICE] FATAL: Failed to start server:', error);
  process.exit(1);
});

// Export app for testing
export default app;