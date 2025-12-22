import { Request, Response } from 'express';
import { config } from '../config/environment';

interface ApiInfoResponse {
  success: boolean;
  data: {
    name: string;
    version: string;
    description: string;
    environment: string;
    endpoints: {
      health: string;
      ready: string;
      api: string;
    };
  };
  timestamp: string;
}

export const getApiInfo = (_req: Request, res: Response): void => {
  const apiInfo: ApiInfoResponse = {
    success: true,
    data: {
      name: config.app_name,
      version: config.api_version,
      description: 'Production-ready Node.js/TypeScript API Framework',
      environment: config.node_env,
      endpoints: {
        health: '/health',
        ready: '/ready',
        api: `/api/${config.api_version}`,
      },
    },
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(apiInfo);
};

export const getApiVersion = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    data: {
      version: config.api_version,
      message: `Welcome to ${config.app_name} API ${config.api_version}`,
    },
    timestamp: new Date().toISOString(),
  });
};
