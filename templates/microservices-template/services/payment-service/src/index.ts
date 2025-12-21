// ============================================================================
// Load Environment Variables FIRST
// ============================================================================
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

// ============================================================================
// Application Imports
// ============================================================================
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@shared/utils/logger';
import { errorHandler, notFoundHandler } from '@shared/middleware/error-handler';
import { initializeMetrics, getMetrics, getMetricsContentType } from '@shared/utils/metrics';
import { paymentDatabase } from './config/database.config';
import { stripeConfig } from './config/stripe.config';
import paymentRoutes from './routes';

/**
 * Payment Service - Main Application
 * Handles payment processing, payment methods, and Stripe integration
 */

// ============================================================================
// Environment Configuration
// ============================================================================

const PORT = process.env.PAYMENT_SERVICE_PORT || process.env.PORT || '3003';
const port = parseInt(PORT, 10) || 3003;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SERVICE_NAME = 'payment-service';

// Initialize metrics
const metrics = initializeMetrics('payment-service');

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'stripe-signature'],
}));

// ============================================================================
// Body Parsing Middleware
// ============================================================================

// Special handling for Stripe webhooks - need raw body
app.use('/api/payments/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON and URL-encoded body parsing for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// Request Logging Middleware
// ============================================================================

app.use((req: Request, res: Response, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      service: SERVICE_NAME,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
});

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
    logger.error('Error generating metrics', { error });
    res.status(500).send('Error generating metrics');
  }
});

// ============================================================================
// Health Check Routes
// ============================================================================

app.get('/health', async (_req: Request, res: Response) => {
  const dbHealth = await paymentDatabase.healthCheck();
  const stripeHealth = stripeConfig.isInitialized();

  const healthStatus = {
    service: SERVICE_NAME,
    status: dbHealth.status === 'healthy' && stripeHealth ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    dependencies: {
      database: dbHealth,
      stripe: {
        status: stripeHealth ? 'healthy' : 'unhealthy',
        initialized: stripeHealth,
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
    const dbHealth = await paymentDatabase.healthCheck();
    const stripeHealth = stripeConfig.isInitialized();

    if (dbHealth.status === 'healthy' && stripeHealth) {
      res.status(200).json({
        service: SERVICE_NAME,
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        service: SERVICE_NAME,
        status: 'not ready',
        reason: !stripeHealth ? 'Stripe not initialized' : 'Database not healthy',
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

// Mount payment routes at multiple paths to support different frontend URLs
app.use('/api/payments', paymentRoutes);
app.use('/api/payment-methods', paymentRoutes);
app.use('/api/refunds', paymentRoutes);

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
      api: '/api/payments',
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
// Database and Stripe Initialization
// ============================================================================

async function initializeServices(): Promise<void> {
  try {
    // Initialize database
    logger.info('Initializing database connection...', { service: SERVICE_NAME });
    await paymentDatabase.initialize();
    logger.info('Database connection initialized successfully', { service: SERVICE_NAME });

    // Initialize Stripe
    logger.info('Initializing Stripe client...', { service: SERVICE_NAME });
    stripeConfig.initialize();
    logger.info('Stripe client initialized successfully', { service: SERVICE_NAME });

  } catch (error) {
    logger.error('Failed to initialize services', {
      service: SERVICE_NAME,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// ============================================================================
// Server Startup
// ============================================================================

async function startServer(): Promise<void> {
  try {
    // Initialize services
    await initializeServices();

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
          await paymentDatabase.close();
          logger.info('Database connections closed', { service: SERVICE_NAME });

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
// Process Error Handlers
// ============================================================================

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    service: SERVICE_NAME,
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection', {
    service: SERVICE_NAME,
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

// ============================================================================
// Start Application
// ============================================================================

// Start the server with proper error handling
startServer().catch((error) => {
  logger.error('FATAL: Failed to start server', {
    service: SERVICE_NAME,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});

// Export app for testing
export default app;
