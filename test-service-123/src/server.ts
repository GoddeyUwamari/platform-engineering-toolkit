import 'reflect-metadata';
import { Server } from 'http';
import app from './app';
import { config } from './config/environment';
import { initializeDatabase, closeDatabase } from './core/database/data-source';
import { initializeRedis, closeRedis } from './core/cache/redis.config';

let server: Server | undefined;

/**
 * Initialize all services (database, cache, etc.)
 */
const initializeServices = async (): Promise<void> => {
  try {
    console.info('🔧 Initializing services...\n');

    // Initialize database connection
    await initializeDatabase();

    // Initialize Redis connection
    initializeRedis();

    console.info('\n✅ All services initialized successfully\n');
  } catch (error) {
    console.error('\n❌ Failed to initialize services:', error);
    throw error;
  }
};

/**
 * Start HTTP server
 */
const startServer = (): void => {
  try {
    const PORT = config.port;
    const HOST = config.host;

    server = app.listen(PORT, () => {
      console.info('='.repeat(60));
      console.info(`🚀 Server started successfully!`);
      console.info('='.repeat(60));
      console.info(`📦 Application: ${config.app_name}`);
      console.info(`🌍 Environment: ${config.node_env}`);
      console.info(`🔗 URL: http://${HOST}:${PORT}`);
      console.info(`📡 API Version: ${config.api_version}`);
      console.info(`⏰ Started at: ${new Date().toISOString()}`);
      console.info('='.repeat(60));
      console.info(`📍 Health Check: http://${HOST}:${PORT}/health`);
      console.info(`📍 Readiness Check: http://${HOST}:${PORT}/ready`);
      console.info(`📍 API Info: http://${HOST}:${PORT}/api/${config.api_version}`);
      console.info(`📍 Users API: http://${HOST}:${PORT}/api/${config.api_version}/users`);
      console.info(`📍 Tasks API: http://${HOST}:${PORT}/api/${config.api_version}/tasks`);
      console.info('='.repeat(60));
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 * Closes all connections before exiting
 */
const gracefulShutdown = (signal: string): void => {
  console.info(`\n${signal} signal received: closing HTTP server gracefully`);

  if (server) {
    server.close(() => {
      console.info('✅ HTTP server closed');

      // Close database and Redis connections
      Promise.all([closeDatabase(), closeRedis()])
        .then(() => {
          console.info('✅ All connections closed. Exiting process...');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        });
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

/**
 * Bootstrap application
 * Initialize services then start HTTP server
 */
const bootstrap = async (): Promise<void> => {
  try {
    // Initialize all services first
    await initializeServices();

    // Start HTTP server
    startServer();
  } catch (error) {
    console.error('❌ Failed to bootstrap application:', error);
    process.exit(1);
  }
};

// Start the application
void bootstrap();

export default server;
