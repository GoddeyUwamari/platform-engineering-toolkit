import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
            startTime?: number;
        }
    }
}
export interface RequestLoggerOptions {
    serviceName?: string;
    logRequestBody?: boolean;
    logResponseBody?: boolean;
    skipPaths?: string[];
    successLogLevel?: 'debug' | 'http' | 'info';
    correlationIdHeader?: string;
}
export declare function createRequestLogger(options?: RequestLoggerOptions): (req: Request, res: Response, next: NextFunction) => void;
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare function createServiceRequestLogger(serviceName: string, options?: Omit<RequestLoggerOptions, 'serviceName'>): (req: Request, res: Response, next: NextFunction) => void;
export declare function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void;
export default requestLogger;
//# sourceMappingURL=request-logger.middleware.d.ts.map