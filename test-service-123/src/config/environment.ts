import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvironmentConfig {
  node_env: string;
  port: number;
  api_version: string;
  app_name: string;
  host: string;
  allowed_origins: string[];
  cors: {
    enabled: boolean;
    credentials: boolean;
  };
  security: {
    helmet_enabled: boolean;
    compression_enabled: boolean;
  };
  logging: {
    level: string;
    format: string;
    enable_request_logging: boolean;
  };
  // Database configuration (Phase 2)
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    pool: {
      min: number;
      max: number;
    };
  };
  // Redis configuration (Phase 2)
  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
    ttl: number;
  };
  // JWT configuration (Phase 2)
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
}

const getEnvironmentVariable = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value !== undefined ? value : defaultValue!;
};

const getNumberEnvironmentVariable = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

const getBooleanEnvironmentVariable = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  return value ? value.toLowerCase() === 'true' : defaultValue;
};

const getArrayEnvironmentVariable = (key: string, defaultValue: string[]): string[] => {
  const value = process.env[key];
  return value ? value.split(',').map((item) => item.trim()) : defaultValue;
};

export const config: EnvironmentConfig = {
  node_env: getEnvironmentVariable('NODE_ENV', 'development'),
  port: getNumberEnvironmentVariable('PORT', 3000),
  api_version: getEnvironmentVariable('API_VERSION', 'v1'),
  app_name: getEnvironmentVariable('APP_NAME', 'production-api-framework'),
  host: getEnvironmentVariable('HOST', 'localhost'),
  allowed_origins: getArrayEnvironmentVariable('ALLOWED_ORIGINS', [
    'http://localhost:3000',
    'http://localhost:3001',
  ]),
  cors: {
    enabled: getBooleanEnvironmentVariable('CORS_ENABLED', true),
    credentials: getBooleanEnvironmentVariable('CORS_CREDENTIALS', true),
  },
  security: {
    helmet_enabled: getBooleanEnvironmentVariable('HELMET_ENABLED', true),
    compression_enabled: getBooleanEnvironmentVariable('COMPRESSION_ENABLED', true),
  },
  logging: {
    level: getEnvironmentVariable('LOG_LEVEL', 'info'),
    format: getEnvironmentVariable('LOG_FORMAT', 'combined'),
    enable_request_logging: getBooleanEnvironmentVariable('ENABLE_REQUEST_LOGGING', true),
  },
  database: {
    host: getEnvironmentVariable('DB_HOST', 'localhost'),
    port: getNumberEnvironmentVariable('DB_PORT', 5432),
    name: getEnvironmentVariable('DB_NAME', 'api_db'),
    user: getEnvironmentVariable('DB_USER', 'postgres'),
    password: getEnvironmentVariable('DB_PASSWORD', ''),
    ssl: getBooleanEnvironmentVariable('DB_SSL', false),
    pool: {
      min: getNumberEnvironmentVariable('DB_POOL_MIN', 2),
      max: getNumberEnvironmentVariable('DB_POOL_MAX', 10),
    },
  },
  redis: {
    host: getEnvironmentVariable('REDIS_HOST', 'localhost'),
    port: getNumberEnvironmentVariable('REDIS_PORT', 6379),
    password: getEnvironmentVariable('REDIS_PASSWORD', ''),
    db: getNumberEnvironmentVariable('REDIS_DB', 0),
    ttl: getNumberEnvironmentVariable('REDIS_TTL', 3600),
  },
  jwt: {
    secret: getEnvironmentVariable('JWT_SECRET', 'change_this_in_production'),
    expiresIn: getEnvironmentVariable('JWT_EXPIRES_IN', '7d'),
    refreshSecret: getEnvironmentVariable('JWT_REFRESH_SECRET', 'change_this_in_production'),
    refreshExpiresIn: getEnvironmentVariable('JWT_REFRESH_EXPIRES_IN', '30d'),
  },
};

export const isProduction = (): boolean => config.node_env === 'production';
export const isDevelopment = (): boolean => config.node_env === 'development';
export const isTest = (): boolean => config.node_env === 'test';
