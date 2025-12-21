import { Request, Response, NextFunction, Router } from 'express';
import { ServiceMetrics } from '../utils/metrics';
declare global {
    namespace Express {
        interface Request {
            metricsStartTime?: number;
        }
    }
}
export interface MetricsMiddlewareOptions {
    excludePaths?: string[];
    includeTenantId?: boolean;
    normalizeRoute?: (path: string) => string;
}
export declare function createMetricsMiddleware(metrics: ServiceMetrics, options?: MetricsMiddlewareOptions): (req: Request, res: Response, next: NextFunction) => void;
export declare function createMetricsEndpoint(metrics: ServiceMetrics): Router;
export declare function exposeMetrics(metrics: ServiceMetrics, path?: string): (req: Request, res: Response, next: NextFunction) => Promise<void>;
declare const _default: {
    createMetricsMiddleware: typeof createMetricsMiddleware;
    createMetricsEndpoint: typeof createMetricsEndpoint;
    exposeMetrics: typeof exposeMetrics;
};
export default _default;
//# sourceMappingURL=metrics.middleware.d.ts.map