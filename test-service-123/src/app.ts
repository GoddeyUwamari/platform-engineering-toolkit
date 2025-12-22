import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/environment';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware - helmet protects against common vulnerabilities
    if (config.security.helmet_enabled) {
      this.app.use(helmet());
    }

    // CORS configuration - control cross-origin requests
    if (config.cors.enabled) {
      this.app.use(
        cors({
          origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin) {
              return callback(null, true);
            }

            if (config.allowed_origins.includes(origin)) {
              callback(null, true);
            } else {
              callback(new Error('Not allowed by CORS'));
            }
          },
          credentials: config.cors.credentials,
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        })
      );
    }

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression middleware - compress response bodies
    if (config.security.compression_enabled) {
      this.app.use(compression());
    }

    // Request logging middleware
    if (config.logging.enable_request_logging) {
      this.app.use(morgan(config.logging.format));
    }

    // Trust proxy - important for deployment behind reverse proxies (nginx, etc.)
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Mount all routes
    this.app.use('/', routes);
  }

  private initializeErrorHandling(): void {
    // 404 handler - must be after all routes
    this.app.use(notFoundHandler);

    // Global error handler - must be last
    this.app.use(errorHandler);
  }

  public getApp(): Application {
    return this.app;
  }
}

export default new App().getApp();
